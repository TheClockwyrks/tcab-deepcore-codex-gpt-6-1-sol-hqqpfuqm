import * as C from "./constants";
import {
  type ReadState,
  type DeepcoreState,
  blank,
  copy,
  cell,
  tile,
  put,
  emptyGrid,
  bandAt,
  snapshot,
  generate,
  clearSave,
  maxFuel,
  maxHull,
  position,
  BUILDING_RECTS,
} from "./model";
import { menu, menuRect, controlRect } from "./interface";
import { transact } from "./simulation";
function valid(condition: boolean): void {
  if (!condition) throw new RangeError("Deepcore: invalid debug argument");
}
function number(n: number, min = -Infinity, max = Infinity): void {
  valid(Number.isFinite(n) && n >= min && n <= max);
}
function integer(n: number, min: number, max = Infinity): void {
  number(n, min, max);
  valid(Number.isInteger(n));
}
function edit(s: ReadState, fn: (n: DeepcoreState) => void): DeepcoreState {
  const n = copy(s);
  fn(n);
  return n;
}
function at(s: ReadState, col: number, row: number): void {
  integer(col, 0, C.WORLD_COLS - 1);
  integer(row, 1, s.coreRow);
}
const transaction = (action: string) => (s: ReadState) => transact(s, action);
export const debug = {
  version: C.DEEPCORE_DEBUG_VERSION,
  snapshot,
  tileAt: (s: ReadState, col: number, row: number) => {
    integer(col, -Infinity);
    integer(row, -Infinity);
    return { ...tile(s, col, row) };
  },
  findTile(s: ReadState, kind: C.TileKind) {
    valid(C.TILE_KINDS.includes(kind));
    const p = position(s);
    let best = Infinity,
      result: { col: number; row: number } | null = null;
    s.grid.forEach((r, row) =>
      r.forEach((c, col) => {
        const d = Math.hypot(col - p.col, row - p.row);
        if (c.kind === kind && d < best) {
          best = d;
          result = { col, row };
        }
      }),
    );
    return result;
  },
  buildings: (_s: ReadState) => BUILDING_RECTS.map((b) => ({ ...b })),
  menuItemRect: (s: ReadState, index: number) =>
    index >= 0 && index < menu(s).length
      ? s.screen === "how-to-play"
        ? { ...menuRect(index), y: 590 }
        : menuRect(index)
      : null,
  controlRect,
  reset: (s: ReadState) => {
    const n = blank(
      s.images as DeepcoreState["images"],
      s.systems as DeepcoreState["systems"],
    );
    n.muted = s.muted;
    return n;
  },
  reconcile: (s: ReadState) => copy(s),
  generateMine: (s: ReadState) => edit(s, generate),
  clearMine: (s: ReadState) =>
    edit(s, (n) => {
      n.grid = emptyGrid(n.coreRow);
    }),
  clearCargo: (s: ReadState) =>
    edit(s, (n) => {
      n.cargo = {};
    }),
  clearItems: (s: ReadState) =>
    edit(s, (n) => {
      for (const id of C.ITEM_IDS) n.items[id] = 0;
    }),
  setTile: (s: ReadState, col: number, row: number, kind: C.TileKind) => {
    at(s, col, row);
    valid(
      ["rock", "gas", "lava", "stone", "bedrock", "tunnel", "core"].includes(
        kind,
      ),
    );
    return edit(s, (n) => put(n, col, row, cell(kind, bandAt(row, s.coreRow))));
  },
  setOreTile: (s: ReadState, col: number, row: number, ore: C.OreId) => {
    at(s, col, row);
    valid(C.MINERALS.some((o) => o.id === ore));
    return edit(s, (n) =>
      put(n, col, row, cell("ore", bandAt(row, s.coreRow), ore)),
    );
  },
  setMaterialTile: (
    s: ReadState,
    col: number,
    row: number,
    material: C.MaterialId,
  ) => {
    at(s, col, row);
    valid(C.MATERIALS.includes(material));
    return edit(s, (n) =>
      put(
        n,
        col,
        row,
        cell("material", bandAt(row, s.coreRow), null, material),
      ),
    );
  },
  setTileHealth: (s: ReadState, col: number, row: number, health: number) => {
    at(s, col, row);
    const c = tile(s, col, row);
    valid(c.maxHealth !== null);
    number(health, Number.MIN_VALUE, c.maxHealth!);
    return edit(s, (n) => put(n, col, row, { ...c, health }));
  },
  placeCoreSample: (s: ReadState, col: number, row: number) => {
    at(s, col, row);
    valid(tile(s, col, row).kind === "tunnel" && s.coreTimer === null);
    return edit(s, (n) => {
      n.coreGround = { col, row };
      n.coreTimer = C.CORE_TIMER;
    });
  },
  setMinerPosition: (s: ReadState, x: number, y: number) => {
    number(x);
    number(y);
    return edit(s, (n) => {
      n.miner.x = x;
      n.miner.y = y;
    });
  },
  setMinerVelocity: (s: ReadState, vx: number, vy: number) => {
    number(vx);
    number(vy);
    return edit(s, (n) => {
      n.miner.vx = vx;
      n.miner.vy = vy;
    });
  },
  setFacing: (s: ReadState, facing: C.Facing) => {
    valid(C.FACINGS.includes(facing));
    return edit(s, (n) => {
      n.miner.facing = facing;
    });
  },
  setFuel: (s: ReadState, value: number) => {
    number(value, 0);
    return edit(s, (n) => {
      n.miner.fuel = value;
    });
  },
  setHull: (s: ReadState, value: number) => {
    number(value, 0);
    return edit(s, (n) => {
      n.miner.hull = value;
    });
  },
  setMinerTravel: (s: ReadState, enabled: boolean) =>
    edit(s, (n) => {
      valid(typeof enabled === "boolean");
      n.miner.travel = enabled;
    }),
  setMinerDrill: (s: ReadState, enabled: boolean) =>
    edit(s, (n) => {
      valid(typeof enabled === "boolean");
      n.miner.drill = enabled;
    }),
  setScreen: (s: ReadState, screen: C.ScreenName) => {
    valid(C.SCREENS.includes(screen));
    return edit(s, (n) => {
      n.screen = screen;
    });
  },
  setPanel: (s: ReadState, panel: C.PanelId | null) => {
    valid(panel === null || C.PANELS.includes(panel));
    return edit(s, (n) => {
      n.panel = panel;
    });
  },
  setMenuIndex: (s: ReadState, index: number) => {
    integer(index, 0, menu(s).length - 1);
    return edit(s, (n) => {
      n.menuIndex = index;
    });
  },
  setMode: (s: ReadState, mode: C.Mode) => {
    valid(C.MODES.includes(mode));
    return edit(s, (n) => {
      n.mode = mode;
    });
  },
  setWorldSize: (s: ReadState, size: C.WorldSize) => {
    valid(C.WORLD_SIZES.includes(size));
    return edit(s, (n) => {
      const rows = Math.round(C.STANDARD_ROWS * C.WORLD_SIZE_SCALE[size]),
        grid = emptyGrid(rows);
      for (let r = 0; r < Math.min(rows, s.coreRow); r++)
        if (r !== s.coreRow)
          grid[r] = s.grid[r] as DeepcoreState["grid"][number];
      if (rows > s.coreRow)
        grid[s.coreRow] = Array.from({ length: C.WORLD_COLS }, (_, col) =>
          cell(
            col === 0 || col === C.WORLD_COLS - 1 ? "bedrock" : "tunnel",
            bandAt(s.coreRow, rows),
          ),
        );
      n.grid = grid;
      n.coreRow = rows;
      n.worldSize = size;
    });
  },
  setCredits: (s: ReadState, value: number) => {
    number(value, 0);
    return edit(s, (n) => {
      n.credits = value;
    });
  },
  setTier: (s: ReadState, track: C.TrackName, tier: number) => {
    valid(C.TRACKS.includes(track));
    integer(tier, 1, C.MAX_TIER[track]);
    return edit(s, (n) => {
      n.tiers[track] = tier;
      n.miner.fuel = Math.min(n.miner.fuel, maxFuel(n));
      n.miner.hull = Math.min(n.miner.hull, maxHull(n));
    });
  },
  setCargo: (s: ReadState, ore: C.OreId, count: number) => {
    valid(C.MINERALS.some((o) => o.id === ore));
    integer(count, 0);
    return edit(s, (n) => {
      n.cargo[ore] = count;
    });
  },
  setMaterial: (s: ReadState, material: C.MaterialId, count: number) => {
    valid(C.MATERIALS.includes(material));
    integer(count, 0);
    return edit(s, (n) => {
      n.satchel[material] = count;
    });
  },
  setCoreCarried: (s: ReadState, carried: boolean) => {
    valid(typeof carried === "boolean" && (!carried || s.coreTimer === null));
    return edit(s, (n) => {
      n.satchel.coreSample = carried;
      n.coreTimer = carried ? C.CORE_TIMER : null;
    });
  },
  setCoreTimer: (s: ReadState, seconds: number) => {
    valid(s.coreTimer !== null);
    number(seconds, Number.MIN_VALUE);
    return edit(s, (n) => {
      n.coreTimer = seconds;
    });
  },
  setItemCount: (s: ReadState, item: C.ItemId, count: number) => {
    valid(C.ITEM_IDS.includes(item));
    integer(count, 0);
    return edit(s, (n) => {
      n.items[item] = count;
    });
  },
  setRocketInstalled: (s: ReadState, count: number) => {
    integer(count, 0, C.ROCKET_COMPONENTS.length);
    return edit(s, (n) => {
      n.installed = count;
    });
  },
  setNoticeFired: (s: ReadState, hazard: C.NoticeHazard, fired: boolean) => {
    valid(C.NOTICE_HAZARDS.includes(hazard) && typeof fired === "boolean");
    return edit(s, (n) => {
      n.noticesFired[hazard] = fired;
    });
  },
  setCameraLead: (s: ReadState, lead: number) => {
    number(lead, -C.CAM_LEAD_MAX, C.CAM_LEAD_MAX);
    return edit(s, (n) => {
      n.camera.lead = lead;
    });
  },
  setElapsed: (s: ReadState, seconds: number) => {
    number(seconds, 0);
    return edit(s, (n) => {
      n.elapsedSeconds = seconds;
    });
  },
  clearSave: (s: ReadState) => {
    clearSave();
    return edit(s, (n) => {
      n.hasSave = false;
    });
  },
  setNextTeleportHeight: (s: ReadState, tiles: number | null) => {
    if (tiles !== null)
      number(tiles, C.TELEPORT_HEIGHT_TILES_MIN, C.TELEPORT_HEIGHT_TILES_MAX);
    return edit(s, (n) => {
      n.nextTeleportHeight = tiles;
    });
  },
  setNextTeleportSpeed: (s: ReadState, speed: number | null) => {
    if (speed !== null)
      number(speed, C.TELEPORT_SPEED_MIN, C.TELEPORT_SPEED_MAX);
    return edit(s, (n) => {
      n.nextTeleportSpeed = speed;
    });
  },
  dropOre: (s: ReadState, ore: C.OreId) => transact(s, "drop-ore", ore),
  sell: transaction("sell"),
  buyFuel: transaction("buy-fuel"),
  fillFuel: transaction("fill-fuel"),
  buyRepair: transaction("buy-repair"),
  repairFull: transaction("repair-full"),
  buyUpgrade: (s: ReadState, track: C.TrackName) =>
    transact(s, "buy-upgrade", track),
  buyItem: (s: ReadState, item: C.ItemId) => transact(s, "buy-item", item),
  useItem: (s: ReadState, item: C.ItemId) => transact(s, "use-item", item),
  jettison: transaction("jettison"),
  fabricate: transaction("fabricate"),
  launch: transaction("launch"),
  save: transaction("save"),
  dismissNotice: transaction("dismiss-notice"),
};
