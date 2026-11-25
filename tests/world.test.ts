import { describe, expect, it } from "vitest";
import { ASSIST_TUNING, TUNING } from "../src/config/constants";
import { RECIPES } from "../src/data/items";
import { FLOOR_HATCH_TILES, HATCH_TILES, INTERIORS, OBJECTS as ALL_OBJECTS, PRACTICE_IDS, SPAWN, STATION_DOOR_TILES, T, TUTORIAL_SPAWN } from "../src/data/world";

/** Campaign objects (Mission 00 practice objects live on the sealed upper deck and are tested separately). */
const OBJECTS = ALL_OBJECTS.filter((o) => !PRACTICE_IDS.has(o.id));
import { maxJumpHeight } from "../src/systems/movement";
import {
  BASIC_JUMP,
  BOOTS_JUMP,
  canStand,
  cellKey,
  neighbours,
  reachableFrom,
  standCellFor,
  type JumpAbility,
} from "../src/systems/navigation";
import { buildWorld, withBridge, withCleared, type WorldGrid } from "../src/systems/worldBuilder";

const base = buildWorld();
const opened = withCleared(base, HATCH_TILES);
const full = withCleared(withBridge(opened), STATION_DOOR_TILES);
const spawn: [number, number] = [SPAWN.col, SPAWN.row - 1];

function reach(g: WorldGrid, jump: JumpAbility = BASIC_JUMP) {
  return reachableFrom(g, spawn[0], spawn[1], jump);
}

