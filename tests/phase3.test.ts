/**
 * Phase 3 rules: Headlamp, puzzles, Missions 02-03, shortcuts, map discovery, saves and migration.
 * Everything runs on the pure systems, without a browser.
 */
import { describe, expect, it } from "vitest";
import { findObject } from "../src/data/regions/registry";
import { getInteraction, performInteraction, type Effect } from "../src/systems/interactions";
import { getObjective, journal } from "../src/systems/mission";
import { networkStatus, relayAligned } from "../src/systems/puzzles";
import { connectionOpen, discover, nextHop, routeTo, sectionAt } from "../src/systems/regions";
import { loadGame, migrate, repairState, sanitize, saveGame, type KeyValueStore } from "../src/systems/save";
import { cloneState, createNewState, STATE_VERSION, type GameState } from "../src/systems/state";

const revealed = new Set<string>(["coupling_cache", "recorder_depths", "sample_clay", "rover_wheel"]);
const ctx = { revealed };
const use = (s: GameState, id: string): Effect[] => performInteraction(findObject(id)!, s, ctx);
const verb = (s: GameState, id: string) => getInteraction(findObject(id)!, s, ctx)?.verb;
const at = (s: GameState, id: string) => {
  const o = findObject(id)!;
  return discover(s, id.startsWith("cp_ridge") || ["relay_c", "tower_console"].includes(id) ? "ridge" : "depths", o.col, o.row - 1);
};

/** A save at the end of Mission 01 (what a finished Phase 1/2 player has). */
function afterMission01(): GameState {
  const s = createNewState();
  s.tutorial = { status: "done", stage: "done" };
  for (const f of ["checkedShipRadio", "hatchOpen", "reachedOutpost", "inspectedReceiver", "solarRepaired", "moduleInstalled", "commsOnline", "bridgeExtended", "stationDoorOpen", "reachedStation", "demoComplete"] as const) s.flags[f] = true;
  s.sweptPanels = ["panel_1", "panel_2", "panel_3"];
  s.abilities.sniff = true;
  s.checkpoint = "cp_station";
  s.visitedCheckpoints = ["cp_ship", "cp_outpost", "cp_canyon", "cp_rover", "cp_rim", "cp_station"];
  return s;
}

function memStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

function playMission02(s: GameState): void {
  use(s, "beacon");
  use(s, "station_lift");
  at(s, "cp_depths_freight");
  use(s, "headlamp_kit");
  use(s, "light_sensor");
  use(s, "depths_junction");
  use(s, "coupling_cache");
  use(s, "depths_junction");
  at(s, "cp_depths_ice");
  use(s, "sampler");
  use(s, "depths_lift");
  use(s, "receiver");
}

function playMission03(s: GameState): void {
  at(s, "cp_ridge_hatch");
  use(s, "relay_a");
  use(s, "comms_junction");
  for (let i = 0; i < 3; i++) use(s, "relay_b");
  at(s, "relay_c");
  for (let i = 0; i < 3; i++) use(s, "relay_c");
  at(s, "tower_console");
  use(s, "tower_console");
  use(s, "ridge_cable");
}

