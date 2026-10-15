import * as C from "./constants";
import type { DeepReadonly } from "ts-essentials";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";

export interface Cell {
  kind: C.TileKind;
  band: C.BandName | null;
  ore: C.OreId | null;
  material: C.MaterialId | null;
  health: number | null;
  maxHealth: number | null;
}
export interface Effect {
  name: string;
  x: number;
  y: number;
  age: number;
  seed: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface DeepcoreState {
  screen: C.ScreenName;
  panel: C.PanelId | null;
  mode: C.Mode;
  worldSize: C.WorldSize;
  coreRow: number;
  menuIndex: number;
  panelIndex: number;
  muted: boolean;
  simTime: number;
  elapsedSeconds: number;
  hasSave: boolean;
  credits: number;
  creditsEarned: number;
  deepestDepthMeters: number;
  coreTimer: number | null;
  coreGround: { col: number; row: number } | null;
  camera: { x: number; y: number; lead: number };
  miner: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    facing: C.Facing;
    state: C.MinerState;
    travel: boolean;
    drill: boolean;
    fuel: number;
    hull: number;
    drilling: {
      col: number;
      row: number;
      dir: "down" | "left" | "right";
    } | null;
  };
  cargo: Partial<Record<C.OreId, number>>;
  satchel: { resonite: number; cryenite: number; coreSample: boolean };
  tiers: Record<C.TrackName, number>;
  items: Record<C.ItemId, number>;
  nextTeleportHeight: number | null;
  nextTeleportSpeed: number | null;
  installed: number;
  noticesFired: Record<C.NoticeHazard, boolean>;
  notice: { hazard: C.NoticeHazard; age: number } | null;
  summary: {
    deepestDepthMeters: number;
    creditsEarned: number;
    elapsedSeconds: number;
    mode: C.Mode;
    componentsInstalled: number;
    deathCause: C.DeathCause | null;
  } | null;
  grid: Cell[][];
  images: Record<string, ImageBitmap>;
  systems: Record<string, ParticleSystem>;
  effects: Effect[];
  cues: string[];
  note: string;
  noteTime: number;
  hurt: number;
  shake: number;
  hitTime: number;
  accumulator: number;
  animationTime: number;
  launchTime: number;
  pointerStart: string | null;
  lastPointer: { x: number; y: number };
}
export type ReadState = DeepReadonly<DeepcoreState>;
export const clamp = (n: number, a: number, b: number) =>
  Math.max(a, Math.min(b, n));
export const bandAt = (row: number, coreRow: number) =>
  C.BANDS[Math.min(3, Math.floor((4 * (row - 1)) / (coreRow - 1)))];
export function cell(
  kind: C.TileKind,
  band: C.BandName | null,
  ore: C.OreId | null = null,
  material: C.MaterialId | null = null,
): Cell {
  const health =
    ["rock", "ore", "material", "gas", "lava"].includes(kind) && band
      ? C.BAND_HEALTH[band]
      : null;
  return { kind, band, ore, material, health, maxHealth: health };
}
export function emptyGrid(coreRow: number): Cell[][] {
  return Array.from({ length: coreRow + 1 }, (_, row) =>
    Array.from({ length: C.WORLD_COLS }, (_, col) =>
      cell(
        row === 0
          ? "tunnel"
          : row === coreRow
            ? col === C.CORE_COL
              ? "core"
              : "bedrock"
            : col === 0 || col === C.WORLD_COLS - 1
              ? "bedrock"
              : "tunnel",
        row > 0 && row < coreRow ? bandAt(row, coreRow) : null,
      ),
    ),
  );
}
export function tile(s: ReadState, col: number, row: number): Cell {
  return (s.grid[row]?.[col] as Cell) ?? cell("bedrock", null);
}
export function copy(s: ReadState): DeepcoreState {
  return {
    ...s,
    miner: {
      ...s.miner,
      drilling: s.miner.drilling ? { ...s.miner.drilling } : null,
    },
    camera: { ...s.camera },
    cargo: { ...s.cargo },
    satchel: { ...s.satchel },
    tiers: { ...s.tiers },
    items: { ...s.items },
    noticesFired: { ...s.noticesFired },
    notice: s.notice ? { ...s.notice } : null,
    grid: s.grid.map((r) => r as Cell[]),
    effects: s.effects.map((e) => ({ ...e })),
    cues: [...s.cues],
    images: s.images as Record<string, ImageBitmap>,
    systems: s.systems as Record<string, ParticleSystem>,
    summary: s.summary ? { ...s.summary } : null,
    coreGround: s.coreGround ? { ...s.coreGround } : null,
  };
}
export function put(s: DeepcoreState, col: number, row: number, c: Cell): void {
  s.grid[row] = [...s.grid[row]];
  s.grid[row][col] = c;
}
export const position = (s: ReadState) => ({
  col: Math.floor((s.miner.x + C.MINER_W / 2) / C.TILE),
  row: Math.max(0, Math.floor((s.miner.y + C.MINER_H / 2) / C.TILE)),
});
export const maxFuel = (s: ReadState) => C.FUEL_TIERS[s.tiers.fuel - 1];
export const maxHull = (s: ReadState) => C.HULL_TIERS[s.tiers.hull - 1];
export const slots = (s: ReadState) =>
  Object.values(s.cargo).reduce((a, b) => a + (b ?? 0), 0);