describe("world layout", () => {
  it("builds a grid of the declared size with a standable spawn", () => {
    expect(base.fg.length).toBe(34);
    expect(base.fg[0].length).toBe(240);
    expect(canStand(base, spawn[0], spawn[1])).toBe(true);
  });

  it("validation limits are weaker than the real jump", () => {
    expect(maxJumpHeight(TUNING) / 16).toBeGreaterThan(BASIC_JUMP.up + 0.3);
    expect(maxJumpHeight(ASSIST_TUNING)).toBeGreaterThan(maxJumpHeight(TUNING));
  });

  it("keeps Laika inside the ship until the hatch opens", () => {
    const r = reach(base);
    const outpost = standCellFor(base, 30, 24)!;
    expect(r.has(cellKey(...outpost))).toBe(false);
    expect(reach(opened).has(cellKey(...outpost))).toBe(true);
  });

  it("keeps the station out of reach until the bridge extends (without boots)", () => {
    const inside = standCellFor(full, 225, 24)!;
    expect(reach(withCleared(opened, STATION_DOOR_TILES)).has(cellKey(...inside))).toBe(false);
    expect(reach(full).has(cellKey(...inside))).toBe(true);
  });

  it("every object except the boots-only ledge is reachable with an ordinary jump", () => {
    const r = reach(full);
    const unreachable = OBJECTS.filter((o) => {
      const cell = standCellFor(full, o.col, o.row);
      return !cell || !r.has(cellKey(...cell));
    }).map((o) => o.id);
    expect(unreachable).toEqual(["sample_hematite"]);
  });

  it("everything, including the high ledge, is reachable with Thruster Boots", () => {
    const r = reach(full, BOOTS_JUMP);
    for (const o of OBJECTS) {
      const cell = standCellFor(full, o.col, o.row);
      expect(cell, o.id).not.toBeNull();
      expect(r.has(cellKey(...cell!)), o.id).toBe(true);
    }
  });

  it("has no dead ends: from every reachable spot Laika can get back to the outpost", () => {
    for (const [g, jump] of [
      [opened, BASIC_JUMP],
      [full, BASIC_JUMP],
      [full, BOOTS_JUMP],
    ] as Array<[WorldGrid, JumpAbility]>) {
      const r = reachableFrom(g, spawn[0], spawn[1], jump);
      // Build reverse edges over the reachable set, then search back from the outpost.
      const rev = new Map<number, number[]>();
      for (const k of r) {
        const c = k % 10000;
        const row = Math.floor(k / 10000);
        for (const [nc, nr] of neighbours(g, c, row, jump)) {
          const nk = cellKey(nc, nr);
          if (!rev.has(nk)) rev.set(nk, []);
          rev.get(nk)!.push(k);
        }
      }
      const goal = cellKey(...standCellFor(g, 30, 24)!);
      const back = new Set([goal]);
      const q = [goal];
      while (q.length) {
        const k = q.shift()!;
        for (const p of rev.get(k) ?? []) if (!back.has(p)) (back.add(p), q.push(p));
      }
      const stuck = [...r].filter((k) => !back.has(k)).map((k) => `${k % 10000},${Math.floor(k / 10000)}`);
      expect(stuck).toEqual([]);
    }
  });

  it("the main mission never needs more than 2-tile climbs or 3-tile gaps (no precise platforming)", () => {
    const easy: JumpAbility = { up: 2, across: 4 }; // across = column distance, so at most a 3-tile gap
    const critical = ["shipRadio", "hatch", "receiver", "solarControl", "panel_1", "panel_2", "panel_3", "comms_module", "rover", "bridgeControl", "stationDoor", "beacon", "metal_ship", "metal_crates", "elec_outpost"];
    const r = reach(full, easy);
    for (const id of critical) {
      const o = OBJECTS.find((x) => x.id === id)!;
      expect(r.has(cellKey(...standCellFor(full, o.col, o.row)!)), id).toBe(true);
    }
    // ...and from the comms module and the station, the outpost is reachable again with the same limits.
    for (const id of ["comms_module", "beacon"]) {
      const o = OBJECTS.find((x) => x.id === id)!;
      const from = standCellFor(full, o.col, o.row)!;
      expect(reachableFrom(full, from[0], from[1], easy).has(cellKey(...standCellFor(full, 70, 24)!)), id).toBe(true);
    }
  });

  it("a short westward jump at the pit climbs straight out (no loop back through the tunnel)", () => {
    const easy: JumpAbility = { up: 2, across: 4 };
    // BFS restricted to the pit and its west rim (cols 100-122), so the tunnel route cannot be used.
    const floor: [number, number] = [112, 30]; // standing on the pit floor in the west gap
    expect(canStand(full, ...floor)).toBe(true);
    const goal = cellKey(109, 27); // standing on the west rim
    expect(canStand(full, 109, 27)).toBe(true);
    const seen = new Set([cellKey(...floor)]);
    const queue: Array<[number, number]> = [floor];
    let found = false;
    while (queue.length && !found) {
      const [c, r] = queue.shift()!;
      for (const n of neighbours(full, c, r, easy)) {
        if (n[0] < 100 || n[0] > 122 || seen.has(cellKey(...n))) continue;
        if (cellKey(...n) === goal) found = true;
        seen.add(cellKey(...n));
        queue.push(n);
      }
    }
    expect(found).toBe(true);
  });

  it("Mission 00: the upper deck is sealed from the campaign, its practice objects are easy to reach, and the hatch leads down", () => {
    const tut: [number, number] = [TUTORIAL_SPAWN.col, TUTORIAL_SPAWN.row - 1];
    const easy: JumpAbility = { up: 2, across: 4 };
    // Campaign players on the lower deck can never wander into the training bay.
    for (const g of [opened, full]) {
      const r = reachableFrom(g, spawn[0], spawn[1], BOOTS_JUMP);
      expect(r.has(cellKey(...tut))).toBe(false);
    }
    // Before the hatch opens, the tutorial is confined to the upper deck but every practice object is reachable.
    const closed = reachableFrom(base, tut[0], tut[1], easy);
    for (const id of PRACTICE_IDS) {
      const o = ALL_OBJECTS.find((x) => x.id === id)!;
      expect(closed.has(cellKey(...standCellFor(base, o.col, o.row)!)), id).toBe(true);
    }
    expect(closed.has(cellKey(...spawn))).toBe(false);
    // With the floor hatch open, Laika drops onto the lower deck and can reach the radio and the hatch.
    const dropped = withCleared(base, FLOOR_HATCH_TILES);
    const r = reachableFrom(dropped, tut[0], tut[1], easy);
    for (const id of ["shipRadio", "hatch"]) {
      const o = ALL_OBJECTS.find((x) => x.id === id)!;
      expect(r.has(cellKey(...standCellFor(dropped, o.col, o.row)!)), id).toBe(true);
    }
  });

  it("checkpoints stand on solid ground", () => {
    for (const o of OBJECTS.filter((x) => x.kind === "checkpoint")) {
      expect(standCellFor(full, o.col, o.row), o.id).not.toBeNull();
    }
  });

  it("places enough parts in the world for every recipe, and exactly one comms module", () => {
    const n = (item: string) => OBJECTS.filter((o) => o.item === item).length;
    expect(n("metal")).toBeGreaterThanOrEqual((RECIPES.solarRepair.metal ?? 0) + (RECIPES.thrusterBoots.metal ?? 0));
    expect(n("electronics")).toBeGreaterThanOrEqual((RECIPES.solarRepair.electronics ?? 0) + (RECIPES.thrusterBoots.electronics ?? 0));
    expect(n("commsModule")).toBe(1);
    expect(n("treat")).toBe(1);
  });

  it("object ids are unique and interiors are well formed", () => {
    const ids = OBJECTS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of Object.values(INTERIORS)) {
      expect(r.x1).toBeGreaterThan(r.x0);
      expect(r.y1).toBeGreaterThan(r.y0);
    }
    expect(base.fg[19][23]).toBe(T.Door);
  });
});
