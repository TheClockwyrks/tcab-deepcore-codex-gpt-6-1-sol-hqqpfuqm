/// <reference types="vite/client" />
import type { Game, UpdateApi } from "@clockwyrks/simple-2d";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
import * as C from "./constants";
import {
  type DeepcoreState,
  blank,
  copy,
  start,
  restore,
  BUILDING_RECTS,
  snapshot,
} from "./model";
import { debug } from "./debug";
import { render } from "./render";
import { step, camera, transact } from "./simulation";
import { menu, menuRect, controls, inside, nearby } from "./interface";
export type { DeepcoreState } from "./model";
export type DeepcoreDebugApi = typeof debug;
export const BACKGROUND = "#0d1b25";
const urls = import.meta.glob<string>("../assets/**/*.{png,wav,json}", {
  eager: true,
  query: "?url&no-inline",
  import: "default",
});
export function assetPath(url: string): string {
  // With a relative Vite base, production imports become absolute URLs resolved
  // against import.meta.url. The engine still requires a path under its asset root.
  const marker = "/assets/";
  const index = url.lastIndexOf(marker);
  return index >= 0
    ? url.slice(index + marker.length)
    : url.replace(/^\.\/assets\//, "");
}
function choose(s: DeepcoreState): DeepcoreState {
  const entry = menu(s)[s.menuIndex];
  const go = (screen: C.ScreenName, index = 0) => {
    s.screen = screen;
    s.menuIndex = index;
    s.panel = null;
    return s;
  };
  if (s.screen === "title") {
    if (entry === "CONTINUE") return restore(s);
    return go(entry === "HOW TO PLAY" ? "how-to-play" : "mode-select");
  }
  if (s.screen === "mode-select") {
    if (entry === "BACK") return go("title", s.hasSave ? 1 : 0);
    s.mode = s.menuIndex === 0 ? "standard" : "hardcore";
    return go("size-select");
  }
  if (s.screen === "size-select") {
    if (entry === "BACK") return go("mode-select", C.MODES.indexOf(s.mode));
    s.worldSize = C.WORLD_SIZES[s.menuIndex];
    return start(s);
  }
  if (s.screen === "how-to-play") return go("title", s.hasSave ? 2 : 1);
  if (s.screen === "paused") {
    if (entry === "RESUME") return go("in-mine");
    if (entry === "RESTART") return start(s);
    return go("title", s.hasSave ? 1 : 0);
  }
  if (entry === "MENU") return go("title", s.hasSave ? 1 : 0);
  return entry === "CONTINUE FROM SAVE" ? restore(s) : start(s);
}
function control(
  s: DeepcoreState,
  id: string,
  subject: string | null,
  api: UpdateApi,
): DeepcoreState {
  if (id === "close") {
    s.panel = null;
    return s;
  }
  if (id === "inventory") {
    s.panel = s.panel === "inventory" ? null : "inventory";
    s.panelIndex = 0;
    return s;
  }
  if (id === "pause") {
    s.screen = "paused";
    s.menuIndex = 0;
    return s;
  }
  if (id === "mute") {
    api.audio.setMuted(!api.audio.muted());
    return s;
  }
  return transact(s, id, subject);
}
export const game: Game<DeepcoreState, DeepcoreDebugApi> = {
  async initialize(api) {
    for (const [name, keys] of Object.entries(C.ACTIONS))
      api.input.register(name, { keys: [...keys] });
    const images: Record<string, ImageBitmap> = {},
      systems: Record<string, ParticleSystem> = {};
    await Promise.all(
      Object.entries(urls).map(async ([source, url]) => {
        const key = source.replace("../assets/", "");
        if (key.endsWith(".png"))
          images[key] = await api.assets.loadImage(assetPath(url));
        else if (key.startsWith("fx/"))
          systems[key.slice(3, -5)] = JSON.parse(
            await (await api.assets.load(assetPath(url))).text(),
          ) as ParticleSystem;
      }),
    );
    await Promise.all(
      Object.values(C.CUES).map((cue) => {
        const source = urls["../assets/audio/" + cue + ".wav"];
        return api.audio.load(cue, assetPath(source));
      }),
    );
    const state = blank(images, systems);
    const readings: Record<
      string,
      (s: DeepcoreState) => string | number | boolean
    > = {
      screen: (s) => s.screen,
      panel: (s) => s.panel ?? "none",
      mode: (s) => s.mode,
      worldSize: (s) => s.worldSize,
      position: (s) => s.miner.x.toFixed(1) + ", " + s.miner.y.toFixed(1),
      velocity: (s) => s.miner.vx.toFixed(1) + ", " + s.miner.vy.toFixed(1),
      state: (s) => s.miner.state,
      facing: (s) => s.miner.facing,
      grounded: (s) => snapshot(s).miner.grounded,
      fuel: (s) => s.miner.fuel.toFixed(1) + "/" + snapshot(s).miner.maxFuel,
      hull: (s) => s.miner.hull.toFixed(1) + "/" + snapshot(s).miner.maxHull,
      drilling: (s) => JSON.stringify(snapshot(s).miner.drilling),
      credits: (s) => s.credits,
      depth: (s) => snapshot(s).depthMeters,
      cargo: (s) => JSON.stringify(snapshot(s).cargo),
      overloaded: (s) => snapshot(s).miner.overloaded,
      satchel: (s) => JSON.stringify(s.satchel),
      tiers: (s) => JSON.stringify(s.tiers),
      coreTimer: (s) => s.coreTimer ?? "none",
      scanner: (s) => JSON.stringify(snapshot(s).scanner),
    };
    for (const [name, read] of Object.entries(readings))
      api.diagnostics.register(name, (s) => read(s as DeepcoreState));
    return [state, debug];
  },
  update(state, api, dt) {
    let s = copy(state);
    s.simTime += dt;
    if (api.input.pressed("mute")) api.audio.setMuted(!api.audio.muted());
    s.muted = api.audio.muted();
    api.audio.loop(C.CUES.music);
    const pointer = api.input.pointer(),
      pressed = api.input.pointerPressed(),
      released = api.input.pointerReleased();
    const moved =
      pointer.x !== s.lastPointer.x || pointer.y !== s.lastPointer.y;
    s.lastPointer = { x: pointer.x, y: pointer.y };
    const items = menu(s);
    if (items.length) {
      if (api.input.pressed("down"))
        s.menuIndex = (s.menuIndex + 1) % items.length;
      if (api.input.pressed("up"))
        s.menuIndex = (s.menuIndex + items.length - 1) % items.length;
      items.forEach((_, i) => {
        const rect =
          s.screen === "how-to-play" ? { ...menuRect(i), y: 590 } : menuRect(i);
        if (inside(pointer, rect)) {
          if (moved || pressed) s.menuIndex = i;
          if (pressed) s.pointerStart = "menu:" + i;
          if (released && s.pointerStart === "menu:" + i) {
            s.menuIndex = i;
            s = choose(s);
          }
        }
      });
      if (api.input.pressed("activate")) s = choose(s);
      if (api.input.pressed("pause")) {
        if (s.screen === "paused") {
          s.screen = "in-mine";
          s.menuIndex = 0;
        } else if (s.screen === "size-select") {
          s.screen = "mode-select";
          s.menuIndex = C.MODES.indexOf(s.mode);
        } else if (s.screen === "mode-select" || s.screen === "how-to-play") {
          s.menuIndex =
            s.screen === "how-to-play"
              ? s.hasSave
                ? 2
                : 1
              : s.hasSave
                ? 1
                : 0;
          s.screen = "title";
        }
      }
    } else if (s.screen === "in-mine") {
      if (api.input.pressed("pause")) {
        if (s.panel) s.panel = null;
        else {
          s.screen = "paused";
          s.menuIndex = 0;
        }
      }
      if (api.input.pressed("inventory")) {
        s.panel = s.panel === "inventory" ? null : "inventory";
        s.panelIndex = 0;
      }
      if (api.input.pressed("jettison")) s = transact(s, "jettison");
      C.ITEM_IDS.forEach((id, i) => {
        if (api.input.pressed("supply" + (i + 1)))
          s = transact(s, "use-item", id);
      });
      const cs = controls(s);
      cs.forEach((c) => {
        if (c.enabled && inside(pointer, c.rect)) {
          const key = c.id + ":" + c.subject;
          if (pressed) s.pointerStart = key;
          if (released && s.pointerStart === key)
            s = control(s, c.id, c.subject, api);
        }
      });
      if (s.panel) {
        const panelControls = cs.filter(
          (c) =>
            !["inventory", "pause", "mute", "dismiss-notice"].includes(c.id),
        );
        if (api.input.pressed("down"))
          s.panelIndex = (s.panelIndex + 1) % Math.max(1, panelControls.length);
        if (api.input.pressed("up"))
          s.panelIndex =
            (s.panelIndex + panelControls.length - 1) %
            Math.max(1, panelControls.length);
        if (api.input.pressed("activate")) {
          const c = panelControls[s.panelIndex % panelControls.length];
          if (c?.enabled) s = control(s, c.id, c.subject, api);
        }
      } else {
        const b = nearby(s);
        if (b && api.input.pressed("activate")) {
          if (b.id === "save-pad") s = transact(s, "save");
          else {
            s.panel = b.id;
            s.panelIndex = 0;
          }
        }
        if (pressed)
          for (const building of BUILDING_RECTS) {
            if (
              inside(
                {
                  x: pointer.x + s.camera.x,
                  y: pointer.y + s.camera.y - C.HUD_H,
                },
                building,
              ) &&
              b?.id === building.id
            ) {
              if (building.id === "save-pad") s = transact(s, "save");
              else s.panel = building.id;
            }
          }
      }
      if (s.screen === "in-mine") {
        s.accumulator += dt;
        const held = {
          left: api.input.value("left"),
          right: api.input.value("right"),
          down: api.input.value("down"),
          up: api.input.value("up"),
        };
        const fixed = 1 / 120;
        while (s.accumulator + 1e-10 >= fixed && s.screen === "in-mine") {
          step(s, held, fixed);
          s.accumulator -= fixed;
        }
        camera(s, dt);
      }
    }
    if (released) s.pointerStart = null;
    const active = s.screen === "in-mine" && !s.panel;
    for (const [cue, on] of [
      [C.CUES.drill, active && !!s.miner.drilling],
      [C.CUES.thrust, active && s.miner.state === "jetpack"],
    ] as const) {
      if (on) api.audio.loop(cue);
      else api.audio.stop(cue);
    }
    if (
      s.screen === "in-mine" &&
      s.miner.fuel / snapshot(s).miner.maxFuel < C.LOW_FUEL_FRACTION &&
      Math.floor(s.simTime) !== Math.floor(state.simTime)
    )
      s.cues.push(C.CUES.alarmFuel);
    for (const cue of s.cues) api.audio.play(cue);
    s.cues = [];
    s.muted = api.audio.muted();
    return s;
  },
  render,
};