export const loadKg = (s: ReadState) =>
  C.MINERALS.reduce((a, o) => a + (s.cargo[o.id] ?? 0) * o.weightKg, 0);
export const lift = (s: ReadState) =>
  C.JETPACK_TIERS[s.tiers.jetpack - 1].liftLimitKg;
export const depth = (s: ReadState) =>
  Math.max(
    0,
    ((s.miner.y + C.MINER_H - C.SURFACE_Y) / C.TILE) * C.METERS_PER_ROW,
  );
export function grounded(s: ReadState): boolean {
  const feet = s.miner.y + C.MINER_H;
  const row = Math.floor((feet + 0.01) / C.TILE);
  return (
    Math.abs(feet - row * C.TILE) < 0.1 &&
    [s.miner.x + 0.1, s.miner.x + C.MINER_W - 0.1].some(
      (x) => row > 0 && tile(s, Math.floor(x / C.TILE), row).kind !== "tunnel",
    )
  );
}
export const BUILDING_RECTS = C.BUILDINGS.map((id, i) => ({
  id,
  x: 160 + i * 320,
  y: C.SURFACE_Y - 150,
  w: 220,
  h: 150,
}));
export function blank(
  images: Record<string, ImageBitmap> = {},
  systems: Record<string, ParticleSystem> = {},
): DeepcoreState {
  return {
    screen: "title",
    panel: null,
    mode: "standard",
    worldSize: "standard",
    coreRow: C.STANDARD_ROWS,
    menuIndex: 0,
    panelIndex: 0,
    muted: false,
    simTime: 0,
    elapsedSeconds: 0,
    hasSave: hasSave(),
    credits: 0,
    creditsEarned: 0,
    deepestDepthMeters: 0,
    coreTimer: null,
    coreGround: null,
    camera: { x: 0, y: -300, lead: 0 },
    miner: {
      x: C.SPAWN_COL * C.TILE + (C.TILE - C.MINER_W) / 2,
      y: C.SURFACE_Y - C.MINER_H,
      vx: 0,
      vy: 0,
      facing: "east",
      state: "idle",
      travel: true,
      drill: true,
      fuel: C.FUEL_TIERS[0],
      hull: C.HULL_TIERS[0],
      drilling: null,
    },
    cargo: {},
    satchel: { resonite: 0, cryenite: 0, coreSample: false },
    tiers: Object.fromEntries(C.TRACKS.map((t) => [t, 1])) as Record<
      C.TrackName,
      number
    >,
    items: Object.fromEntries(C.ITEM_IDS.map((t) => [t, 0])) as Record<
      C.ItemId,
      number
    >,
    nextTeleportHeight: null,
    nextTeleportSpeed: null,
    installed: 0,
    noticesFired: { gas: false, lava: false },
    notice: null,
    summary: null,
    grid: emptyGrid(C.STANDARD_ROWS),
    images,
    systems,
    effects: [],
    cues: [],
    note: "",
    noteTime: 0,
    hurt: 0,
    shake: 0,
    hitTime: 0,
    accumulator: 0,
    animationTime: 0,
    launchTime: 0,
    pointerStart: null,
    lastPointer: { x: -1, y: -1 },
  };
}
const SAVE_KEY = "deepcore.expedition.v1";
export function hasSave(): boolean {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}
export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* Storage is optional. */
  }
}
export function note(s: DeepcoreState, text: string): void {
  s.note = text;
  s.noteTime = 3;
}
export function fx(
  s: DeepcoreState,
  name: string,
  x = s.miner.x + C.MINER_W / 2,
  y = s.miner.y + C.MINER_H / 2,
): void {
  s.effects.push({ name, x, y, age: 0, seed: Math.floor(Math.random() * 1e8) });
}
export function generate(s: DeepcoreState): void {
  s.grid = emptyGrid(s.coreRow);
  // Random walks make contiguous veins; independent passes maintain a steady density.
  for (let row = 1; row < s.coreRow; row++)
    for (let col = 1; col < C.WORLD_COLS - 1; col++)
      s.grid[row][col] = cell("rock", bandAt(row, s.coreRow));
  for (let b = 0; b < 4; b++) {
    const rows = Array.from({ length: s.coreRow - 1 }, (_, i) => i + 1).filter(
      (r) => C.BANDS.indexOf(bandAt(r, s.coreRow)) === b,
    );
    const lo = rows[0],
      hi = rows[rows.length - 1],
      count = rows.length * (C.WORLD_COLS - 2);
    const place = (kind: C.TileKind, n: number, cluster: boolean) => {
      let done = 0,
        col = 2,
        row = lo;
      while (done < Math.round(n)) {
        if (!cluster || Math.random() < 0.3) {
          col = 1 + Math.floor(Math.random() * 30);
          row = lo + Math.floor(Math.random() * rows.length);
        } else {
          if (Math.random() < 0.5)
            col = clamp(col + (Math.random() < 0.5 ? -1 : 1), 1, 30);
          else row = clamp(row + (Math.random() < 0.5 ? -1 : 1), lo, hi);
        }
        if (
          s.grid[row][col].kind !== "rock" ||
          col === C.CAVE_MOUTH_COL ||
          col === C.CORE_COL
        )
          continue;
        let ore: C.OreId | null = null;
        if (kind === "ore") {
          const f = (row - 1) / (s.coreRow - 1);
          const weights = C.MINERALS.map(
            (o) => o.pick * Math.max(0, 1 - Math.abs(f - o.peak) / o.spread),
          );
          let draw = Math.random() * weights.reduce((a, v) => a + v, 0);
          let idx = 0;
          while (idx < weights.length - 1 && (draw -= weights[idx]) > 0) idx++;
          ore = C.MINERALS[idx].id;
          if (row < C.ORE_MIN_ROW) continue;
        }
        s.grid[row][col] = cell(kind, C.BANDS[b], ore);
        done++;
      }
    };
    const mid = ((lo + hi) / 2 - 1) / (s.coreRow - 1);
    if (b > 0) {
      const f = (mid - 0.25) / 0.75;
      place(
        "stone",
        count *
          (C.STONE_DENSITY_MIN +
            (C.STONE_DENSITY_MAX - C.STONE_DENSITY_MIN) * f),
        false,
      );
      place(
        "gas",
        count *
          (C.GAS_DENSITY_MIN + (C.GAS_DENSITY_MAX - C.GAS_DENSITY_MIN) * f),
        false,
      );
    }
    if (b > 1)
      place(
        "lava",
        count *
          (C.LAVA_DENSITY_MIN +
            ((C.LAVA_DENSITY_MAX - C.LAVA_DENSITY_MIN) * (mid - 0.5)) / 0.5),
        true,
      );
    place("ore", count * C.ORE_DENSITY, true);
  }
  for (const material of C.MATERIALS) {
    const rows = s.grid
      .map((_, r) => r)
      .filter(
        (r) =>
          r > 0 &&
          r < s.coreRow &&
          bandAt(r, s.coreRow) === C.MATERIAL_BAND[material],
      );
    const row = rows[Math.floor(Math.random() * rows.length)],
      col = 2 + Math.floor(Math.random() * 28);
    s.grid[row][col] = cell(
      "material",
      C.MATERIAL_BAND[material],
      null,
      material,
    );
    // A guaranteed horizontal access corridor of diggable rock connects the safe shaft.
    for (
      let c = Math.min(col, C.CAVE_MOUTH_COL);
      c <= Math.max(col, C.CAVE_MOUTH_COL);
      c++
    )
      if (["lava", "stone"].includes(s.grid[row][c].kind))
        s.grid[row][c] = cell("rock", bandAt(row, s.coreRow));
  }
  for (let col = C.CORE_COL; col <= C.CAVE_MOUTH_COL; col++)
    if (["lava", "stone"].includes(s.grid[s.coreRow - 1][col].kind))
      s.grid[s.coreRow - 1][col] = cell(
        "rock",
        bandAt(s.coreRow - 1, s.coreRow),
      );
  s.grid[1][C.CAVE_MOUTH_COL] = cell("tunnel", "topsoil");
}
export function start(s: ReadState): DeepcoreState {
  const n = blank(
    s.images as Record<string, ImageBitmap>,
    s.systems as Record<string, ParticleSystem>,
  );
  n.mode = s.mode;
  n.worldSize = s.worldSize;
  n.coreRow = Math.round(C.STANDARD_ROWS * C.WORLD_SIZE_SCALE[n.worldSize]);
  n.muted = s.muted;
  n.simTime = s.simTime;
  n.screen = "in-mine";
  n.grid = emptyGrid(n.coreRow);
  clearSave();
  n.hasSave = false;
  generate(n);
  return n;
}
export function save(s: DeepcoreState): void {
  if (s.coreTimer !== null) {
    note(s, "Cannot save while a Core Sample is unstable.");
    return;
  }
  try {
    const { images: _images, systems: _systems, ...data } = s;
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    s.hasSave = true;
    note(s, "Expedition secured at Save Pad.");
  } catch {
    note(s, "Storage unavailable — expedition could not be saved.");
  }
}
export function restore(s: ReadState): DeepcoreState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return copy(s);
    const n = {
      ...JSON.parse(raw),
      images: s.images,
      systems: s.systems,
    } as DeepcoreState;
    n.screen = "in-mine";
    n.panel = null;
    n.hasSave = true;
    n.muted = s.muted;
    n.simTime = s.simTime;
    n.miner = {
      ...n.miner,
      x: C.SPAWN_COL * C.TILE + (C.TILE - C.MINER_W) / 2,
      y: C.SURFACE_Y - C.MINER_H,
      vx: 0,
      vy: 0,
      drilling: null,
      state: "idle",
    };
    return n;
  } catch {
    return copy(s);
  }
}
export function scanner(s: ReadState) {
  const p = position(s),
    range = C.SCANNER_TIERS[s.tiers.scanner - 1];
  const none = {
    locked: false,
    target: null as C.MaterialId | null,
    dirX: 0,
    dirY: 0,
    distanceTiles: null as number | null,
  };
  if (range === null) return none;
  let best = Infinity,
    target: C.MaterialId | null = null,
    dx = 0,
    dy = 0;
  s.grid.forEach((row, r) =>
    row.forEach((c, col) => {
      if (c.material && s.satchel[c.material] === 0) {
        const d = Math.hypot(col - p.col, r - p.row);
        if (d < best) {
          best = d;
          target = c.material;
          dx = col - p.col;
          dy = r - p.row;
        }
      }
    }),
  );
  return best <= range
    ? {
        locked: true,
        target,
        dirX: dx / (best || 1),
        dirY: dy / (best || 1),
        distanceTiles: best,
      }
    : none;
}
export function snapshot(s: ReadState) {
  const m = s.miner,
    d = m.drilling,
    c = d ? tile(s, d.col, d.row) : null;
  return {
    version: C.DEEPCORE_DEBUG_VERSION,
    screen: s.screen,
    panel: s.panel,
    mode: s.mode,
    worldSize: s.worldSize,
    coreRow: s.coreRow,
    menuIndex: s.menuIndex,
    muted: s.muted,
    simTime: s.simTime,
    elapsedSeconds: s.elapsedSeconds,
    hasSave: s.hasSave,
    credits: s.credits,
    creditsEarned: s.creditsEarned,
    depthMeters: depth(s),
    deepestDepthMeters: s.deepestDepthMeters,
    coreTimer: s.coreTimer,
    coreGround: s.coreGround ? { ...s.coreGround } : null,
    camera: { ...s.camera },
    miner: {
      ...m,
      ...position(s),
      grounded: grounded(s),
      maxFuel: maxFuel(s),
      maxHull: maxHull(s),
      overloaded: loadKg(s) >= lift(s),
      drilling: d
        ? {
            ...d,
            progress: c?.health && c.maxHealth ? 1 - c.health / c.maxHealth : 0,
          }
        : null,
    },
    cargo: {
      slotsUsed: slots(s),
      slotCap: C.CARGO_TIERS[s.tiers.cargo - 1],
      loadKg: loadKg(s),
      liftLimitKg: lift(s),
      ore: Object.fromEntries(
        Object.entries(s.cargo).filter(([, n]) => n! > 0),
      ),
    },
    satchel: { ...s.satchel },
    tiers: { ...s.tiers },
    items: { ...s.items },
    nextTeleportHeight: s.nextTeleportHeight,
    nextTeleportSpeed: s.nextTeleportSpeed,
    rocket: {
      installed: C.ROCKET_COMPONENT_IDS.slice(0, s.installed),
      nextComponent: C.ROCKET_COMPONENT_IDS[s.installed] ?? null,
    },
    scanner: scanner(s),
    notice: s.notice
      ? {
          hazard: s.notice.hazard,
          shown:
            s.notice.age >= C.NOTICE_DELAY &&
            s.notice.age < C.NOTICE_DELAY + C.NOTICE_FADE,
        }
      : null,
    noticesFired: { ...s.noticesFired },
    summary: s.summary ? { ...s.summary } : null,
  };
}
