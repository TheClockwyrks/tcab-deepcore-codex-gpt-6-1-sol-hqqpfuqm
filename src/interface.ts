import * as C from "./constants";
import {
  type ReadState,
  type Rect,
  slots,
  loadKg,
  maxFuel,
  maxHull,
  BUILDING_RECTS,
} from "./model";
export function menu(s: ReadState): readonly string[] {
  switch (s.screen) {
    case "title":
      return s.hasSave ? C.TITLE_ITEMS : C.TITLE_ITEMS.slice(1);
    case "mode-select":
      return C.MODE_ITEMS;
    case "size-select":
      return C.SIZE_ITEMS;
    case "how-to-play":
      return C.HOW_TO_PLAY_ITEMS;
    case "paused":
      return C.PAUSE_ITEMS;
    case "victory":
      return C.VICTORY_ITEMS;
    case "game-over":
      return s.hasSave && s.mode === "standard"
        ? C.GAME_OVER_SAVE_ITEMS
        : C.GAME_OVER_ITEMS;
    default:
      return [];
  }
}
export const menuRect = (index: number): Rect => ({
  x: 104,
  y: 360 + index * 64,
  w: 410,
  h: 51,
});
export interface Control {
  id: string;
  subject: string | null;
  label: string;
  detail: string;
  rect: Rect;
  enabled: boolean;
}
export function controls(s: ReadState): Control[] {
  const result: Control[] = [];
  const add = (
    id: string,
    subject: string | null,
    label: string,
    detail: string,
    enabled = true,
  ) => {
    const i = result.length;
    result.push({
      id,
      subject,
      label,
      detail,
      enabled,
      rect: { x: 246, y: 202 + i * 48, w: 788, h: 40 },
    });
  };
  if (s.panel === "fuel-depot") {
    add(
      "buy-fuel",
      null,
      "FUEL +" + C.FUEL_BUY_INCREMENT,
      "25 Credits",
      s.credits > 0 && s.miner.fuel < maxFuel(s),
    );
    add(
      "fill-fuel",
      null,
      "FILL TANK",
      "1 Credit / unit",
      s.credits > 0 && s.miner.fuel < maxFuel(s),
    );
    add(
      "buy-repair",
      null,
      "HULL +" + C.REPAIR_BUY_INCREMENT,
      "50 Credits",
      s.credits > 0 && s.miner.hull < maxHull(s),
    );
    add(
      "repair-full",
      null,
      "REPAIR TO FULL",
      "2 Credits / point",
      s.credits > 0 && s.miner.hull < maxHull(s),
    );
  } else if (s.panel === "upgrade-shop") {
    C.TRACKS.forEach((track) => {
      const t = s.tiers[track],
        price = C.UPGRADE_PRICES[t - 1],
        next = t < C.MAX_TIER[track];
      const desc =
        track === "fuel"
          ? C.FUEL_TIERS[t] + " fuel"
          : track === "hull"
            ? C.HULL_TIERS[t] + " hull"
            : track === "cargo"
              ? C.CARGO_TIERS[t] + " slots"
              : track === "drill"
                ? "Power " + (t + 1)
                : track === "jetpack"
                  ? C.JETPACK_TIERS[t]?.liftLimitKg + " kg lift"
                  : track === "scanner"
                    ? C.SCANNER_TIERS[t] + " tile range"
                    : Math.round((C.RADIATOR_TIERS[t] ?? 0) * 100) +
                      "% heat resistance";
      add(
        "buy-upgrade",
        track,
        track.toUpperCase() + "  /  TIER " + t,
        next ? desc + "   ·   " + price + " Cr" : "MAXIMUM",
        next && s.credits >= price,
      );
    });
  } else if (s.panel === "supply-depot")
    C.ITEMS.forEach((item, i) =>
      add(
        "buy-item",
        item.id,
        i + 1 + ". " + item.name.toUpperCase(),
        item.price + " Cr   ·   HELD " + s.items[item.id],
        s.credits >= item.price,
      ),
    );
  else if (s.panel === "launch-pad") {
    const part = C.ROCKET_COMPONENTS[s.installed];
    if (part)
      add(
        "fabricate",
        null,
        C.FABRICATE,
        part.name +
          " · " +
          part.credits +
          " Cr" +
          (part.material ? " + " + part.material : ""),
        s.credits >= part.credits &&
          (!part.material ||
            (part.material === "core-sample"
              ? s.satchel.coreSample
              : s.satchel[part.material] > 0)),
      );
    else add("launch", null, C.LAUNCH, "All systems ready");
  } else if (s.panel === "ore-market")
    add(
      "sell",
      null,
      C.SELL,
      C.MINERALS.reduce((a, o) => a + (s.cargo[o.id] ?? 0) * o.value, 0) +
        " Credits",
      slots(s) > 0,
    );
  else if (s.panel === "inventory") {
    C.MINERALS.filter((o) => s.cargo[o.id]).forEach((o) =>
      add(
        "drop-ore",
        o.id,
        "DROP  " + o.name.toUpperCase(),
        s.cargo[o.id] + " units  ·  " + o.weightKg + " kg each",
      ),
    );
    C.ITEMS.filter((i) => s.items[i.id]).forEach((i) =>
      add(
        "use-item",
        i.id,
        C.USE + "  " + i.name.toUpperCase(),
        "HELD " + s.items[i.id],
      ),
    );
    if (s.satchel.coreSample)
      add("jettison", null, C.JETTISON, "Unstable Core Sample");
    if (result.length > 8)
      result.forEach((c, i) => {
        c.rect = {
          x: 246 + (i % 2) * 400,
          y: 202 + Math.floor(i / 2) * 38,
          w: 388,
          h: 34,
        };
      });
  }
  if (s.panel)
    result.push({
      id: "close",
      subject: null,
      label: "CLOSE  [ESC]",
      detail: "",
      enabled: true,
      rect: { x: 872, y: 612, w: 162, h: 40 },
    });
  if (s.screen === "in-mine") {
    for (const [i, id] of ["inventory", "pause", "mute"].entries())
      result.push({
        id,
        subject: null,
        label:
          id === "mute"
            ? s.muted
              ? "SOUND OFF"
              : "SOUND ON"
            : id.toUpperCase(),
        detail: "",
        enabled: true,
        rect: { x: 986 + i * 94, y: 10, w: 88, h: 34 },
      });
  }
  if (s.notice && s.notice.age >= C.NOTICE_DELAY)
    result.push({
      id: "dismiss-notice",
      subject: null,
      label: "",
      detail: "",
      enabled: true,
      rect: { x: 320, y: 583, w: 640, h: 100 },
    });
  return result;
}
export function controlRect(
  s: ReadState,
  id: string,
  subject: string | null,
): Rect | null {
  return (
    controls(s).find((c) => c.id === id && c.subject === subject)?.rect ?? null
  );
}
export const inside = (p: { x: number; y: number }, r: Rect) =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
export function nearby(s: ReadState) {
  return BUILDING_RECTS.find(
    (b) =>
      s.miner.x + C.MINER_W / 2 >= b.x &&
      s.miner.x + C.MINER_W / 2 <= b.x + b.w &&
      s.miner.y + C.MINER_H <= C.SURFACE_Y + 0.1 &&
      s.miner.y + C.MINER_H > C.SURFACE_Y - C.TILE,
  );
}
export const cargoDescription = (s: ReadState) =>
  slots(s) +
  " / " +
  C.CARGO_TIERS[s.tiers.cargo - 1] +
  " slots   ·   " +
  loadKg(s) +
  " kg";
