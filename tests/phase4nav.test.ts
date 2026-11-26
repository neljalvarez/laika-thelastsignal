/**
 * Phase 4: the base and the optional challenges are where the design says they are.
 * - Every mandatory Mission 04 object is reachable with basic jumps (no boots needed),
 *   using the habitat ladder between the surface and the lower level.
 * - Challenge B (Frozen Depths deep probe) and Challenge C (Echo Ridge observatory) need the
 *   boosted air jump, so suit energy is a reason to plan, never a wall in the main mission.
 * - The base's visible look follows its state (pure mapping, tested without Phaser).
 */
import { describe, expect, it } from "vitest";
import { findObject, MAPS, type MapId } from "../src/data/regions/registry";
import { BASIC_JUMP, BOOST_JUMP, BOOTS_JUMP, cellKey, reachableFrom, standCellFor, type JumpAbility } from "../src/systems/navigation";
import { createNewState, type GameState } from "../src/systems/state";
import { buildMap, buildWorld, type WorldGrid } from "../src/systems/worldBuilder";
import { computePower } from "../src/systems/engineering";
import { facilityTexture, roomDarkness, ROOMS, surfaceLook } from "../src/game/facilityLook";

function stand(g: WorldGrid, id: string): [number, number] {
  const o = findObject(id)!;
  const c = standCellFor(g, o.col, o.row);
  if (!c) throw new Error(`no standing cell for ${id}`);
  return c;
}

/** Reachability that also models the habitat ladder (surface habitat <-> lower level). */
function reachSurface(from: string, jump: JumpAbility): { g: WorldGrid; set: Set<number> } {
  const g = buildWorld();
  const set = reachableFrom(g, ...stand(g, from), jump);
  const habitat = stand(g, "habitat");
  if (set.has(cellKey(...habitat))) for (const k of reachableFrom(g, 62, 30, jump)) set.add(k);
  return { g, set };
}

function reachMap(map: MapId, from: string, jump: JumpAbility, s: GameState) {
  const g = buildMap(MAPS[map], s, { doorsOpen: true, bridgesOut: true });
  return { g, set: reachableFrom(g, ...stand(g, from), jump) };
}
const has = (r: { g: WorldGrid; set: Set<number> }, id: string) => r.set.has(cellKey(...stand(r.g, id)));

const LOWER = ["shelter_terminal", "probe_shelter", "dist_console", "buried_cartridge", "habitat_mat", "habitat_storage", "recycler", "recycler_power", "grow_power", "planter", "grow_valve", "water_processor", "lower_stairs", "cp_lower"];

describe("Phase 4 navigation", () => {
  it("every lower-level machine is reachable from the outpost with basic jumps, through the habitat ladder", () => {
    const r = reachSurface("cp_outpost", BASIC_JUMP);
    for (const id of [...LOWER, "base_terminal", "probe_surface", "battery", "recharge_outpost"]) expect(has(r, id), id).toBe(true);
  });

  it("the lower level is closed rock without the ladder (it is not a fall-in pit)", () => {
    const g = buildWorld();
    const set = reachableFrom(g, ...stand(g, "cp_outpost"), BOOTS_JUMP);
    for (const id of ["recycler", "planter", "shelter_terminal"]) expect(set.has(cellKey(...stand(g, id))), id).toBe(false);
  });

  it("the lower level ladder leads back up: every lower machine can reach the stairs", () => {
    const g = buildWorld();
    for (const id of LOWER) {
      const set = reachableFrom(g, ...stand(g, id), BASIC_JUMP);
      expect(set.has(cellKey(...stand(g, "lower_stairs"))), id).toBe(true);
    }
  });

  it("Challenge A: the canyon recharge post and seismometer need no boots", () => {
    const r = reachSurface("cp_outpost", BASIC_JUMP);
    expect(has(r, "recharge_canyon")).toBe(true);
    expect(has(r, "seismometer")).toBe(true);
  });

  it("Challenge B: the fissure deep probe needs the boosted jump", () => {
    const s = createNewState();
    Object.assign(s.flags, { passageOpen: true, circuitRestored: true });
    s.abilities.thrusters = true;
    expect(has(reachMap("depths", "cp_depths_freight", BOOTS_JUMP, s), "deep_probe")).toBe(false);
    expect(has(reachMap("depths", "cp_depths_freight", BOOST_JUMP, s), "deep_probe")).toBe(true);
    // The fissure recharge post itself is easy to reach: Laika can always top up before trying.
    expect(has(reachMap("depths", "cp_depths_freight", BASIC_JUMP, s), "recharge_fissure")).toBe(true);
  });

  it("Challenge C: the Echo Ridge observatory needs the boosted jump; the camp recharge post does not", () => {
    const s = createNewState();
    Object.assign(s.flags, { ridgeBridgeOut: true });
    const from = MAPS.ridge.objects.find((o) => o.kind === "checkpoint")!.id;
    expect(has(reachMap("ridge", from, BOOTS_JUMP, s), "telescope_north")).toBe(false);
    expect(has(reachMap("ridge", from, BOOST_JUMP, s), "telescope_north")).toBe(true);
    expect(has(reachMap("ridge", from, BASIC_JUMP, s), "recharge_camp")).toBe(true);
  });

  it("no dead ends: from the boosted-jump ledges Laika gets back down with plain jumps (no energy needed)", () => {
    const s = createNewState();
    Object.assign(s.flags, { passageOpen: true, circuitRestored: true, ridgeBridgeOut: true });
    const d = buildMap(MAPS.depths, s, { doorsOpen: true, bridgesOut: true });
    expect(reachableFrom(d, ...stand(d, "deep_probe"), BASIC_JUMP).has(cellKey(...stand(d, "recharge_fissure")))).toBe(true);
    const r = buildMap(MAPS.ridge, s, { doorsOpen: true, bridgesOut: true });
    const camp = stand(r, "recharge_camp");
    expect(reachableFrom(r, ...stand(r, "telescope_north"), BASIC_JUMP).has(cellKey(...camp))).toBe(true);
  });

  it("no interactable crowds the ladders (E always means the ladder there)", () => {
    const quiet = new Set(["checkpoint", "secret", "buried"]);
    const objs = MAPS.surface.objects;
    const crowded: string[] = [];
    for (const t of objs.filter((o) => o.kind === "stairs" || o.id === "habitat")) {
      for (const o of objs) if (o !== t && !quiet.has(o.kind) && Math.abs(o.row - t.row) <= 1 && Math.abs(o.col - t.col) < 3) crowded.push(`${t.id} <-> ${o.id}`);
    }
    expect(crowded).toEqual([]);
  });
});