describe("Mission 02: Beneath the Red", () => {
  it("a finished Mission 01 leads straight into Mission 02", () => {
    const o = getObjective(afterMission01());
    expect(o.stage).toBe("m2_brief");
    expect(o.title).toContain("Mission 02");
    expect(o.target).toBe("beacon");
  });

  it("plays start to finish on the rules, with objectives following each step", () => {
    const s = afterMission01();
    const seen: string[] = [];
    const step = (fn: () => void) => {
      fn();
      seen.push(getObjective(s).stage);
    };
    step(() => use(s, "beacon"));
    expect(connectionOpen(s, "freightLift")).toBe(true);
    const travel = use(s, "station_lift").find((e) => e.type === "travel");
    expect(travel).toMatchObject({ type: "travel", map: "depths", arrive: "cp_depths_freight" });
    step(() => at(s, "cp_depths_freight"));
    step(() => use(s, "headlamp_kit"));
    expect(s.abilities.headlamp).toBe(true);
    step(() => use(s, "light_sensor"));
    expect(s.flags.passageOpen).toBe(true);
    step(() => use(s, "depths_junction"));
    step(() => use(s, "coupling_cache"));
    expect(s.inventory.coupling).toBe(1);
    step(() => use(s, "depths_junction"));
    expect(s.flags.circuitRestored).toBe(true);
    expect(s.inventory.coupling).toBe(0);
    step(() => at(s, "cp_depths_ice"));
    step(() => use(s, "sampler"));
    expect(s.inventory.relayCell).toBe(1);
    step(() => use(s, "depths_lift"));
    expect(connectionOpen(s, "surveyLift")).toBe(true);
    step(() => use(s, "receiver"));
    expect(s.flags.relayAnalyzed).toBe(true);
    expect(seen).toEqual(["m2_descend", "m2_lamp", "m2_light", "m2_junction", "m2_coupling", "m2_install", "m2_drill", "m2_drill", "m2_lift", "m2_analyse", "m3_gate"]);
  });

  it("the light sensor ignores Laika until she has the Headlamp", () => {
    const s = afterMission01();
    use(s, "beacon");
    use(s, "light_sensor");
    expect(s.flags.passageOpen).toBe(false);
    expect(verb(s, "light_sensor")).toBe("Inspect light sensor");
  });

  it("puzzles are idempotent: the drill, the locker and the coupling never pay out twice", () => {
    const s = afterMission01();
    playMission02(s);
    const before = cloneState(s);
    use(s, "sampler");
    use(s, "sampler");
    use(s, "salvage_locker");
    use(s, "salvage_locker");
    use(s, "coupling_cache");
    use(s, "depths_junction");
    expect(s.inventory.relayCell).toBe(before.inventory.relayCell);
    expect(s.inventory.sample).toBe(before.inventory.sample);
    expect(s.inventory.coupling).toBe(0);
    expect(s.inventory.metal).toBe(before.inventory.metal + 2); // the locker, once
  });

  it("the survey lift needs the circuit, then a one-time start (the shortcut)", () => {
    const s = afterMission01();
    use(s, "beacon");
    expect(verb(s, "depths_lift")).toBe("Inspect survey lift");
    expect(use(s, "depths_lift").some((e) => e.type === "travel")).toBe(false);
    s.flags.circuitRestored = true;
    expect(verb(s, "depths_lift")).toBe("Start the survey lift");
    use(s, "depths_lift");
    expect(s.flags.depthsLiftOpen).toBe(true);
    expect(use(s, "outpost_lift").find((e) => e.type === "travel")).toMatchObject({ map: "depths", arrive: "cp_depths_lift" });
  });

  it("gates explain why they are locked and never move Laika before they open", () => {
    const s = afterMission01();
    for (const id of ["station_lift", "outpost_lift", "depths_north", "station_cable"]) {
      const fx = use(s, id);
      expect(fx.some((e) => e.type === "travel"), id).toBe(false);
      expect(fx.some((e) => e.type === "toast" && e.tone === "warn"), id).toBe(true);
    }
  });
});

describe("Mission 03: Echoes Above", () => {
  it("plays start to finish; the tower opens only when every relay reports in", () => {
    const s = afterMission01();
    playMission02(s);
    expect(connectionOpen(s, "northGate")).toBe(true);
    at(s, "cp_ridge_hatch");
    expect(getObjective(s).stage).toBe("m3_relayA");
    use(s, "relay_a");
    expect(getObjective(s).stage).toBe("m3_cell");
    use(s, "comms_junction");
    expect(s.flags.cellInstalled).toBe(true);
    expect(s.flags.relayNetworkOnline).toBe(false);
    for (let i = 0; i < 3; i++) use(s, "relay_b");
    expect(relayAligned(s, "relay_b")).toBe(true);
    expect(getObjective(s).stage).toBe("m3_findC");
    at(s, "relay_c");
    expect(s.flags.relayCFound).toBe(true);
    for (let i = 0; i < 3; i++) use(s, "relay_c");
    expect(s.flags.relayNetworkOnline).toBe(true);
    expect(getObjective(s).stage).toBe("m3_trace");
    at(s, "tower_console");
    use(s, "tower_console");
    expect(s.flags.signalTraced).toBe(true);
    const fx = use(s, "ridge_cable");
    expect(s.flags.ridgeCableOpen).toBe(true);
    expect(fx.some((e) => e.type === "world" && e.event === "mission03Complete")).toBe(true);
    expect(getObjective(s).stage).toBe("m4_call"); // Phase 4: finishing Mission 03 leads straight into Mission 04
    expect(use(s, "station_cable").find((e) => e.type === "travel")).toMatchObject({ map: "ridge", arrive: "cp_ridge_tower" });
  });

  it("relays can be fixed in any order; turning past the target wraps around", () => {
    const s = afterMission01();
    playMission02(s);
    at(s, "relay_c");
    for (let i = 0; i < 3; i++) use(s, "relay_c");
    for (let i = 0; i < 8; i++) use(s, "relay_b"); // 0 -> ... wraps -> stops when aligned
    expect(relayAligned(s, "relay_b")).toBe(true);
    use(s, "relay_a");
    expect(s.flags.relayNetworkOnline).toBe(false); // no cell yet
    use(s, "comms_junction");
    expect(s.flags.relayNetworkOnline).toBe(true);
  });

  it("the junction's status screen uses symbols and words, not colour alone", () => {
    const s = afterMission01();
    const lines = networkStatus(s).join(" ");
    for (const t of ["△", "○", "□", "OFFLINE", "MISSING"]) expect(lines).toContain(t);
  });

  it("Bark at the acoustic sensor extends the overlook bridge once", () => {
    const s = afterMission01();
    use(s, "acoustic_sensor");
    expect(s.flags.ridgeBridgeOut).toBe(true);
    const again = use(s, "acoustic_sensor");
    expect(again.some((e) => e.type === "world" && e.event === "bridgeOut")).toBe(false);
  });
});

