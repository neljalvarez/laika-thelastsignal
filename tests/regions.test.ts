/**
 * Phase 3: region registry, connections, reachability of the new maps (with abilities and door
 * states), and the no-dead-ends rule for every map.
 */
import { describe, expect, it } from "vitest";
import { ALL_OBJECTS, CONNECTIONS, findObject, MAP_IDS, MAPS, mapOfObject, type MapId } from "../src/data/regions/registry";
import { BASIC_JUMP, BOOTS_JUMP, canStand, cellKey, reachableFrom, standCellFor, type JumpAbility } from "../src/systems/navigation";
import { createNewState, type GameState } from "../src/systems/state";
import { buildMap, type WorldGrid } from "../src/systems/worldBuilder";

const EASY: JumpAbility = { up: 2, across: 4 }; // mandatory route: <= 2-tile climbs, <= 3-tile gaps

function stand(g: WorldGrid, id: string): [number, number] {
  const o = findObject(id)!;
  const c = standCellFor(g, o.col, o.row);
  if (!c) throw new Error(`no standing cell for ${id}`);
  return c;
}

function reach(map: MapId, from: string, jump: JumpAbility, s?: GameState, override?: { doorsOpen?: boolean; bridgesOut?: boolean }) {
  const g = buildMap(MAPS[map], s, override);
  const [c, r] = stand(g, from);
  return { g, set: reachableFrom(g, c, r, jump) };
}
const has = (r: { g: WorldGrid; set: Set<number> }, id: string) => r.set.has(cellKey(...stand(r.g, id)));

function stateWith(flags: Partial<GameState["flags"]>, aims?: Record<string, number>): GameState {
  const s = createNewState();
  Object.assign(s.flags, flags);
  if (aims) Object.assign(s.puzzles.relayAim, aims);
  return s;
}

