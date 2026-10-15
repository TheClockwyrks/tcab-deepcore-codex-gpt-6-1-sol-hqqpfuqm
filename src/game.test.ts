/// <reference types="node" />
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { readFile } from "node:fs/promises";
import {
  createEngine,
  ConstantClock,
  SequenceClock,
  type Clock,
} from "@clockwyrks/simple-2d";
import { game, assetPath } from "./game";
import * as C from "./constants";
import { generate, blank, scanner } from "./model";

beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    async (url: string) =>
      new Response(await readFile(url.split("?")[0].replace(/^\//, ""))),
  );
  vi.stubGlobal("createImageBitmap", async (blob: Blob) =>
    loadImage(Buffer.from(await blob.arrayBuffer())),
  );
  vi.stubGlobal(
    "AudioContext",
    class {
      async decodeAudioData() {
        return { duration: 1 };
      }
    },
  );
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
});
const engines: ReturnType<typeof createEngine>[] = [];
afterEach(() => {
  engines.splice(0).forEach((e) => e.destroy());
});
async function setup(clock: Clock = new ConstantClock(1000 / 60)) {
  const target = new EventTarget();
  const engine = createEngine({
    canvas: createCanvas(C.STAGE_W, C.STAGE_H) as unknown as HTMLCanvasElement,
    width: C.STAGE_W,
    height: C.STAGE_H,
    game,
    clock,
    surface: {
      cssWidth: () => C.STAGE_W,
      cssHeight: () => C.STAGE_H,
      dpr: () => 1,
      events: () => target,
    },
  });
  engines.push(engine);
  await engine.initialize();
  engine.apply((s) => engine.debug.clearSave(s));
  const key = (code: string, down = true) => {
    const event = new Event(down ? "keydown" : "keyup");
    Object.assign(event, { code, repeat: false });
    target.dispatchEvent(event);
  };
  const snap = () => engine.debug.snapshot(engine.state);
  return { engine, key, snap, d: engine.debug };
}
describe("engine integration", () => {
  it("normalizes Vite development and nested production URLs for the engine", () => {
    expect(assetPath("/assets/miner/idle/frame00.png")).toBe(
      "miner/idle/frame00.png",
    );
    expect(
      assetPath("http://localhost:4173/nested/game/assets/frame00-abcd.png"),
    ).toBe("frame00-abcd.png");
    expect(assetPath("./assets/frame00-abcd.png")).toBe("frame00-abcd.png");
  });
  it("operates panel rows with the keyboard while the mine menu index rests at zero", async () => {
    const { engine, d, key, snap } = await setup();
    engine.apply((s) => d.setScreen(s, "in-mine"));
    engine.apply((s) => d.setPanel(s, "fuel-depot"));
    engine.apply((s) => d.setCredits(s, 200));
    engine.apply((s) => d.setFuel(s, 10));
    key("ArrowDown");
    await engine.advance(1);
    key("ArrowDown", false);
    await engine.advance(1);
    key("Enter");
    await engine.advance(1);
    key("Enter", false);
    expect(snap().miner.fuel).toBe(100);
    expect(snap().credits).toBe(110);
    expect(snap().menuIndex).toBe(0);
  });
  it("loads all committed art and cue files, and navigates to a fresh quick expedition", async () => {
    const { engine, key, snap } = await setup();
    expect(Object.keys(engine.state.images).length).toBeGreaterThan(85);
    expect(Object.keys(engine.state.systems)).toHaveLength(12);
    for (let i = 0; i < 3; i++) {
      key("Enter");
      await engine.advance(1);
      key("Enter", false);
      await engine.advance(1);
    }
    expect(snap().screen).toBe("in-mine");
    expect(snap().coreRow).toBe(250);
    expect(snap().miner.grounded).toBe(true);
    const old = engine.state;
    key("KeyD");
    await engine.advance(30);
    expect(engine.state.miner.x).toBeGreaterThan(old.miner.x);
    expect(old.miner.x).toBe(C.SPAWN_COL * C.TILE + (C.TILE - C.MINER_W) / 2);
  });
  it("drills persistent health, spends hit fuel, and banks ore only on breaking", async () => {
    const { engine, d, key, snap } = await setup();
    engine.apply((s) => d.setScreen(s, "in-mine"));
    engine.apply((s) => d.setMinerTravel(s, false));
    engine.apply((s) => d.setOreTile(s, C.SPAWN_COL, 1, "ferron"));
    key("KeyS");
    await engine.advance(15);
    expect(d.tileAt(engine.state, C.SPAWN_COL, 1).health).toBe(2);
    expect(snap().cargo.slotsUsed).toBe(0);
    key("KeyS", false);
    await engine.advance(12);
    expect(d.tileAt(engine.state, C.SPAWN_COL, 1).health).toBe(2);
    key("KeyS");
    await engine.advance(15);
    expect(d.tileAt(engine.state, C.SPAWN_COL, 1).kind).toBe("tunnel");
    expect(snap().cargo.ore.ferron).toBe(1);
    expect(snap().miner.fuel).toBeCloseTo(99);
  });
  it("holds the body independently from its drill and leaves the previous grid immutable", async () => {
    const { engine, d, key } = await setup();
    engine.apply((s) => d.setScreen(s, "in-mine"));
    engine.apply((s) => d.setTile(s, 4, 1, "rock"));
    engine.apply((s) => d.setMinerTravel(s, false));
    const old = engine.state;
    key("KeyS");
    await engine.advance(15);
    expect(old.grid[1][4].health).toBe(4);
    expect(engine.state.grid[1][4].health).toBe(2);
    expect(engine.state.miner.y).toBe(old.miner.y);
    engine.apply((s) => d.setMinerDrill(s, false));
    await engine.advance(15);
    expect(engine.state.grid[1][4].health).toBe(2);
  });
  it("continues core time in inventory and checks empty hull there", async () => {
    const { engine, d, snap } = await setup();
    engine.apply((s) => d.setScreen(s, "in-mine"));
    engine.apply((s) => d.setCoreCarried(s, true));
    engine.apply((s) => d.setPanel(s, "inventory"));
    await engine.advance(60);
    expect(snap().coreTimer).toBeCloseTo(89);
    engine.apply((s) => d.setScreen(s, "paused"));
    await engine.advance(60);
    expect(snap().coreTimer).toBeCloseTo(89);
    engine.apply((s) => d.setScreen(s, "in-mine"));
    engine.apply((s) => d.setHull(s, 0));
    await engine.advance(1);
    expect(snap().screen).toBe("game-over");
    expect(snap().summary?.deathCause).toBe("hull-destroyed");
  });
  it("survives zero fuel at the surface and dies below ground", async () => {
    const { engine, d, snap } = await setup();
    engine.apply((s) => d.setScreen(s, "in-mine"));
    engine.apply((s) => d.setTile(s, 4, 1, "rock"));
    engine.apply((s) => d.setFuel(s, 0));
    await engine.advance(1);
    expect(snap().screen).toBe("in-mine");
    engine.apply((s) => d.setMinerPosition(s, 4 * C.TILE, 2 * C.TILE));
    await engine.advance(1);
    expect(snap().summary?.deathCause).toBe("fuel-out");
  });
  it("stops overloaded lift and allows ore jettison to restore it", async () => {
    const { engine, d, key, snap } = await setup();
    engine.apply((s) => d.setScreen(s, "in-mine"));
    engine.apply((s) => d.setCargo(s, "aurite", 4));
    engine.apply((s) => d.setMinerPosition(s, 500, -200));
    key("Space");
    await engine.advance(30);
    expect(snap().miner.vy).toBe(0);
    engine.apply((s) => d.dropOre(s, "aurite"));
    await engine.advance(30);
    expect(snap().miner.vy).toBeLessThan(0);
  });
  it("gets equal flight results from even and uneven frame clocks", async () => {
    const a = await setup(),
      b = await setup(new SequenceClock([5, 10, 35]));
    for (const t of [a, b]) {
      t.engine.apply((s) => t.d.setScreen(s, "in-mine"));
      t.engine.apply((s) => t.d.setMinerPosition(s, 500, -200));
      t.key("Space");
      await t.engine.advance(60);
    }
    expect(a.snap().miner.y).toBeCloseTo(b.snap().miner.y, 8);
    expect(a.snap().miner.fuel).toBeCloseTo(b.snap().miner.fuel, 8);
  });
  it("applies fall impact, gas damage and delayed nonblocking notices", async () => {
    const { engine, d, key, snap } = await setup();
    engine.apply((s) => d.setScreen(s, "in-mine"));
    engine.apply((s) => d.setTile(s, 4, 1, "rock"));
    engine.apply((s) => d.setMinerPosition(s, 4 * C.TILE, -10));
    engine.apply((s) => d.setMinerVelocity(s, 0, 900));
    await engine.advance(5);
    expect(snap().miner.hull).toBeLessThan(100);
    engine.apply((s) => d.setHull(s, 500));
    engine.apply((s) => d.setMinerPosition(s, 4 * C.TILE, 8));
    engine.apply((s) => d.setTile(s, 4, 1, "gas"));
    engine.apply((s) => d.setMinerTravel(s, false));
    key("KeyS");
    await engine.advance(30);
    expect(snap().noticesFired.gas).toBe(true);
    expect(snap().notice?.shown).toBe(false);
    await engine.advance(100);
    expect(snap().notice?.shown).toBe(true);
  });
  it("saves expedition holdings and restores them through the title menu", async () => {
    const { engine, d, key, snap } = await setup();
    engine.apply((s) => d.setScreen(s, "in-mine"));
    engine.apply((s) => d.setCredits(s, 777));
    engine.apply((s) => d.setCargo(s, "cuprite", 3));
    engine.apply((s) => d.save(s));
    expect(snap().hasSave).toBe(true);
    engine.apply((s) => d.setCredits(s, 1));
    engine.apply((s) => d.setScreen(s, "title"));
    engine.apply((s) => d.setMenuIndex(s, 0));
    key("Enter");
    await engine.advance(1);
    expect(snap().credits).toBe(777);
    expect(snap().cargo.ore.cuprite).toBe(3);
    engine.apply((s) => d.setCoreCarried(s, true));
    engine.apply((s) => d.save(s));
    expect(engine.state.note).toContain("Cannot save");
  });
});
describe("economy, supplies and instrumentation", () => {
  it("prices sales and repairs, and adds only tier capacity differences", async () => {
    const { engine, d, snap } = await setup();
    engine.apply((s) => d.setCargo(s, "cuprite", 10));
    engine.apply((s) => d.sell(s));
    expect(snap().credits).toBe(650);
    engine.apply((s) => d.setFuel(s, 30));
    engine.apply((s) => d.buyUpgrade(s, "fuel"));
    expect(snap().miner.fuel).toBe(105);
    expect(snap().credits).toBe(350);
    engine.apply((s) => d.fillFuel(s));
    expect(snap().miner.fuel).toBe(175);
    expect(snap().credits).toBe(280);
    engine.apply((s) => d.setHull(s, 80));
    engine.apply((s) => d.repairFull(s));
    expect(snap().credits).toBe(240);
    engine.apply((s) => d.buyItem(s, "dynamite"));
    expect(snap().items.dynamite).toBe(0);
  });
  it("blasts stone while protecting unique materials and destroying ore", async () => {
    const { engine, d, snap } = await setup();
    engine.apply((s) => d.setMinerPosition(s, 4 * C.TILE, 4 * C.TILE));
    engine.apply((s) => d.setTile(s, 4, 4, "stone"));
    engine.apply((s) => d.setOreTile(s, 5, 4, "ferron"));
    engine.apply((s) => d.setMaterialTile(s, 3, 4, "resonite"));
    engine.apply((s) => d.setItemCount(s, "dynamite", 1));
    engine.apply((s) => d.useItem(s, "dynamite"));
    expect(d.tileAt(engine.state, 4, 4).kind).toBe("tunnel");
    expect(d.tileAt(engine.state, 5, 4).kind).toBe("tunnel");
    expect(d.tileAt(engine.state, 3, 4).kind).toBe("material");
    expect(snap().cargo.slotsUsed).toBe(0);
  });
  it("consumes posed teleporter outcomes and does not consume a useless refill", async () => {
    const { engine, d, snap } = await setup();
    engine.apply((s) => d.setItemCount(s, "emergency-fuel", 1));
    engine.apply((s) => d.useItem(s, "emergency-fuel"));
    expect(snap().items["emergency-fuel"]).toBe(1);
    engine.apply((s) => d.setItemCount(s, "quantum-teleporter", 1));
    engine.apply((s) => d.setNextTeleportHeight(s, 8));
    engine.apply((s) => d.setNextTeleportSpeed(s, 700));
    engine.apply((s) => d.useItem(s, "quantum-teleporter"));
    expect(snap().miner.y).toBe(C.SURFACE_Y - C.MINER_H - 8 * C.TILE);
    expect(snap().miner.vy).toBe(700);
    expect(snap().nextTeleportHeight).toBeNull();
  });
  it("fabricates in order with the required materials and launches to a summary", async () => {
    const { engine, d, snap } = await setup();
    engine.apply((s) => d.setScreen(s, "in-mine"));
    engine.apply((s) => d.setCredits(s, C.ROCKET_TOTAL_CREDITS));
    engine.apply((s) => d.setMaterial(s, "resonite", 1));
    engine.apply((s) => d.setMaterial(s, "cryenite", 1));
    engine.apply((s) => d.setCoreCarried(s, true));
    for (let i = 0; i < 5; i++) engine.apply((s) => d.fabricate(s));
    expect(snap().credits).toBe(0);
    expect(snap().coreTimer).toBeNull();
    expect(snap().rocket.nextComponent).toBeNull();
    engine.apply((s) => d.launch(s));
    await engine.advance(181);
    expect(snap().screen).toBe("victory");
  });
  it("keeps resized cells and their original bands, and rejects invalid poses", async () => {
    const { engine, d } = await setup();
    engine.apply((s) => d.setWorldSize(s, "quick"));
    engine.apply((s) => d.setOreTile(s, 5, 150, "roselite"));
    engine.apply((s) => d.setTileHealth(s, 5, 150, 3));
    engine.apply((s) => d.setWorldSize(s, "marathon"));
    expect(d.tileAt(engine.state, 5, 150)).toMatchObject({
      ore: "roselite",
      band: "deepstone",
      health: 3,
    });
    expect(d.tileAt(engine.state, 16, 250).kind).toBe("tunnel");
    expect(d.tileAt(engine.state, 16, 1000).kind).toBe("core");
    expect(() => engine.apply((s) => d.setFuel(s, -1))).toThrow();
    expect(() => engine.apply((s) => d.setTier(s, "fuel", 6))).toThrow();
    expect(() => engine.apply((s) => d.setCoreTimer(s, 10))).toThrow();
  });
  it("produces sparse hazards, one material per band and a needed-material scanner lock", () => {
    const s = blank();
    generate(s);
    expect(s.grid.flat().filter((c) => c.material === "resonite")).toHaveLength(
      1,
    );
    expect(s.grid.flat().filter((c) => c.material === "cryenite")).toHaveLength(
      1,
    );
    const top = s.grid.slice(1, 126).flat();
    expect(top.some((c) => ["gas", "lava", "stone"].includes(c.kind))).toBe(
      false,
    );
    s.tiers.scanner = 3;
    const r = s.grid.findIndex((row) =>
      row.some((c) => c.material === "resonite"),
    );
    const c = s.grid[r].findIndex((c) => c.material === "resonite");
    s.miner.x = c * C.TILE;
    s.miner.y = r * C.TILE;
    expect(scanner(s).target).toBe("resonite");
    s.satchel.resonite = 1;
    expect(scanner(s).target).not.toBe("resonite");
  });
});