describe("world map discovery and routing", () => {
  it("discovers sections and landmarks once, and sets arrival flags", () => {
    const s = afterMission01();
    const first = discover(s, "depths", 22, 27);
    expect(first.sections.map((x) => x.id)).toEqual(["d_ice"]);
    expect(first.flags).toContain("iceChamberReached");
    expect(first.flags).toContain("depthsReached");
    expect(discover(s, "depths", 22, 27)).toEqual({ sections: [], landmarks: [], flags: [] });
    expect(discover(s, "ridge", 10, 57).landmarks.map((l) => l.id)).toContain("lm_tower"); // the tower is visible from the start
  });

  it("routes hints through the right connection, region first", () => {
    const s = afterMission01();
    expect(nextHop(s, "surface", "depths")).toBeNull(); // nothing open yet
    use(s, "beacon");
    expect(nextHop(s, "surface", "depths")?.object).toBe("station_lift");
    s.flags.depthsLiftOpen = true;
    expect(nextHop(s, "depths", "surface")?.object).toBe("depths_freight"); // first open connection found
    s.flags.relayAnalyzed = true;
    expect(nextHop(s, "surface", "ridge")?.connection).toBeDefined();
    const r = routeTo(s, "surface", "relay_a")!;
    expect(r.regionName).toBe("Echo Ridge");
    expect(["station_lift", "outpost_lift"]).toContain(r.localTarget);
  });

  it("sections cover arrival points", () => {
    expect(sectionAt("depths", 126, 11)?.id).toBe("d_entrance");
    expect(sectionAt("ridge", 6, 57)?.id).toBe("r_approach");
    expect(sectionAt("surface", 80, 23)?.id).toBe("s_outpost");
  });
});

