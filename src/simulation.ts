import * as C from "./constants";
import {
  type DeepcoreState,
  type ReadState,
  tile,
  put,
  cell,
  copy,
  position,
  maxFuel,
  maxHull,
  slots,
  loadKg,
  lift,
  depth,
  grounded,
  note,
  fx,
  clearSave,
  save,
} from "./model";

export function damage(
  s: DeepcoreState,
  amount: number,
  hazard?: C.NoticeHazard,
): void {
  if (amount <= 0) return;
  s.miner.hull -= amount;
  s.hurt = C.HURT_TIME;
  if (hazard && !s.noticesFired[hazard]) {
    s.noticesFired[hazard] = true;
    s.notice = { hazard, age: 0 };
  }
}
export function end(s: DeepcoreState, cause: C.DeathCause | null): void {
  s.screen = cause ? "game-over" : "victory";
  if (cause) s.miner.state = cause === "fuel-out" ? "fuel-out" : "hurt";
  s.panel = null;
  s.menuIndex = 0;
  s.summary = {
    deepestDepthMeters: s.deepestDepthMeters,
    creditsEarned: s.creditsEarned,
    elapsedSeconds: s.elapsedSeconds,
    mode: s.mode,
    componentsInstalled: s.installed,
    deathCause: cause,
  };
  if (cause) {
    fx(s, "death-burst");
    s.cues.push(C.CUES.death);
    if (s.satchel.coreSample) {
      s.satchel.coreSample = false;
      s.coreTimer = null;
    }
  }
  if (!cause || s.mode === "hardcore") {
    clearSave();
    s.hasSave = false;
  }
}
function gas(s: DeepcoreState, col: number, row: number): void {
  const x = (col + 0.5) * C.TILE,
    y = (row + 0.5) * C.TILE,
    dx = s.miner.x + C.MINER_W / 2 - x,
    dy = s.miner.y + C.MINER_H / 2 - y,
    d = Math.hypot(dx, dy);
  fx(s, "gas-explosion", x, y);
  s.cues.push(C.CUES.gasExplosion);
  s.shake = 1;
  if (d <= C.GAS_BLAST_TILES * C.TILE) {
    const f = (row - 1) / (s.coreRow - 1);
    damage(
      s,
      C.GAS_DAMAGE_MIN +
        (C.GAS_DAMAGE_MAX - C.GAS_DAMAGE_MIN) * Math.max(0, (f - 0.25) / 0.75),
      "gas",
    );
    if (s.miner.travel) {
      s.miner.vx = (dx / (d || 1)) * C.GAS_KNOCKBACK;
      s.miner.vy = (dy / (d || 1)) * C.GAS_KNOCKBACK;
    }
  }
}
function breakTile(
  s: DeepcoreState,
  col: number,
  row: number,
  collect: boolean,
): void {
  const c = tile(s, col, row),
    x = (col + 0.5) * C.TILE,
    y = (row + 0.5) * C.TILE;
  put(s, col, row, cell("tunnel", c.band));
  if (c.kind === "gas") gas(s, col, row);
  if (!collect) return;
  if (c.ore) {
    if (slots(s) < C.CARGO_TIERS[s.tiers.cargo - 1]) {
      s.cargo[c.ore] = (s.cargo[c.ore] ?? 0) + 1;
      fx(s, "ore-sparkle", x, y);
      s.cues.push(C.CUES.orePickup);
      note(s, "+ " + C.MINERALS.find((o) => o.id === c.ore)!.name);
    } else note(s, "Cargo full — ore left behind.");
  }
  if (c.material) {
    s.satchel[c.material]++;
    fx(s, "material-shimmer", x, y);
    s.cues.push(C.CUES.materialChime);
    note(s, c.material.toUpperCase() + " recovered");
  }
  if (c.kind === "lava") {
    damage(
      s,
      (c.band === "coreshell"
        ? C.LAVA_DRILL_CORESHELL
        : C.LAVA_DRILL_DEEPSTONE) *
        (1 - C.RADIATOR_TIERS[s.tiers.radiator - 1]),
      "lava",
    );
    fx(s, "lava-embers", x, y);
    s.cues.push(C.CUES.lavaSizzle);
  }
}
export function transact(
  s: ReadState,
  action: string,
  subject: string | null = null,
): DeepcoreState {
  const n = copy(s),
    m = n.miner;
  const confirm = () => {
    n.cues.push(C.CUES.fabricate);
    note(n, "Transaction complete.");
  };
  switch (action) {
    case "sell": {
      const value = C.MINERALS.reduce(
        (a, o) => a + (n.cargo[o.id] ?? 0) * o.value,
        0,
      );
      n.credits += value;
      n.creditsEarned += value;
      n.cargo = {};
      if (value) confirm();
      note(n, value ? value + " Credits banked." : "Cargo bay is empty.");
      break;
    }
    case "drop-ore": {
      const id = subject as C.OreId;
      if (!C.MINERALS.some((o) => o.id === id)) throw Error("Unknown ore");
      if (n.cargo[id]) n.cargo[id]!--;
      break;
    }
    case "buy-fuel":
    case "fill-fuel":
    case "buy-repair":
    case "repair-full": {
      const fuel = action.includes("fuel"),
        max = fuel ? maxFuel(n) : maxHull(n),
        held = fuel ? m.fuel : m.hull,
        price = fuel ? C.FUEL_PRICE : C.REPAIR_PRICE;
      const qty = Math.max(
        0,
        Math.min(
          max - held,
          n.credits / price,
          action === "buy-fuel"
            ? C.FUEL_BUY_INCREMENT
            : action === "buy-repair"
              ? C.REPAIR_BUY_INCREMENT
              : Infinity,
        ),
      );
      if (qty) {
        n.credits -= qty * price;
        if (fuel) m.fuel += qty;
        else m.hull += qty;
        confirm();
      } else note(n, "No purchase available.");
      break;
    }
    case "buy-upgrade": {
      const track = subject as C.TrackName;
      if (!C.TRACKS.includes(track)) throw Error("Unknown track");
      const tier = n.tiers[track],
        price = C.UPGRADE_PRICES[tier - 1];
      if (tier < C.MAX_TIER[track] && n.credits >= price) {
        const f = maxFuel(n),
          h = maxHull(n);
        n.credits -= price;
        n.tiers[track]++;
        m.fuel += maxFuel(n) - f;
        m.hull += maxHull(n) - h;
        confirm();
      } else note(n, "Upgrade unavailable.");
      break;
    }
    case "buy-item": {
      const item = C.ITEMS.find((i) => i.id === subject);
      if (!item) throw Error("Unknown item");
      if (n.credits >= item.price) {
        n.credits -= item.price;
        n.items[item.id]++;
        confirm();
      } else note(n, "Insufficient Credits.");
      break;
    }
    case "use-item": {
      const id = subject as C.ItemId;
      if (!C.ITEM_IDS.includes(id)) throw Error("Unknown item");
      if (!n.items[id]) {
        note(n, "No supply held.");
        break;
      }
      if (
        (id === "nanobots" && m.hull >= maxHull(n)) ||
        (id === "emergency-fuel" && m.fuel >= maxFuel(n))
      ) {
        note(n, "Already full.");
        break;
      }
      n.items[id]--;
      if (id === "nanobots")
        m.hull = Math.min(maxHull(n), m.hull + C.NANOBOT_HULL);
      if (id === "emergency-fuel")
        m.fuel = Math.min(maxFuel(n), m.fuel + C.EMERGENCY_FUEL);
      if (id === "matter-transmitter" || id === "quantum-teleporter") {
        m.x = C.SPAWN_COL * C.TILE + (C.TILE - C.MINER_W) / 2;
        m.y = C.SURFACE_Y - C.MINER_H;
        m.vx = 0;
        m.vy = 0;
        if (id === "quantum-teleporter") {
          m.y -=
            (n.nextTeleportHeight ??
              C.TELEPORT_HEIGHT_TILES_MIN +
                Math.random() *
                  (C.TELEPORT_HEIGHT_TILES_MAX - C.TELEPORT_HEIGHT_TILES_MIN)) *
            C.TILE;
          m.vy =
            n.nextTeleportSpeed ??
            C.TELEPORT_SPEED_MIN +
              Math.random() * (C.TELEPORT_SPEED_MAX - C.TELEPORT_SPEED_MIN);
          n.nextTeleportHeight = null;
          n.nextTeleportSpeed = null;
        }
        fx(n, "core-extract");
      } else if (id === "dynamite" || id === "plastic-explosives") {
        const p = position(n),
          r =
            id === "dynamite" ? C.DYNAMITE_RADIUS : C.PLASTIC_EXPLOSIVES_RADIUS;
        for (
          let row = Math.max(1, p.row - r);
          row <= Math.min(n.coreRow, p.row + r);
          row++
        )
          for (
            let col = Math.max(1, p.col - r);
            col <= Math.min(C.WORLD_COLS - 2, p.col + r);
            col++
          )
            if (
              !["bedrock", "material", "core", "tunnel"].includes(
                tile(n, col, row).kind,
              )
            )
              breakTile(n, col, row, false);
        fx(n, "gas-explosion");
        n.cues.push(C.CUES.gasExplosion);
        n.shake = 1;
      } else fx(n, "material-shimmer");
      confirm();
      break;
    }
    case "jettison":
      if (n.satchel.coreSample) {
        n.satchel.coreSample = false;
        n.coreGround = position(n);
        note(n, "Core Sample jettisoned. Move clear!");
      }
      break;
    case "fabricate": {
      const part = C.ROCKET_COMPONENTS[n.installed];
      if (!part) {
        note(n, "Rocket complete.");
        break;
      }
      const held =
        !part.material ||
        (part.material === "core-sample"
          ? n.satchel.coreSample
          : n.satchel[part.material] > 0);
      if (n.credits >= part.credits && held) {
        n.credits -= part.credits;
        n.installed++;
        if (part.material === "core-sample") {
          n.satchel.coreSample = false;
          n.coreTimer = null;
        } else if (part.material) n.satchel[part.material]--;
        confirm();
        note(n, part.name + " installed.");
      } else note(n, "Credits or required material missing.");
      break;
    }
    case "launch":
      if (n.installed === C.ROCKET_COMPONENTS.length) {
        n.launchTime = 0.001;
        n.panel = null;
        n.cues.push(C.CUES.launch);
        fx(n, "launch-exhaust", 1870, C.SURFACE_Y);
      } else note(n, "Complete all five components first.");
      break;
    case "save":
      save(n);
      break;
    case "dismiss-notice":
      n.notice = null;
      break;
    default:
      throw Error("Unknown transaction " + action);
  }
  return n;
}
export interface Held {
  left: number;
  right: number;
  down: number;
  up: number;
}
function solid(s: ReadState, col: number, row: number): boolean {
  return row > 0 && tile(s, col, row).kind !== "tunnel";
}
function collides(s: ReadState, x: number, y: number): boolean {
  for (
    let row = Math.floor((y + 0.01) / C.TILE);
    row <= Math.floor((y + C.MINER_H - 0.01) / C.TILE);
    row++
  )
    for (
      let col = Math.floor((x + 0.01) / C.TILE);
      col <= Math.floor((x + C.MINER_W - 0.01) / C.TILE);
      col++
    )
      if (solid(s, col, row)) return true;
  return false;
}
export function step(s: DeepcoreState, h: Held, dt: number): void {
  const m = s.miner;
  s.elapsedSeconds += dt;
  s.animationTime += dt;
  s.hurt = Math.max(0, s.hurt - dt);
  s.shake = Math.max(0, s.shake - dt * 1.5);
  s.effects = s.effects
    .map((e) => ({ ...e, age: e.age + dt }))
    .filter((e) => e.age < 1.7);
  s.noteTime = Math.max(0, s.noteTime - dt);
  if (s.notice) {
    s.notice.age += dt;
    if (s.notice.age > C.NOTICE_DELAY + C.NOTICE_FADE) s.notice = null;
  }
  if (s.launchTime) {
    s.launchTime += dt;
    if (Math.floor(s.launchTime * 10) !== Math.floor((s.launchTime - dt) * 10))
      fx(
        s,
        "launch-exhaust",
        1870,
        C.SURFACE_Y - s.launchTime * s.launchTime * 60,
      );
    if (s.launchTime > 3) end(s, null);
    return;
  }
  if (s.coreTimer !== null) {
    s.coreTimer -= dt;
    if (s.coreTimer <= 0) {
      const p = s.coreGround,
        kill =
          s.satchel.coreSample ||
          (!!p &&
            Math.hypot(
              (p.col + 0.5) * C.TILE - m.x - C.MINER_W / 2,
              (p.row + 0.5) * C.TILE - m.y - C.MINER_H / 2,
            ) <=
              C.CORE_BLAST_TILES * C.TILE);
      fx(
        s,
        "core-detonation",
        p ? (p.col + 0.5) * C.TILE : undefined,
        p ? (p.row + 0.5) * C.TILE : undefined,
      );
      s.shake = 3;
      s.cues.push(C.CUES.gasExplosion);
      s.coreTimer = null;
      s.coreGround = null;
      s.satchel.coreSample = false;
      if (kill) {
        end(s, "core-detonation");
        return;
      }
    } else if (
      Math.floor(s.coreTimer * (s.coreTimer < 15 ? 4 : 1)) !==
      Math.floor((s.coreTimer + dt) * (s.coreTimer < 15 ? 4 : 1))
    )
      s.cues.push(C.CUES.alarmCore);
  }
  if (m.hull <= 0) {
    end(s, "hull-destroyed");
    return;
  }
  if (m.fuel <= 0 && m.y + C.MINER_H > C.SURFACE_Y) {
    end(s, "fuel-out");
    return;
  }
  if (s.panel) return;
  const ground = grounded(s),
    dir = h.right - h.left,
    thrust = h.up > 0 && m.fuel > 0;
  if (dir) m.facing = dir > 0 ? "east" : "west";
  // Retain an in-progress bore even as the body sinks into its target.
  let target = m.drilling;
  if (
    target &&
    ((!h.down && target.dir === "down") ||
      (!dir && target.dir !== "down") ||
      thrust)
  )
    target = null;
  if (!target && ground && !thrust && m.drill && m.fuel > 0) {
    const p = position(s),
      feet = m.y + C.MINER_H;
    if (h.down)
      target = { col: p.col, row: Math.round(feet / C.TILE), dir: "down" };
    else if (dir) {
      const col = Math.floor(
        (dir > 0 ? m.x + C.MINER_W + 0.1 : m.x - 0.1) / C.TILE,
      );
      if (solid(s, col, p.row))
        target = { col, row: p.row, dir: dir > 0 ? "right" : "left" };
    }
  }
  if (!m.drill || m.fuel <= 0) target = null;
  if (target) {
    const c = tile(s, target.col, target.row);
    if (c.kind === "core" && target.dir === "down") {
      if (s.coreTimer === null) {
        s.satchel.coreSample = true;
        s.coreTimer = C.CORE_TIMER;
        fx(s, "core-extract");
        s.cues.push(C.CUES.materialChime);
        note(s, "CORE EXTRACTED — 90 seconds to ignition.");
      }
      target = null;
    } else if (c.health === null) target = null;
  }
  m.drilling = target;
  if (target) {
    s.hitTime += dt;
    while (
      s.hitTime + 1e-10 >= C.DRILL_HIT_INTERVAL &&
      m.fuel > 0 &&
      m.drilling
    ) {
      s.hitTime -= C.DRILL_HIT_INTERVAL;
      m.fuel = Math.max(0, m.fuel - C.DRILL_HIT_FUEL);
      const c = tile(s, target.col, target.row),
        health = c.health! - C.DRILL_DAMAGE_TIERS[s.tiers.drill - 1];
      put(s, target.col, target.row, { ...c, health: Math.max(0, health) });
      fx(
        s,
        "drill-debris",
        (target.col + 0.5) * C.TILE,
        target.dir === "down" ? m.y + C.MINER_H : (target.row + 0.5) * C.TILE,
      );
      if (health <= 0) {
        breakTile(s, target.col, target.row, true);
        m.drilling = null;
        if (
          m.travel &&
          target.dir === "down" &&
          solid(s, target.col, target.row + 1)
        )
          m.y = (target.row + 1) * C.TILE - C.MINER_H;
      }
    }
    if (
      m.travel &&
      m.drilling?.dir === "down" &&
      solid(s, target.col, target.row + 1)
    ) {
      const c = tile(s, target.col, target.row);
      m.y =
        target.row * C.TILE -
        C.MINER_H +
        (1 - c.health! / c.maxHealth!) * C.TILE;
      m.vy = 0;
    }
  } else s.hitTime = 0;
  const load = loadKg(s) / lift(s),
    jet = C.JETPACK_TIERS[s.tiers.jetpack - 1];
  if (m.travel) {
    m.vx =
      s.hurt > 0 && Math.abs(m.vx) > C.WALK_SPEED
        ? m.vx * Math.exp(-dt * 2)
        : dir * C.WALK_SPEED;
    if (thrust) {
      m.vy = Math.max(
        -jet.emptyClimb * (1 - (1 - C.CLIMB_CAP_FLOOR) * Math.min(1, load)),
        m.vy - jet.emptyAccel * Math.max(0, 1 - load) * dt,
      );
    } else if (!m.drilling)
      m.vy = Math.min(
        C.FALL_TERMINAL_EMPTY +
          (C.FALL_TERMINAL_LOADED - C.FALL_TERMINAL_EMPTY) * Math.min(1, load),
        m.vy + C.GRAVITY * dt,
      );
    // Sweep in small steps, so a large velocity never tunnels through a cell.
    const move = (axis: "x" | "y", amount: number) => {
      const steps = Math.max(1, Math.ceil(Math.abs(amount) / 4)),
        d = amount / steps;
      for (let i = 0; i < steps; i++) {
        const nx = m.x + (axis === "x" ? d : 0),
          ny = m.y + (axis === "y" ? d : 0);
        if (collides(s, nx, ny)) {
          if (axis === "y" && d > 0) {
            const impact =
              Math.max(0, m.vy - C.IMPACT_SAFE_SPEED) * C.IMPACT_DAMAGE_RATE;
            if (impact) {
              damage(s, impact);
              fx(s, "impact-dust");
              s.cues.push(C.CUES.impact);
              s.shake = 0.5;
            }
            m.y =
              Math.floor((m.y + C.MINER_H + 0.01) / C.TILE) * C.TILE -
              C.MINER_H;
          }
          if (axis === "y") m.vy = 0;
          else m.vx = 0;
          break;
        }
        m[axis] += d;
      }
    };
    if (!m.drilling || m.drilling.dir !== "down") {
      move("x", m.vx * dt);
      move("y", m.vy * dt);
    }
  }
  if (thrust) {
    const burn =
      C.THRUST_BURN_MAX -
      (C.THRUST_BURN_MAX - C.THRUST_BURN_MIN) *
        Math.min(1, Math.max(0, -m.vy) / C.CRUISE_SPEED);
    m.fuel -= burn * C.THRUST_BURN_SIZE_MULT[s.worldSize] * dt;
    if (
      Math.floor(s.animationTime * 20) !==
      Math.floor((s.animationTime - dt) * 20)
    )
      fx(s, "jetpack-exhaust", m.x + 13, m.y + 55);
  }
  if (!ground && dir) m.fuel -= C.AIR_BURN * dt;
  if (m.y + C.MINER_H > C.SURFACE_Y + 0.01) m.fuel -= C.LIFE_SUPPORT_BURN * dt;
  m.fuel = Math.max(0, m.fuel);
  for (
    let row = Math.floor(m.y / C.TILE);
    row <= Math.floor((m.y + C.MINER_H) / C.TILE);
    row++
  )
    for (
      let col = Math.floor(m.x / C.TILE);
      col <= Math.floor((m.x + C.MINER_W) / C.TILE);
      col++
    ) {
      if (
        tile(s, col, row).kind === "lava" &&
        !(m.drilling?.col === col && m.drilling.row === row)
      ) {
        damage(
          s,
          C.LAVA_CONTACT_DPS *
            (1 - C.RADIATOR_TIERS[s.tiers.radiator - 1]) *
            dt,
          "lava",
        );
        if (
          Math.floor(s.animationTime * 8) !==
          Math.floor((s.animationTime - dt) * 8)
        ) {
          fx(s, "lava-embers");
          s.cues.push(C.CUES.lavaSizzle);
        }
      }
    }
  m.state = m.drilling
    ? m.drilling.dir === "down"
      ? "drill-down"
      : "drill-side"
    : s.hurt > 0
      ? "hurt"
      : m.fuel <= 0 && m.y + C.MINER_H > C.SURFACE_Y
        ? "fuel-out"
        : thrust
          ? "jetpack"
          : !grounded(s)
            ? "fall"
            : dir
              ? "walk"
              : "idle";
  s.deepestDepthMeters = Math.max(s.deepestDepthMeters, depth(s));
  if (m.hull <= 0) end(s, "hull-destroyed");
  else if (m.fuel <= 0 && m.y + C.MINER_H > C.SURFACE_Y) end(s, "fuel-out");
}
export function camera(s: DeepcoreState, dt: number): void {
  const target =
    Math.abs(s.miner.vy) <= C.CAM_STILL_SPEED
      ? 0
      : Math.sign(s.miner.vy) * C.CAM_LEAD_MAX;
  const rate =
    (C.CAM_LEAD_MAX / C.CAM_LEAD_RAMP) *
    (s.camera.lead * target <= 0 || Math.abs(target) < Math.abs(s.camera.lead)
      ? C.CAM_UNWIND_MULT
      : 1);
  s.camera.lead +=
    Math.sign(target - s.camera.lead) *
    Math.min(Math.abs(target - s.camera.lead), rate * dt);
  s.camera.x = Math.max(
    0,
    Math.min(C.WORLD_W - C.VIEW_W, s.miner.x + C.MINER_W / 2 - C.VIEW_W / 2),
  );
  s.camera.y = Math.min(
    (s.coreRow + 1) * C.TILE - C.VIEW_H,
    s.miner.y + C.MINER_H / 2 - C.VIEW_H / 2 + s.camera.lead,
  );
}