describe("region registry", () => {
  it("registers the three maps and five numbered regions", () => {
    expect(MAP_IDS).toEqual(["surface", "depths", "ridge"]);
    const nums = MAP_IDS.flatMap((m) => MAPS[m].regions.map((r) => r.regionNo));
    expect(new Set(nums)).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it("object ids are unique across every map", () => {
    const ids = ALL_OBJECTS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("section, landmark and secret ids are unique, and sections/landmarks lie inside their map", () => {
    const sec = MAP_IDS.flatMap((m) => MAPS[m].sections.map((x) => x.id));
    expect(new Set(sec).size).toBe(sec.length);
    const lm = MAP_IDS.flatMap((m) => MAPS[m].landmarks.map((x) => x.id));
    expect(new Set(lm).size).toBe(lm.length);
    for (const m of MAP_IDS) {
      for (const s of MAPS[m].sections) {
        expect(s.rect.x0 >= 0 && s.rect.x1 < MAPS[m].w && s.rect.y0 >= 0 && s.rect.y1 < MAPS[m].h, s.id).toBe(true);
      }
      for (const o of MAPS[m].objects) expect(o.col >= 0 && o.col < MAPS[m].w && o.row > 0 && o.row < MAPS[m].h, o.id).toBe(true);
    }
  });

  it("every connection links two transit objects to hidden, standable arrival checkpoints on the right maps", () => {
    for (const c of CONNECTIONS) {
      for (const end of [c.a, c.b]) {
        const o = findObject(end.object)!;
        expect(o.kind, end.object).toBe("transit");
        expect(o.link, end.object).toBe(c.id);
        expect(mapOfObject(end.object)).toBe(end.map);
        const cp = findObject(end.arrive)!;
        expect(cp.kind).toBe("checkpoint");
        expect(cp.hidden).toBe(true);
        expect(mapOfObject(end.arrive)).toBe(end.map);
        const g = buildMap(MAPS[end.map], undefined, { doorsOpen: true });
        expect(canStand(g, ...stand(g, end.arrive)), end.arrive).toBe(true);
      }
    }
  });

  it("no interactable object crowds a lift, gate or cable car (pressing E next to a transit always uses it)", () => {
    // Visible things you can press E on, other than the transit itself. Buried items only count once dug up,
    // checkpoints and secrets are not interactions.
    const quiet = new Set(["checkpoint", "secret", "buried"]);
    const crowded: string[] = [];
    for (const m of MAP_IDS) {
      const objs = MAPS[m].objects;
      for (const t of objs.filter((o) => o.kind === "transit")) {
        for (const o of objs) {
          if (o === t || quiet.has(o.kind) || Math.abs(o.row - t.row) > 1) continue;
          if (Math.abs(o.col - t.col) < 3) crowded.push(`${t.id} <-> ${o.id}`);
        }
      }
    }
    expect(crowded).toEqual([]);
  });

  it("the region graph is connected: every map can reach every other map once all connections are open", () => {
    const all = stateWith({ m2Briefed: true, depthsLiftOpen: true, relayAnalyzed: true, ridgeCableOpen: true });
    const seen = new Set<MapId>(["surface"]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of CONNECTIONS) {
        if (!c.open(all)) continue;
        if (seen.has(c.a.map) && !seen.has(c.b.map)) (seen.add(c.b.map), (grew = true));
        if (seen.has(c.b.map) && !seen.has(c.a.map)) (seen.add(c.a.map), (grew = true));
      }
    }
    expect(seen.size).toBe(3);
  });
});

describe("Frozen Depths reachability", () => {
  const arrive = "cp_depths_freight";

  it("before the light sensor: the lamp and the sensor are reachable, the rest is shut", () => {
    const r = reach("depths", arrive, EASY, stateWith({}));
    for (const id of ["headlamp_kit", "light_sensor", "log_passage", "cp_depths_chamber", "recorder_depths", "depths_freight"]) expect(has(r, id), id).toBe(true);
    for (const id of ["coupling_cache", "depths_junction", "sampler", "depths_lift", "depths_north"]) expect(has(r, id), id).toBe(false);
  });

  it("after the shutter: the coupling and the junction are reachable; the ice chamber is still shut", () => {
    const r = reach("depths", arrive, EASY, stateWith({ passageOpen: true }));
    for (const id of ["coupling_cache", "salvage_locker", "depths_junction", "depths_battery", "log_equipment"]) expect(has(r, id), id).toBe(true);
    for (const id of ["sampler", "depths_lift", "depths_north"]) expect(has(r, id), id).toBe(false);
  });

  it("after the circuit: drill, lift and North Access gate are reachable with easy jumps", () => {
    const r = reach("depths", arrive, EASY, stateWith({ passageOpen: true, circuitRestored: true }));
    for (const id of ["sampler", "log_ice", "sample_clay", "depths_lift", "log_service", "depths_north", "cp_depths_north"]) expect(has(r, id), id).toBe(true);
  });

  it("from the survey lift (shortcut arrival) Laika can reach the gate and walk back to the freight lift", () => {
    const r = reach("depths", "cp_depths_lift", EASY, stateWith({ passageOpen: true, circuitRestored: true }));
    for (const id of ["depths_north", "sampler", "depths_junction", "light_sensor", "depths_freight"]) expect(has(r, id), id).toBe(true);
  });

  it("secrets: the alcove treat is a normal jump; R-2's antenna needs Thruster Boots", () => {
    const s = stateWith({ passageOpen: true, circuitRestored: true });
    expect(has(reach("depths", arrive, BASIC_JUMP, s), "treat_depths")).toBe(true);
    expect(has(reach("depths", arrive, BASIC_JUMP, s), "rover_antenna")).toBe(false);
    expect(has(reach("depths", arrive, BOOTS_JUMP, s), "rover_antenna")).toBe(true);
  });
});

describe("Echo Ridge reachability", () => {
  const arrive = "cp_ridge_hatch";

  it("the mandatory route (relays, junction) needs only easy jumps; the tower opens with the network", () => {
    const closed = reach("ridge", arrive, EASY, stateWith({}));
    for (const id of ["relay_a", "comms_junction", "cp_ridge_camp", "relay_b", "relay_c", "cp_ridge_platform"]) expect(has(closed, id), id).toBe(true);
    expect(has(closed, "tower_console")).toBe(false);
    const open = reach("ridge", arrive, EASY, stateWith({ relayNetworkOnline: true }));
    for (const id of ["tower_console", "ridge_cable", "acoustic_sensor"]) expect(has(open, id), id).toBe(true);
  });

  it("the high ledges are a Thruster Boots route (olivine sample, weather station)", () => {
    for (const id of ["sample_olivine", "weather_station"]) {
      expect(has(reach("ridge", arrive, BASIC_JUMP, stateWith({ relayNetworkOnline: true })), id), id).toBe(false);
      expect(has(reach("ridge", arrive, BOOTS_JUMP, stateWith({ relayNetworkOnline: true })), id), id).toBe(true);
    }
  });

  it("the overlook cache needs the bark bridge (or boots)", () => {
    const s = stateWith({ relayNetworkOnline: true });
    expect(has(reach("ridge", arrive, BASIC_JUMP, s), "treat_ridge")).toBe(false);
    expect(has(reach("ridge", arrive, BASIC_JUMP, stateWith({ relayNetworkOnline: true, ridgeBridgeOut: true })), "treat_ridge")).toBe(true);
  });

  it("the cable car arrival on the tower top can walk all the way down to the North Access hatch", () => {
    const r = reach("ridge", "cp_ridge_tower", EASY, stateWith({ relayNetworkOnline: true }));
    expect(has(r, "ridge_hatch")).toBe(true);
  });
});

describe("no dead ends in any map, in any door state", () => {
  const cases: Array<[MapId, string, GameState]> = [
    ["depths", "cp_depths_freight", stateWith({})],
    ["depths", "cp_depths_freight", stateWith({ passageOpen: true })],
    ["depths", "cp_depths_freight", stateWith({ passageOpen: true, circuitRestored: true })],
    ["ridge", "cp_ridge_hatch", stateWith({})],
    ["ridge", "cp_ridge_hatch", stateWith({ relayNetworkOnline: true, ridgeBridgeOut: true })],
  ];
  for (const [map, from, s] of cases) {
    for (const jump of [BASIC_JUMP, BOOTS_JUMP]) {
      it(`${map} from ${from} (${Object.keys(s.flags).filter((k) => s.flags[k as keyof typeof s.flags]).join(",") || "start"}, ${jump === BOOTS_JUMP ? "boots" : "basic"})`, () => {
        const g = buildMap(MAPS[map], s);
        const start = stand(g, from);
        const fwd = reachableFrom(g, start[0], start[1], jump);
        const stuck: number[] = [];
        for (const k of fwd) {
          const c = k % 10000;
          const r = Math.floor(k / 10000);
          if (!reachableFrom(g, c, r, jump).has(cellKey(...start))) stuck.push(k);
          if (stuck.length > 3) break;
        }
        expect(stuck.map((k) => `${k % 10000},${Math.floor(k / 10000)}`)).toEqual([]);
      });
    }
  }
});