describe("saves (v3) and migration", () => {
  it("is at least version 3 (v4 since Phase 4)", () => {
    expect(STATE_VERSION).toBeGreaterThanOrEqual(3);
  });

  it("a completed Phase 2 (v2) save continues into Mission 02 with everything kept", () => {
    const v2 = { ...afterMission01(), version: 2 } as Record<string, unknown>;
    delete v2.discovered;
    delete v2.puzzles;
    (v2.abilities as Record<string, unknown>).headlamp = undefined;
    (v2.inventory as Record<string, unknown>) = { metal: 1, electronics: 2, commsModule: 0, sample: 2, treat: 1 };
    v2.collected = ["metal_ship", "treat", "sample_basalt", "sample_gypsum"];
    const store = memStore();
    store.setItem("laika-the-last-signal/save", JSON.stringify(v2));
    const res = loadGame(store);
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    const s = res.state;
    expect(s.version).toBe(STATE_VERSION); // v2 -> v3 -> current
    expect(s.inventory).toMatchObject({ metal: 1, electronics: 2, sample: 2, treat: 1, coupling: 0, relayCell: 0 });
    expect(s.collected).toEqual(["metal_ship", "treat", "sample_basalt", "sample_gypsum"]);
    expect(s.flags.demoComplete).toBe(true);
    expect(s.abilities.headlamp).toBe(false);
    expect(s.tutorial.status).toBe("done");
    expect(s.checkpoint).toBe("cp_station");
    expect(s.discovered.sections).toEqual(expect.arrayContaining(["s_outpost", "s_station", "s_rover"])); // back-filled
    expect(getObjective(s).stage).toBe("m2_brief");
  });

  it("v1 saves migrate all the way to v3", () => {
    const m = migrate({ version: 1, flags: {}, abilities: { sniff: true } });
    expect(m?.version).toBe(STATE_VERSION); // v1 -> v2 -> v3 -> current
    expect((m?.abilities as Record<string, unknown>).bark).toBe(true);
  });

  it("recovers invalid region data instead of erasing the campaign", () => {
    const raw = {
      ...afterMission01(),
      checkpoint: "cp_does_not_exist",
      discovered: { maps: ["mars2", "depths"], sections: ["d_ice", "nope"], landmarks: [42] },
      puzzles: { relayAim: { relay_b: 9, relay_c: "x" } },
    };
    const s = sanitize(raw as unknown as Record<string, unknown>);
    expect(s.checkpoint).toBe("cp_station"); // last valid visited checkpoint, not the ship
    expect(s.discovered.maps).toEqual(["surface", "depths"]);
    expect(s.discovered.sections).toEqual(["d_ice"]);
    expect(s.puzzles.relayAim).toMatchObject({ relay_b: 0, relay_c: 1 });
  });

  it("an interrupted transition (saved at the arrival checkpoint) loads in the new map with consistent flags", () => {
    const s = afterMission01();
    s.checkpoint = "cp_depths_freight"; // the lift saves the destination before switching maps
    const fixed = repairState(s);
    expect(s.flags.m2Briefed && s.flags.depthsReached).toBe(true);
    expect(fixed.length).toBeGreaterThan(0);
  });

  it("mission-critical items can never be lost or duplicated", () => {
    const s = afterMission01();
    playMission02(s);
    s.inventory.relayCell = 0; // somehow lost before installing
    repairState(s);
    expect(s.inventory.relayCell).toBe(1);
    s.inventory.relayCell = 5;
    repairState(s);
    expect(s.inventory.relayCell).toBe(1);
    playMission03(s);
    repairState(s);
    expect(s.inventory.relayCell).toBe(0);
    const t = afterMission01();
    t.collected.push("coupling_cache");
    repairState(t);
    expect(t.inventory.coupling).toBe(1);
  });

  it("later milestones imply earlier ones (hand-edited saves stay completable)", () => {
    const s = createNewState();
    s.flags.signalTraced = true;
    repairState(s);
    expect(s.flags.relayNetworkOnline && s.flags.cellInstalled && s.flags.relayAnalyzed && s.flags.circuitRestored && s.flags.m2Briefed && s.flags.demoComplete).toBe(true);
    expect(s.abilities.headlamp).toBe(true);
    expect(relayAligned(s, "relay_b") && relayAligned(s, "relay_c")).toBe(true);
  });

  it("Headlamp, puzzles and discovery survive a save/load round trip", () => {
    const s = afterMission01();
    playMission02(s);
    s.puzzles.relayAim.relay_b = 2;
    const store = memStore();
    saveGame(store, s);
    const res = loadGame(store);
    expect(res.status).toBe("ok");
    if (res.status !== "ok") return;
    expect(res.state.abilities.headlamp).toBe(true);
    expect(res.state.flags.depthsLiftOpen).toBe(true);
    expect(res.state.puzzles.relayAim.relay_b).toBe(2);
    expect(res.state.discovered.sections).toEqual(expect.arrayContaining(["d_entrance", "d_ice"]));
  });

  it("returning to an earlier region keeps every solved puzzle solved", () => {
    const s = afterMission01();
    playMission02(s);
    playMission03(s);
    const snapshot = JSON.stringify(s.flags);
    discover(s, "surface", 70, 23);
    discover(s, "depths", 22, 27);
    discover(s, "ridge", 10, 57);
    expect(JSON.stringify(s.flags)).toBe(snapshot);
  });

  it("the journal counts optional discoveries across the whole world", () => {
    const j = journal(createNewState());
    // Phase 4 adds the seismometer's recording, R-2's camera (observation platform) and the deep ice core.
    expect(j.find((e) => e.label === "Golden Treats")?.total).toBe(3);
    expect(j.find((e) => e.label === "Research recordings")?.total).toBe(3);
    expect(j.find((e) => e.label === "Rover R-2 parts")?.total).toBe(3);
    expect(j.find((e) => e.label === "Geological samples")?.total).toBe(7);
  });
});