describe("Phase 4 visible base transformation", () => {
  const base = () => {
    const s = createNewState();
    s.flags.m4Briefed = true;
    s.flags.solarRepaired = true;
    return s;
  };
  const look = (s: GameState, id: string) => facilityTexture(findObject(id)!, s, computePower(s, "adventure"));

  it("machines change texture as they are restored", () => {
    const s = base();
    expect(look(s, "recycler")).toBe("recycler_broken");
    expect(look(s, "planter")).toBe("planter_dry");
    expect(look(s, "dist_console")).toBe("dist_console_off");
    s.flags.batteryRestored = true;
    s.eng.battery = 50;
    expect(look(s, "dist_console")).toBe("dist_console_on");
    s.flags.recyclerFixed = true;
    expect(look(s, "recycler")).toBe("recycler_off");
    s.flags.recyclerPowered = true;
    s.flags.recyclerOn = true;
    expect(look(s, "recycler")).toBe("recycler_on0");
    s.flags.waterRestored = true;
    s.flags.growValveOpen = true;
    expect(look(s, "planter")).toBe("planter_wet");
    s.flags.seedsPlanted = true;
    expect(look(s, "planter")).toBe("planter_seeds");
    s.eng.growMs = 60000;
    expect(look(s, "planter")).toBe("planter_mature");
  });

  it("rooms of the lower level light up one by one", () => {
    const s = base();
    const p = () => computePower(s, "adventure");
    for (const r of ROOMS) expect(roomDarkness(r.id, s, p()), r.id).toBe(1);
    s.flags.batteryRestored = true;
    s.eng.battery = 50;
    expect(roomDarkness("quarters", s, p())).toBe(0);
    expect(roomDarkness("life", s, p())).toBeGreaterThan(0);
    Object.assign(s.flags, { recyclerFixed: true, recyclerPowered: true, recyclerOn: true });
    expect(roomDarkness("life", s, p())).toBe(0);
  });

  it("the surface shows the greenhouse crop, the vent and (at the end) the beacon light", () => {
    const s = base();
    Object.assign(s.flags, { batteryRestored: true, recyclerFixed: true, recyclerPowered: true, recyclerOn: true, waterRestored: true, growPowered: true, growValveOpen: true, seedsPlanted: true, growLightsOn: true });
    s.eng.battery = 80;
    s.eng.growMs = 35000;
    const l = surfaceLook(s, computePower(s, "adventure"));
    expect(l.domeStage).toBe(3);
    expect(l.domeGlow).toBe(true);
    expect(l.vent && l.ventSteam).toBe(true);
    expect(l.mastBlink).toBe(false);
    s.flags.m4Complete = true;
    expect(surfaceLook(s, computePower(s, "adventure")).mastBlink).toBe(true);
  });

  it("every texture the look module can name exists in the art", async () => {
    const { BASE_PROPS } = await import("../src/art/baseProps");
    const names = new Set<string>();
    const s = base();
    const flagSets: Array<Partial<GameState["flags"]>> = [{}, { batteryRestored: true, recyclerFixed: true, recyclerPowered: true, recyclerOn: true, waterRestored: true, growPowered: true, growValveOpen: true, seedsPlanted: true, growLightsOn: true, shelterInspected: true, probeOutRead: true, probeInRead: true, shelterRestored: true, seismometerRead: true, fissureSurveyed: true, observatoryReached: true, canyonPostFixed: true }];
    for (const fl of flagSets) {
      Object.assign(s.flags, fl);
      s.eng.battery = 50;
      for (const ms of [0, 15000, 35000, 60000]) {
        s.eng.growMs = ms;
        for (const m of ["surface", "depths", "ridge"] as MapId[]) {
          for (const o of MAPS[m].objects) for (const fr of [0, 1] as const) {
            const k = facilityTexture(o, s, computePower(s, "adventure"), fr);
            if (k) names.add(k);
          }
        }
      }
    }
    for (const k of names) expect(k in BASE_PROPS, k).toBe(true);
  });
});
