import type { ParticleSystem } from "@clockwyrks/particle-runtime";
import type { RenderApi } from "@clockwyrks/simple-2d";
import { ParticleCanvasPlayer } from "@clockwyrks/particle-runtime/canvas";
import * as C from "./constants";
import {
  type ReadState,
  type Rect,
  tile,
  position,
  depth,
  maxFuel,
  maxHull,
  slots,
  loadKg,
  lift,
  BUILDING_RECTS,
  scanner,
} from "./model";
import {
  menu,
  menuRect,
  controls,
  nearby,
  cargoDescription,
} from "./interface";

const ink = "#0d1b25",
  paper = "#e4e6d8",
  muted = "#93a6a8",
  gold = "#e9b674";
function box(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  fill: string,
  stroke?: string,
): void {
  ctx.fillStyle = fill;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  }
}
function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  size = 16,
  color = paper,
  font = "monospace",
): void {
  ctx.fillStyle = color;
  ctx.font = `${size}px ${font}`;
  ctx.fillText(value, x, y);
}
function image(
  s: ReadState,
  ctx: CanvasRenderingContext2D,
  path: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const img = s.images[path];
  if (img) ctx.drawImage(img as CanvasImageSource, x, y, w, h);
}
function particle(
  s: ReadState,
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  age: number,
  seed: number,
): void {
  const system = s.systems[name];
  if (!system) return;
  ctx.save();
  ctx.translate(x, y - 400);
  // The binding's virtual 400-unit field keeps its fit independent of the stage backing store.
  let drawing = false;
  const fieldContext = new Proxy(ctx, {
    get(target, key) {
      if (key === "canvas") return { width: 400, height: 400 };
      if (key === "fill" && !drawing) return () => {};
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
    set(target, key, value) {
      return Reflect.set(target, key, value);
    },
  });
  const player = new ParticleCanvasPlayer(
    system as ParticleSystem,
    fieldContext,
    { clear: false, seed, pixelRadius: name === "gas-seep" ? 5 : 3 },
  );
  drawing = true;
  player.update(age);
  ctx.restore();
}
function miner(
  s: ReadState,
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1,
): void {
  const state = s.miner.state,
    frames =
      state === "walk"
        ? 6
        : state === "fall" || state === "hurt" || state === "fuel-out"
          ? 3
          : 4;
  const f =
    state === "hurt"
      ? Math.min(frames - 1, Math.floor((C.HURT_TIME - s.hurt) * C.ANIM_FPS))
      : Math.floor(s.animationTime * C.ANIM_FPS) % frames;
  ctx.save();
  ctx.translate(x + C.MINER_W / 2, y);
  ctx.scale(s.miner.facing === "west" ? -scale : scale, scale);
  image(
    s,
    ctx,
    `miner/${state}/frame${String(f).padStart(2, "0")}.png`,
    -40,
    -7,
    C.MINER_SPRITE,
    C.MINER_SPRITE,
  );
  ctx.restore();
}
function tunnelPath(
  s: ReadState,
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  kind: string,
): void {
  const open = (c: number, r: number) =>
    tile(s, c, r).kind === kind || (kind === "tunnel" && r === 0);
  const left = open(col - 1, row),
    right = open(col + 1, row),
    up = open(col, row - 1),
    down = open(col, row + 1);
  const x = col * C.TILE,
    y = row * C.TILE;
  const inset = 7,
    r = 13;
  ctx.beginPath();
  ctx.roundRect(
    x + (left ? 0 : inset),
    y + (up ? 0 : inset),
    C.TILE - (left ? 0 : inset) - (right ? 0 : inset),
    C.TILE - (up ? 0 : inset) - (down ? 0 : inset),
    [
      left || up ? 0 : r,
      right || up ? 0 : r,
      right || down ? 0 : r,
      left || down ? 0 : r,
    ],
  );
  for (const [cx, cy, joined, diagonal] of [
    [x, y, left && up, open(col - 1, row - 1)],
    [x + C.TILE, y, right && up, open(col + 1, row - 1)],
    [x + C.TILE, y + C.TILE, right && down, open(col + 1, row + 1)],
    [x, y + C.TILE, left && down, open(col - 1, row + 1)],
  ] as const) {
    if (joined && !diagonal) {
      ctx.moveTo(cx + inset, cy);
      ctx.arc(cx, cy, inset, 0, Math.PI * 2);
    }
  }
  ctx.clip("evenodd");
}
export function world(s: ReadState, ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, C.HUD_H, C.VIEW_W, C.VIEW_H);
  ctx.clip();
  const shake = s.shake ? Math.sin(s.simTime * 79) * s.shake * 5 : 0;
  ctx.translate(
    -s.camera.x + shake,
    C.HUD_H -
      s.camera.y +
      (s.shake ? Math.cos(s.simTime * 67) * s.shake * 4 : 0),
  );
  const x0 = Math.floor(s.camera.x / C.TILE),
    x1 = x0 + Math.ceil(C.VIEW_W / C.TILE);
  const r0 = Math.max(1, Math.floor(s.camera.y / C.TILE)),
    r1 = Math.min(s.coreRow, Math.ceil((s.camera.y + C.VIEW_H) / C.TILE));
  ctx.fillStyle = ink;
  ctx.fillRect(s.camera.x, s.camera.y, C.VIEW_W, C.VIEW_H);
  if (s.camera.y < C.SURFACE_Y) {
    for (
      let x = Math.floor(s.camera.x / 480) * 480;
      x < s.camera.x + C.VIEW_W;
      x += 480
    )
      image(s, ctx, "surface/sky.png", x, C.SURFACE_Y - 480, 480, 480);
    for (let x = 0; x < C.WORLD_W; x += 240)
      image(s, ctx, "surface/ground.png", x, C.SURFACE_Y - 7, 240, 30);
    for (const b of BUILDING_RECTS) {
      image(s, ctx, "surface/" + b.id + ".png", b.x, b.y, b.w, b.h);
      text(
        ctx,
        b.id.replace(/-/g, " ").toUpperCase(),
        b.x + 2,
        b.y - 12,
        13,
        muted,
      );
    }
    image(
      s,
      ctx,
      "surface/cave-mouth.png",
      C.CAVE_MOUTH_COL * C.TILE - 70,
      C.SURFACE_Y - 150,
      220,
      150,
    );
    text(
      ctx,
      "MINE ACCESS",
      C.CAVE_MOUTH_COL * C.TILE - 19,
      C.SURFACE_Y - 162,
      13,
      gold,
    );
    const b = BUILDING_RECTS[5];
    image(
      s,
      ctx,
      `rocket/stage${s.installed}.png`,
      b.x + 30,
      b.y - 90 - s.launchTime * s.launchTime * 60,
      160,
      240,
    );
    const near = nearby(s);
    if (near && !s.panel && !s.launchTime) {
      box(
        ctx,
        { x: near.x, y: C.SURFACE_Y + 18, w: 220, h: 31 },
        "#102331",
        "#587070",
      );
      text(
        ctx,
        "[ E ]  " + (near.id === "save-pad" ? "SAVE" : "OPEN"),
        near.x + 17,
        C.SURFACE_Y + 39,
        14,
        gold,
      );
    }
  }
  for (let row = r0; row <= r1; row++)
    for (let col = x0; col <= Math.min(C.WORLD_COLS - 1, x1); col++) {
      const c = tile(s, col, row),
        x = col * C.TILE,
        y = row * C.TILE,
        v = ((col * 17 + row * 31) >>> 0) % C.TILE_VARIANTS;
      if (c.kind === "bedrock") {
        image(s, ctx, "tiles/bedrock.png", x, y, C.TILE, C.TILE);
        continue;
      }
      image(
        s,
        ctx,
        `tiles/${c.band ?? "coreshell"}-${v}.png`,
        x,
        y,
        C.TILE,
        C.TILE,
      );
      if (c.kind === "tunnel" || c.kind === "lava") {
        ctx.save();
        tunnelPath(s, ctx, col, row, c.kind);
        image(
          s,
          ctx,
          c.kind === "tunnel"
            ? "tiles/tunnel.png"
            : `hazards/lava/frame${String(Math.floor(s.animationTime * 5) % 3).padStart(2, "0")}.png`,
          x,
          y,
          C.TILE,
          C.TILE,
        );
        ctx.restore();
      }
      const cutting = s.miner.drilling;
      if (
        cutting?.dir === "down" &&
        cutting.col === col &&
        cutting.row === row &&
        c.health !== null &&
        c.maxHealth &&
        tile(s, col, row + 1).kind !== "tunnel" &&
        tile(s, col, row + 1).kind !== "lava"
      ) {
        ctx.save();
        tunnelPath(s, ctx, col, row, "tunnel");
        ctx.beginPath();
        ctx.rect(x, y, C.TILE, (1 - c.health / c.maxHealth) * C.TILE);
        ctx.clip();
        image(s, ctx, "tiles/tunnel.png", x, y, C.TILE, C.TILE);
        ctx.restore();
      }
      if (c.kind === "stone")
        image(s, ctx, `tiles/stone-${v % 2}.png`, x, y, C.TILE, C.TILE);
      if (c.ore) image(s, ctx, "ore/" + c.ore + ".png", x, y, C.TILE, C.TILE);
      if (c.material)
        image(s, ctx, "materials/" + c.material + ".png", x, y, C.TILE, C.TILE);
      if (c.kind === "core")
        image(s, ctx, "materials/core.png", x, y, C.TILE, C.TILE);
      if (c.health !== null && c.maxHealth !== null && c.health < c.maxHealth)
        image(
          s,
          ctx,
          `tiles/crack/frame${String(Math.min(C.CRACK_FRAMES - 1, Math.floor((1 - c.health / c.maxHealth) * C.CRACK_FRAMES))).padStart(2, "0")}.png`,
          x,
          y,
          C.TILE,
          C.TILE,
        );
      ctx.strokeStyle = "#14232a22";
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, C.TILE, C.TILE);
      if (c.kind === "gas")
        particle(
          s,
          ctx,
          "gas-seep",
          x + 40,
          y + 44,
          (s.animationTime + ((col * row) % 17) / 10) % C.GAS_SEEP_PERIOD,
          col * 1000 + row,
        );
    }
  if (s.coreGround) {
    const p = s.coreGround;
    image(
      s,
      ctx,
      "materials/core-sample.png",
      p.col * C.TILE,
      p.row * C.TILE,
      C.TILE,
      C.TILE,
    );
    text(
      ctx,
      Math.ceil(s.coreTimer ?? 0) + "s",
      p.col * C.TILE,
      p.row * C.TILE - 8,
      20,
      gold,
    );
  }
  if (!s.launchTime) miner(s, ctx, s.miner.x, s.miner.y);
  for (const e of s.effects) particle(s, ctx, e.name, e.x, e.y, e.age, e.seed);
  ctx.restore();
  // Subtle vignette lends depth while retaining the full ore field.
  const gradient = ctx.createRadialGradient(640, 390, 140, 640, 390, 770);
  gradient.addColorStop(0, "#09141e00");
  gradient.addColorStop(1, "#09141e88");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, C.HUD_H, C.STAGE_W, C.VIEW_H);
}
function hud(s: ReadState, ctx: CanvasRenderingContext2D): void {
  box(ctx, { x: 0, y: 0, w: C.STAGE_W, h: C.HUD_H }, "#0b1923");
  ctx.fillStyle = "#42606a";
  ctx.fillRect(0, C.HUD_H - 1, C.STAGE_W, 1);
  const gauge = (
    x: number,
    name: string,
    value: number,
    max: number,
    color: string,
  ) => {
    image(s, ctx, "icons/" + name + ".png", x, 16, C.ICON_SIZE, C.ICON_SIZE);
    text(ctx, name.toUpperCase(), x + 31, 21, 11, muted);
    text(ctx, Math.ceil(value) + " / " + max, x + 31, 39, 14, color);
    ctx.fillStyle = "#243c47";
    ctx.fillRect(x + 114, 18, 72, 18);
    ctx.fillStyle = color;
    ctx.fillRect(x + 114, 18, 72 * Math.min(1, value / max), 18);
  };
  gauge(
    17,
    "fuel",
    s.miner.fuel,
    maxFuel(s),
    s.miner.fuel / maxFuel(s) < C.LOW_FUEL_FRACTION ? "#f38d73" : gold,
  );
  gauge(
    220,
    "hull",
    s.miner.hull,
    maxHull(s),
    s.miner.hull / maxHull(s) < C.LOW_HULL_FRACTION ? "#f38d73" : "#8dcabb",
  );
  image(s, ctx, "icons/cargo.png", 425, 16, 24, 24);
  text(
    ctx,
    loadKg(s) >= lift(s)
      ? C.OVERLOAD
      : "CARGO  " + slots(s) + "/" + C.CARGO_TIERS[s.tiers.cargo - 1],
    457,
    23,
    13,
    slots(s) >= C.CARGO_TIERS[s.tiers.cargo - 1] ? "#f38d73" : paper,
  );
  text(ctx, loadKg(s) + " kg / " + lift(s), 457, 41, 11, muted);
  image(s, ctx, "icons/credits.png", 609, 16, 24, 24);
  text(ctx, s.credits.toLocaleString(), 642, 33, 18, gold);
  image(s, ctx, "icons/depth.png", 733, 16, 24, 24);
  text(ctx, Math.floor(depth(s)) + " m", 765, 33, 18, paper);
  for (const [i, id] of C.MATERIALS.entries()) {
    image(s, ctx, "icons/" + id + ".png", 860 + i * 53, 16, 24, 24);
    text(ctx, String(s.satchel[id]), 886 + i * 53, 33, 13, muted);
  }
}
function button(
  ctx: CanvasRenderingContext2D,
  label: string,
  r: Rect,
  active: boolean,
  enabled = true,
  detail = "",
): void {
  active = active && enabled;
  box(
    ctx,
    r,
    active ? "#e8b776" : enabled ? "#18313e" : "#142631",
    active ? gold : "#34505c",
  );
  const compact = r.w < 400 && !!detail,
    small = r.w < 100;
  text(
    ctx,
    label,
    r.x + (small ? 7 : 18),
    compact ? r.y + 14 : r.y + r.h / 2 + 6,
    compact ? 12 : small ? 11 : 15,
    active ? ink : enabled ? paper : "#62777e",
  );
  if (compact) {
    text(ctx, detail, r.x + 18, r.y + 28, 10, active ? ink : muted);
    return;
  }
  if (detail) {
    ctx.textAlign = "right";
    text(
      ctx,
      detail,
      r.x + r.w - 15,
      r.y + r.h / 2 + 5,
      13,
      active ? ink : muted,
    );
    ctx.textAlign = "left";
  }
}
function supplyIcon(
  ctx: CanvasRenderingContext2D,
  id: C.ItemId,
  x: number,
  y: number,
  color: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  if (id === "dynamite" || id === "plastic-explosives") {
    for (let i = 0; i < (id === "dynamite" ? 2 : 3); i++) {
      ctx.strokeRect(i * 5, 5, 4, 15);
      ctx.fillRect(i * 5, 11, 4, 3);
    }
    ctx.beginPath();
    ctx.moveTo(7, 5);
    ctx.lineTo(11, 0);
    ctx.lineTo(17, 2);
    ctx.stroke();
  } else if (id === "nanobots") {
    ctx.fillRect(8, 1, 5, 19);
    ctx.fillRect(1, 8, 19, 5);
  } else if (id === "emergency-fuel") {
    ctx.strokeRect(3, 5, 15, 16);
    ctx.fillRect(7, 1, 7, 4);
    ctx.fillRect(7, 10, 7, 6);
  } else {
    ctx.beginPath();
    ctx.arc(10, 11, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, 2);
    ctx.lineTo(5, 13);
    ctx.lineTo(12, 11);
    ctx.lineTo(10, 20);
    ctx.stroke();
    if (id === "matter-transmitter") ctx.strokeRect(0, 1, 20, 20);
  }
  ctx.restore();
}
function panel(s: ReadState, ctx: CanvasRenderingContext2D): void {
  box(ctx, { x: 0, y: C.HUD_H, w: C.STAGE_W, h: C.VIEW_H }, "#07121bd9");
  box(ctx, { x: 218, y: 109, w: 844, h: 560 }, "#10242f", "#4e6972");
  text(ctx, "SURFACE OPERATIONS  /  DEEPCORE", 246, 139, 11, gold);
  text(
    ctx,
    s.panel!.replace(/-/g, " ").toUpperCase(),
    246,
    180,
    30,
    paper,
    "sans-serif",
  );
  let sub =
    cargoDescription(s) + (loadKg(s) >= lift(s) ? "   ·   " + C.OVERLOAD : "");
  if (s.panel === "upgrade-shop")
    sub = "Invest in the return journey. Upgrades apply immediately.";
  if (s.panel === "fuel-depot")
    sub =
      "Fuel " +
      Math.ceil(s.miner.fuel) +
      "/" +
      maxFuel(s) +
      "   ·   Hull " +
      Math.ceil(s.miner.hull) +
      "/" +
      maxHull(s) +
      "   ·   " +
      s.credits +
      " Credits";
  if (s.panel === "supply-depot")
    sub = "Field supplies  ·  Use hotkeys 1–6 anywhere";
  text(ctx, sub, 246, 588, 14, muted);
  if (s.panel === "launch-pad") {
    C.ROCKET_COMPONENTS.forEach((c, i) =>
      text(
        ctx,
        (i < s.installed ? "✓ " : "○ ") +
          c.name +
          "  /  " +
          c.credits +
          " Cr" +
          (c.material ? " + " + c.material : ""),
        265,
        300 + i * 43,
        18,
        i < s.installed ? "#8dcabb" : muted,
      ),
    );
  }
  if (s.panel === "ore-market") {
    const held = C.MINERALS.filter((o) => s.cargo[o.id]);
    held.forEach((o, i) =>
      text(
        ctx,
        o.name +
          " ×" +
          s.cargo[o.id] +
          "  ·  " +
          (s.cargo[o.id] ?? 0) * o.value +
          " Cr",
        260 + (i % 3) * 252,
        294 + Math.floor(i / 3) * 44,
        15,
        muted,
      ),
    );
    if (!held.length)
      text(ctx, "Empty hold. Find mineral veins below.", 265, 315, 18, muted);
  }
  if (
    s.panel === "inventory" &&
    slots(s) === 0 &&
    C.ITEM_IDS.every((id) => s.items[id] === 0) &&
    !s.satchel.coreSample
  ) {
    image(s, ctx, "icons/cargo.png", 610, 305, 60, 60);
    text(ctx, "HOLD EMPTY", 573, 410, 22, paper);
    text(ctx, "Drill mineral veins to collect ore.", 439, 447, 17, muted);
    text(
      ctx,
      "Watch your weight. Every kilogram costs fuel on the climb.",
      327,
      475,
      14,
      muted,
    );
  }
  if (s.panel === "inventory")
    text(
      ctx,
      "SATCHEL  ·  Resonite " +
        s.satchel.resonite +
        "  ·  Cryenite " +
        s.satchel.cryenite +
        "  ·  Core " +
        (s.satchel.coreSample ? "LIVE" : "—"),
      246,
      562,
      14,
      gold,
    );
  controls(s)
    .filter(
      (c) => !["inventory", "pause", "mute", "dismiss-notice"].includes(c.id),
    )
    .forEach((c, i) => {
      const item = C.ITEM_IDS.includes(c.subject as C.ItemId);
      button(
        ctx,
        (item ? "    " : "") + c.label,
        c.rect,
        s.panelIndex === i,
        c.enabled,
        c.detail,
      );
      if (item)
        supplyIcon(
          ctx,
          c.subject as C.ItemId,
          c.rect.x + 12,
          c.rect.y + 10,
          s.panelIndex === i && c.enabled ? ink : gold,
        );
    });
}
function titleArt(s: ReadState, ctx: CanvasRenderingContext2D): void {
  image(s, ctx, "surface/sky.png", 590, 0, 960, 480);
  const bands = C.BANDS;
  for (let row = 0; row < 10; row++)
    for (let col = 0; col < 9; col++) {
      const x = 640 + col * C.TILE,
        y = 118 + row * C.TILE;
      if (col === 2 || (col === 3 && row > 3) || (col === 4 && row > 5)) {
        image(s, ctx, "tiles/tunnel.png", x, y, C.TILE, C.TILE);
        continue;
      }
      image(
        s,
        ctx,
        `tiles/${bands[Math.min(3, Math.floor(row / 3))]}-${(row + col) % 3}.png`,
        x,
        y,
        C.TILE,
        C.TILE,
      );
      if ((row * 7 + col * 3) % 11 === 0)
        image(
          s,
          ctx,
          "ore/" + C.ORE_IDS[Math.min(9, row)] + ".png",
          x,
          y,
          C.TILE,
          C.TILE,
        );
    }
  image(s, ctx, "surface/cave-mouth.png", 724, -28, 220, 150);
  miner(s, ctx, 818, 289, 1.65);
  image(s, ctx, "materials/resonite.png", 1070, 337, 80, 80);
  image(s, ctx, "materials/cryenite.png", 1152, 572, 80, 80);
  const g = ctx.createLinearGradient(540, 0, 950, 0);
  g.addColorStop(0, ink);
  g.addColorStop(1, "#0d1b2500");
  ctx.fillStyle = g;
  ctx.fillRect(540, 0, 410, 720);
  ctx.fillStyle = "#08141b66";
  ctx.fillRect(640, 0, 640, 720);
  text(ctx, "01 / THE DESCENT", 1010, 52, 12, gold);
  text(ctx, "DEPTH IS CHEAP.", 800, 640, 21, paper, "sans-serif");
  text(ctx, "HEIGHT IS EXPENSIVE.", 800, 670, 21, gold, "sans-serif");
}
export function render(s: ReadState, api: RenderApi): void {
  const ctx = api.ctx;
  ctx.imageSmoothingEnabled = false;
  if (["in-mine", "paused", "victory", "game-over"].includes(s.screen)) {
    world(s, ctx);
    hud(s, ctx);
  } else {
    box(ctx, { x: 0, y: 0, w: 1280, h: 720 }, ink);
    titleArt(s, ctx);
  }
  if (s.screen === "in-mine") {
    for (const c of controls(s).filter((c) =>
      ["inventory", "pause", "mute"].includes(c.id),
    ))
      button(ctx, c.label, c.rect, false);
    const scan = scanner(s);
    if (scan.locked)
      text(
        ctx,
        "SCAN  " +
          scan.target!.toUpperCase() +
          "  " +
          scan.distanceTiles!.toFixed(1) +
          " tiles  " +
          (scan.dirY > 0 ? "↓" : "↑") +
          (scan.dirX > 0 ? " →" : " ←"),
        32,
        93,
        16,
        "#8de5c7",
      );
    if (s.satchel.coreSample) {
      box(ctx, { x: 440, y: 75, w: 400, h: 56 }, "#562f32", "#edb476");
      text(
        ctx,
        "CORE  " + (s.coreTimer ?? 0).toFixed(1) + "s    [J] JETTISON",
        461,
        109,
        21,
        gold,
      );
    }
    if (s.panel) panel(s, ctx);
    else {
      text(
        ctx,
        "A D  MOVE    S  DRILL    W / SPACE  THRUST    I  CARGO",
        26,
        695,
        12,
        muted,
      );
      const p = position(s);
      text(
        ctx,
        (tile(s, p.col, Math.max(1, p.row)).band ?? "SURFACE").toUpperCase() +
          "  /  " +
          s.worldSize.toUpperCase(),
        970,
        695,
        12,
        muted,
      );
    }
    if (s.noteTime > 0) {
      box(ctx, { x: 394, y: 137, w: 492, h: 36 }, "#102630e8", "#4e6a70");
      ctx.textAlign = "center";
      text(ctx, s.note, 640, 160, 14, gold);
      ctx.textAlign = "left";
    }
    if (s.notice && s.notice.age >= C.NOTICE_DELAY) {
      box(ctx, { x: 320, y: 583, w: 640, h: 100 }, "#263842f5", "#cfab75");
      text(
        ctx,
        s.notice.hazard === "gas" ? "GAS POCKET DETONATED" : "LAVA CONTACT",
        345,
        615,
        18,
        gold,
      );
      text(
        ctx,
        s.notice.hazard === "gas"
          ? "Watch for pale seeps. Upgrade your hull before going deeper."
          : "Avoid molten seams. A radiator reduces heat damage.",
        345,
        643,
        14,
        paper,
      );
      text(
        ctx,
        "Click to dismiss · the mine keeps running",
        345,
        666,
        11,
        muted,
      );
    }
    return;
  }
  if (["paused", "victory", "game-over"].includes(s.screen))
    box(ctx, { x: 0, y: 56, w: 1280, h: 664 }, "#07131be8");
  text(ctx, "D / C     EXPEDITION SYSTEMS", 104, 87, 13, gold);
  const headings: Record<string, string> = {
    title: C.TITLE_TEXT,
    "mode-select": "CHOOSE YOUR RISK",
    "size-select": "CHOOSE YOUR DEPTH",
    "how-to-play": "THE WAY HOME",
    paused: "HOLD POSITION",
    victory: "FREE OF THE CORE",
    "game-over": "SIGNAL LOST",
  };
  text(
    ctx,
    headings[s.screen],
    100,
    210,
    s.screen === "title" ? 76 : 44,
    paper,
    "sans-serif",
  );
  if (s.screen === "title") {
    text(ctx, "A SUBTERRANEAN SURVIVAL EXPEDITION", 105, 254, 14, gold);
    text(
      ctx,
      "Dig deep. Build your escape.",
      104,
      305,
      23,
      muted,
      "sans-serif",
    );
    text(ctx, "ONE MINER. ONE ROCKET. A WORLD BETWEEN.", 104, 651, 12, muted);
  } else if (s.screen === "mode-select") {
    text(
      ctx,
      "STANDARD   ·   Restore your last save after death.",
      104,
      269,
      15,
      muted,
    );
    text(
      ctx,
      "HARDCORE   ·   Death deletes the save. One chance.",
      104,
      302,
      15,
      gold,
    );
  } else if (s.screen === "size-select") {
    text(
      ctx,
      "QUICK  1250m  /  STANDARD  2500m  /  MARATHON  5000m",
      104,
      279,
      14,
      muted,
    );
  } else if (s.screen === "how-to-play") {
    const lines = [
      "Build five rocket components, then launch from the camp.",
      "A/D walk · S drills down · W/Space fires the jetpack.",
      "Drill left, right or down while grounded. Never upward.",
      "Find ore veins, climb home, sell, refuel, and upgrade.",
      "Cargo has slots AND weight: overload prevents lift.",
      "I opens cargo; drop ore to shed weight. E opens buildings.",
      "Gas seeps warn of explosions. Lava burns. Brake your falls.",
      "Buy a scanner to find Resonite and Cryenite for the rocket.",
      "The Core Sample is unstable: return to ignition in 90 seconds.",
      "Save only at the Save Pad. Standard restores; Hardcore ends.",
    ];
    lines.forEach((line, i) =>
      text(ctx, line, 104, 260 + i * 29, 15, i % 3 === 0 ? gold : muted),
    );
  } else if (s.summary) {
    text(
      ctx,
      "DEEPEST  " +
        Math.floor(s.summary.deepestDepthMeters) +
        " m   /   EARNED  " +
        s.summary.creditsEarned +
        " Cr",
      104,
      273,
      17,
      gold,
    );
    text(
      ctx,
      "TIME  " +
        Math.floor(s.summary.elapsedSeconds / 60) +
        "m " +
        Math.floor(s.summary.elapsedSeconds % 60) +
        "s   /   COMPONENTS  " +
        s.summary.componentsInstalled +
        "/5",
      104,
      305,
      16,
      muted,
    );
  }
  menu(s).forEach((item, i) => {
    const rect =
      s.screen === "how-to-play" ? { ...menuRect(i), y: 590 } : menuRect(i);
    button(
      ctx,
      item,
      rect,
      s.menuIndex === i,
      true,
      s.menuIndex === i ? "↵" : "",
    );
  });
  text(ctx, "↑ ↓ SELECT     ENTER CONFIRM     ESC BACK", 104, 704, 11, muted);
}
