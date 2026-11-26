/**
 * Phase 4 rules: power, battery, distribution, facilities, greenhouse, suit energy, recharging,
 * survival assistance, Mission 04, LIGHTS OUT, the challenges, the science journal and save v4.
 * Everything runs on the pure systems, without a browser.
 */
import { describe, expect, it } from "vitest";
import { ENGINEERING, SUIT, type SurvivalMode } from "../src/data/engineering";
import { findObject } from "../src/data/regions/registry";
import { SCIENCE } from "../src/data/science";
import {
  allocationFits,
  computePower,
  EngineClock,
  generation,
  plantStage,
  recommendedAllocation,
  stepEngineering,
} from "../src/systems/engineering";
import { completeMission04, lightsOutReady, markReturned, setAllocation, startLightsOut, syncScience } from "../src/systems/facilities";
import { getInteraction, performInteraction, type Effect } from "../src/systems/interactions";
import { getObjective } from "../src/systems/mission";
import { craft } from "../src/systems/crafting";
import { loadGame, migrate, sanitize, saveGame, type KeyValueStore } from "../src/systems/save";
import { cloneState, createNewState, STATE_VERSION, type GameState } from "../src/systems/state";
import { airJumpLimit, canUse, scanRadiusFactor, spend, SuitReserve } from "../src/systems/survival";

const revealed = new Set<string>(["buried_cartridge", "buried_cell"]);
const ctxFor = (mode: SurvivalMode = "adventure") => ({ revealed, mode });
const use = (s: GameState, id: string, mode: SurvivalMode = "adventure"): Effect[] => performInteraction(findObject(id)!, s, ctxFor(mode));
const verb = (s: GameState, id: string, mode: SurvivalMode = "adventure") => getInteraction(findObject(id)!, s, ctxFor(mode))?.verb;
const events = (fx: Effect[]) => fx.filter((e) => e.type === "world").map((e) => (e as { event: string }).event);

/** A save at the end of Mission 03 (what a finished Phase 3 player has). */
function afterMission03(): GameState {
  const s = createNewState();
  s.tutorial = { status: "done", stage: "done" };
  for (const f of [
    "checkedShipRadio", "hatchOpen", "reachedOutpost", "inspectedReceiver", "solarRepaired", "moduleInstalled", "commsOnline", "bridgeExtended",
    "stationDoorOpen", "reachedStation", "demoComplete", "m2Briefed", "depthsReached", "passageOpen", "junctionInspected", "circuitRestored",
    "iceChamberReached", "depthsLiftOpen", "relayAnalyzed", "ridgeReached", "relayASwept", "cellInstalled", "relayCFound", "relayNetworkOnline",
    "towerReached", "signalTraced", "ridgeCableOpen",
  ] as const) s.flags[f] = true;
  s.sweptPanels = ["panel_1", "panel_2", "panel_3"];
  s.abilities.sniff = true;
  s.abilities.headlamp = true;
  s.collected = ["sampler", "coupling_cache"];
  s.checkpoint = "cp_station_cable";
  s.visitedCheckpoints = ["cp_ship", "cp_outpost", "cp_station", "cp_station_cable"];
  s.discovered.maps = ["surface", "depths", "ridge"];
  for (const id of ["relay_a", "relay_b", "relay_c"]) s.puzzles.relayAim[id] = findObject(id)!.aim ?? 0;
  return s;
}

function memStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

/** Runs the simulation for `ms` of active play. */
function run(s: GameState, ms: number, mode: SurvivalMode = "adventure") {
  let last = computePower(s, mode);
  for (let t = 0; t < ms; t += ENGINEERING.stepMs) last = stepEngineering(s, mode).status;
  return last;
}

/** Plays Mission 04 up to (not including) LIGHTS OUT, in the recommended order. */
function restoreBase(s: GameState): void {
  use(s, "beacon");
  markReturned(s);
  use(s, "base_terminal");
  use(s, "cargo_locker");
  use(s, "battery");
  use(s, "recycler"); // inspect
  use(s, "buried_cartridge"); // dig (revealed by the scanner)
  use(s, "recycler"); // install
  use(s, "recycler_power");
  use(s, "recycler"); // start
  use(s, "water_processor"); // inspect
  use(s, "sampler"); // spare coupling from the depths' core drill
  use(s, "water_processor"); // install
  use(s, "grow_power");
  use(s, "grow_valve");
  use(s, "habitat_storage");
  use(s, "planter"); // plant
  use(s, "planter"); // lights
  use(s, "shelter_terminal"); // wake
  use(s, "probe_shelter");
  use(s, "probe_surface");
  use(s, "shelter_terminal"); // log
}

describe("solar power and battery", () => {
  it("generation follows repair, clean panels, dust and sunlight", () => {
    const s = afterMission03();
    expect(generation(s, "adventure")).toBe(3 * ENGINEERING.panelOutput);
    s.eng.dusty = ["panel_1"];
    expect(generation(s, "adventure")).toBe(2 * ENGINEERING.panelOutput + ENGINEERING.dustyPanelOutput);
    s.eng.dusty = [];
    s.flags.lightsOutStarted = true; // haze
    expect(generation(s, "adventure")).toBeCloseTo(3 * ENGINEERING.panelOutput * ENGINEERING.hazeSun.adventure);
    const off = createNewState();
    expect(generation(off, "adventure")).toBe(0);
  });

  it("the battery charges from surplus and stops at its capacity", () => {
    const s = afterMission03();
    s.flags.m4Briefed = true;
    s.flags.batteryRestored = true;
    s.eng.battery = 10;
    run(s, 2000);
    expect(s.eng.battery).toBeGreaterThan(10);
    run(s, 600_000);
    expect(s.eng.battery).toBe(ENGINEERING.batteryCapacity.adventure);
  });

  it("the battery covers a shortage, then never goes below zero", () => {
    const s = afterMission03();
    restoreBase(s);
    startLightsOut(s);
    s.eng.battery = 5;
    const p = run(s, 500);
    expect(p.net).toBeLessThan(0);
    expect(s.eng.battery).toBeLessThan(5);
    run(s, 600_000);
    expect(s.eng.battery).toBe(0);
  });

  it("an empty battery switches optional systems off first; critical systems keep running", () => {
    const s = afterMission03();
    restoreBase(s);
    startLightsOut(s);
    s.eng.battery = 0;
    const p = run(s, 500);
    expect(p.powered.lifeSupport && p.powered.habitat && p.powered.shelter).toBe(true);
    expect(p.brownout).toContain("greenhouse");
    expect(p.use).toBeLessThanOrEqual(p.gen + 1e-6);
    // ...and a shortage never undoes a restoration or a mission.
    expect(s.flags.recyclerOn && s.flags.waterRestored && s.flags.growLightsOn && s.flags.m4Briefed).toBe(true);
  });

  it("before the battery is restored the lower level has no power, the receiver still runs on sunlight", () => {
    const s = afterMission03();
    s.flags.recyclerOn = true; // e.g. a hand-edited save
    const p = computePower(s, "adventure");
    expect(p.powered.lifeSupport).toBe(false);
    expect(p.powered.research).toBe(true);
  });
});

describe("power distribution (LIGHTS OUT)", () => {
  it("life support is protected: the console only switches optional systems", () => {
    const s = afterMission03();
    restoreBase(s);
    startLightsOut(s);
    setAllocation(s, "adventure", { water: false, greenhouse: false, research: false });
    const p = computePower(s, "adventure");
    expect(p.powered.lifeSupport).toBe(true);
    expect(p.powered.greenhouse).toBe(false);
  });

  it("a choice that fits the haze balances the network and leaves dust on two panels", () => {
    const s = afterMission03();
    restoreBase(s);
    expect(lightsOutReady(s)).toBe(true);
    startLightsOut(s);
    expect(allocationFits(s, "adventure", { water: true, greenhouse: true, research: true })).toBe(false);
    setAllocation(s, "adventure", { water: true, greenhouse: true, research: true });
    expect(s.flags.lightsOutBalanced).toBe(false);
    const rec = recommendedAllocation(s, "adventure");
    expect(rec.greenhouse).toBe(false); // the grow lights need the most
    expect(allocationFits(s, "adventure", rec)).toBe(true);
    const fx = setAllocation(s, "adventure", rec);
    expect(events(fx)).toContain("lightsOutBalanced");
    expect(s.eng.dusty).toEqual([...ENGINEERING.hazeDustPanels]);
    // The choice can be changed again without any penalty.
    setAllocation(s, "adventure", { water: false, greenhouse: false, research: false });
    expect(s.flags.lightsOutBalanced).toBe(true);
  });

  it("sweeping the dusty panels finishes LIGHTS OUT and switches everything back on", () => {
    const s = afterMission03();
    restoreBase(s);
    startLightsOut(s);
    setAllocation(s, "adventure", recommendedAllocation(s, "adventure"));
    expect(verb(s, "panel_1")).toBe("Clean panel");
    expect(verb(s, "panel_2")).toBeUndefined(); // clean panels have nothing to sweep
    use(s, "panel_1");
    expect(s.flags.lightsOutDone).toBe(false);
    const fx = use(s, "panel_3");
    expect(events(fx)).toContain("lightsOutDone");
    expect(s.eng.alloc).toEqual({ water: true, greenhouse: true, research: true });
    expect(generation(s, "adventure")).toBe(3 * ENGINEERING.panelOutput);
  });

  it("the on-screen hint is enough: switching off only the grow lights balances it (Relaxed, Adventure); Expedition asks for one more", () => {
    for (const mode of ["relaxed", "adventure"] as SurvivalMode[]) {
      const s = afterMission03();
      restoreBase(s);
      startLightsOut(s);
      expect(allocationFits(s, mode, { water: true, greenhouse: false, research: true }), mode).toBe(true);
    }
    const s = afterMission03();
    restoreBase(s);
    startLightsOut(s);
    expect(allocationFits(s, "expedition", { water: true, greenhouse: false, research: true })).toBe(false);
    expect(allocationFits(s, "expedition", { water: true, greenhouse: false, research: false })).toBe(true);
  });

  it("is completable in every survival mode", () => {
    for (const mode of ["relaxed", "adventure", "expedition"] as SurvivalMode[]) {
      const s = afterMission03();
      restoreBase(s);
      startLightsOut(s);
      setAllocation(s, mode, recommendedAllocation(s, mode));
      expect(s.flags.lightsOutBalanced, mode).toBe(true);
      use(s, "panel_1", mode);
      use(s, "panel_3", mode);
      expect(s.flags.lightsOutDone, mode).toBe(true);
    }
  });
});

describe("facilities and dependencies", () => {
  it("nothing on the lower level starts before the battery bus is restored", () => {
    const s = afterMission03();
    use(s, "beacon");
    use(s, "recycler_power");
    use(s, "grow_power");
    use(s, "shelter_terminal");
    expect(s.flags.recyclerPowered || s.flags.growPowered || s.flags.shelterInspected).toBe(false);
  });

  it("life support: find the pump, then one press installs it and starts the recycler (each step once)", () => {
    // Phase 5: the separate inspect / power-box / start presses were merged into one repair.
    const s = afterMission03();
    use(s, "beacon");
    use(s, "cargo_locker");
    use(s, "battery");
    expect(s.flags.recyclerPowered).toBe(true); // the battery's cables reach every room
    expect(verb(s, "recycler")).toBe("Check life support");
    use(s, "recycler");
    expect(s.flags.recyclerOn).toBe(false); // still missing the pump
    use(s, "buried_cartridge");
    expect(s.inventory.recyclerPart).toBe(1);
    const fx = use(s, "recycler");
    expect(events(fx)).toContain("recyclerOn");
    use(s, "recycler"); // pressing again does not consume anything else
    expect(s.flags.recyclerFixed && s.flags.recyclerOn).toBe(true);
    expect(s.inventory.recyclerPart).toBe(0);
    expect(s.science).toContain("water_recovery");
  });

  it("a pump installed before the battery waits, then starts with one press once there is power", () => {
    const s = afterMission03();
    use(s, "beacon");
    s.inventory.recyclerPart = 1;
    s.collected.push("buried_cartridge");
    use(s, "recycler");
    expect(s.flags.recyclerFixed).toBe(true);
    expect(s.flags.recyclerOn).toBe(false);
    use(s, "cargo_locker");
    use(s, "battery");
    use(s, "recycler");
    expect(s.flags.recyclerOn).toBe(true);
  });

  it("water circulation needs the depths' melt-line coupling, which can only be taken once", () => {
    const s = afterMission03();
    use(s, "beacon");
    use(s, "cargo_locker");
    use(s, "battery");
    use(s, "water_processor");
    expect(verb(s, "sampler")).toBe("Take pipe connector");
    use(s, "sampler");
    expect(verb(s, "sampler")).toBe("Check core drill");
    use(s, "sampler");
    expect(s.inventory.waterCoupling).toBe(1);
    use(s, "water_processor");
    expect(s.flags.waterRestored).toBe(true);
    expect(s.inventory.waterCoupling).toBe(0);
    expect(s.inventory.sample).toBe(0); // no geological sample was consumed
  });

  it("the greenhouse needs water and seeds; planting switches the lights on (Phase 5: fewer presses)", () => {
    const s = afterMission03();
    use(s, "beacon");
    use(s, "cargo_locker");
    use(s, "battery");
    use(s, "habitat_storage");
    use(s, "planter");
    expect(s.flags.seedsPlanted).toBe(false); // dry
    use(s, "water_processor");
    use(s, "sampler");
    use(s, "water_processor");
    expect(s.flags.growValveOpen).toBe(true); // water opens the grow-room valve
    use(s, "planter");
    expect(s.flags.seedsPlanted && s.flags.growLightsOn).toBe(true);
    expect(s.inventory.seeds).toBe(0);
  });

  it("seeds planted without battery power wait for light (no growth), then one press switches the lights on", () => {
    const s = afterMission03();
    use(s, "beacon");
    s.flags.waterRestored = true;
    s.flags.growValveOpen = true;
    use(s, "habitat_storage");
    use(s, "planter");
    expect(s.flags.seedsPlanted).toBe(true);
    expect(s.flags.growLightsOn).toBe(false);
    use(s, "cargo_locker");
    use(s, "battery");
    use(s, "planter");
    expect(s.flags.growLightsOn).toBe(true);
  });

  it("the shelter exercise: wake the monitor, bark at both probes (the second reading finishes it)", () => {
    const s = afterMission03();
    use(s, "beacon");
    use(s, "cargo_locker");
    use(s, "battery");
    use(s, "probe_shelter"); // asleep
    expect(s.flags.probeInRead).toBe(false);
    use(s, "shelter_terminal");
    expect(verb(s, "probe_shelter")).toBe("Bark");
    use(s, "probe_shelter");
    use(s, "shelter_terminal"); // one reading is not enough
    expect(s.flags.shelterRestored).toBe(false);
    const fx = use(s, "probe_surface");
    expect(events(fx)).toContain("shelterOn");
    expect(s.flags.shelterRestored).toBe(true);
    expect(s.science).toContain("radiation");
  });
});

describe("greenhouse growth", () => {
  function planted(): GameState {
    const s = afterMission03();
    restoreBase(s);
    return s;
  }

  it("grows from seeds to mature plants with active play, then stops", () => {
    const s = planted();
    expect(plantStage(s)).toBe(1);
    run(s, ENGINEERING.growStageMs[0] + 250);
    expect(plantStage(s)).toBe(2);
    run(s, 120_000);
    expect(plantStage(s)).toBe(4);
    expect(s.eng.growMs).toBe(ENGINEERING.growStageMs[2]);
  });

  it("does not grow without power to the grow lights (paused simulation = no growth)", () => {
    const s = planted();
    setAllocation(s, "adventure", { water: true, greenhouse: false, research: true });
    run(s, 30_000);
    expect(s.eng.growMs).toBe(0);
  });

  it("the first harvest happens once and a new crop starts", () => {
    const s = planted();
    run(s, 120_000);
    expect(verb(s, "planter")).toBe("Harvest");
    use(s, "planter");
    expect(s.flags.cropHarvested).toBe(true);
    expect(plantStage(s)).toBe(2);
    expect(verb(s, "planter")).toBe("Plants");
  });
});

describe("suit energy and recharging", () => {
  it("costs nothing before Mission 04 (Missions 00-03 play exactly as before)", () => {
    const s = afterMission03();
    s.abilities.thrusters = true;
    s.eng.suit = 0;
    expect(canUse(s, "thrust", "expedition")).toBe(true);
    expect(airJumpLimit(s, "expedition", 0)).toBe(1);
    expect(airJumpLimit(s, "expedition", 1)).toBe(1); // no boost before the suit meter exists
    expect(scanRadiusFactor(s, "expedition")).toBe(1);
  });

  it("thrusters and the boost spend energy; with too little energy they simply do not fire", () => {
    const s = afterMission03();
    use(s, "beacon");
    s.abilities.thrusters = true;
    expect(s.eng.suit).toBe(SUIT.max);
    expect(airJumpLimit(s, "adventure", 0)).toBe(1);
    expect(spend(s, "thrust", "adventure")).toBe(true);
    expect(airJumpLimit(s, "adventure", 1)).toBe(2);
    expect(spend(s, "boost", "adventure")).toBe(true);
    expect(s.eng.suit).toBe(SUIT.max - SUIT.thrustCost.adventure - SUIT.boostCost.adventure);
    s.eng.suit = 3;
    expect(airJumpLimit(s, "adventure", 0)).toBe(0);
    expect(spend(s, "thrust", "adventure")).toBe(false);
    expect(s.eng.suit).toBe(3); // a failed spend changes nothing
  });

  it("Relaxed mode never restricts anything", () => {
    const s = afterMission03();
    use(s, "beacon");
    s.abilities.thrusters = true;
    s.eng.suit = 0;
    expect(airJumpLimit(s, "relaxed", 0)).toBe(1);
    expect(airJumpLimit(s, "relaxed", 1)).toBe(2);
    expect(spend(s, "scan", "relaxed")).toBe(true);
    expect(scanRadiusFactor(s, "relaxed")).toBe(1);
  });

  it("at zero energy the scanner still works at short range (no dig spot can be locked away)", () => {
    const s = afterMission03();
    use(s, "beacon");
    s.eng.suit = 0;
    expect(scanRadiusFactor(s, "adventure")).toBeCloseTo(SUIT.scanFallbackRadius);
    expect(SUIT.scanFallbackRadius * 176).toBeGreaterThan(44); // still wider than the reveal radius
  });

  it("zero energy recovers: the reserve cell trickles back, stations and the bed refill it", () => {
    const s = afterMission03();
    use(s, "beacon");
    s.eng.suit = 0;
    const reserve = new SuitReserve();
    reserve.tick(s, "adventure", 1000);
    expect(s.eng.suit).toBe(0); // waits a moment after the last use
    for (let t = 0; t < 60_000; t += 250) reserve.tick(s, "adventure", 250);
    expect(s.eng.suit).toBe(SUIT.reserveLevel.adventure);
    const fx = use(s, "recharge_outpost");
    expect(events(fx)).toContain("recharge");
    expect(s.eng.suit).toBe(SUIT.max);
    s.eng.suit = 10;
    use(s, "habitat_mat");
    expect(s.eng.suit).toBe(SUIT.max);
  });

  it("the canyon's dead recharge post needs a power cell, then wakes the seismometer (Challenge A)", () => {
    const s = afterMission03();
    use(s, "beacon");
    expect(verb(s, "recharge_canyon")).toBe("Check post");
    use(s, "seismometer");
    expect(s.flags.seismometerRead).toBe(false);
    use(s, "buried_cell");
    use(s, "recharge_canyon");
    expect(s.flags.canyonPostFixed).toBe(true);
    expect(verb(s, "recharge_canyon")).toBe("Recharge");
    use(s, "seismometer");
    use(s, "seismometer");
    expect(s.inventory.recording).toBe(1); // once
    expect(s.science).toContain("marsquakes");
  });

  it("Challenge B and C rewards are given once", () => {
    const s = afterMission03();
    use(s, "deep_probe");
    use(s, "deep_probe");
    expect(s.inventory.sample).toBe(1);
    use(s, "telescope_north");
    expect(s.flags.observatoryReached).toBe(true);
  });
});

describe("suit reserve safety", () => {
  it("the reserve floor always pays for one thruster jump, in every mode", () => {
    for (const mode of ["relaxed", "adventure", "expedition"] as SurvivalMode[]) {
      expect(SUIT.reserveLevel[mode], mode).toBeGreaterThanOrEqual(SUIT.thrustCost[mode]);
    }
  });
});

describe("simulation timing", () => {
  it("advances in fixed steps, the same at 30, 60 and 144 fps", () => {
    const results = [30, 60, 144].map((fps) => {
      const s = afterMission03();
      restoreBase(s);
      s.eng.battery = 20;
      const clock = new EngineClock();
      const dt = 1000 / fps;
      for (let t = 0; t < 10_000; t += dt) clock.advance(dt, (ms) => stepEngineering(s, "adventure", ms));
      return s.eng.battery;
    });
    expect(Math.abs(results[0] - results[1])).toBeLessThan(0.5);
    expect(Math.abs(results[2] - results[1])).toBeLessThan(0.5);
  });

  it("a huge gap (tab switch, hitch) is clamped: never more than a few steps per frame", () => {
    const s = afterMission03();
    restoreBase(s);
    const clock = new EngineClock();
    const n = clock.advance(3_600_000, (ms) => stepEngineering(s, "adventure", ms));
    expect(n).toBeLessThanOrEqual(ENGINEERING.maxStepsPerFrame);
    expect(s.eng.growMs).toBeLessThanOrEqual(ENGINEERING.stepMs * ENGINEERING.maxStepsPerFrame);
  });

  it("nothing changes while the clock is not advanced (paused, menus, hidden tab, offline)", () => {
    const s = afterMission03();
    restoreBase(s);
    startLightsOut(s);
    s.eng.battery = 50;
    const before = JSON.stringify(s.eng);
    // A saved game reloaded much later: loading never simulates the time away.
    const store = memStore();
    saveGame(store, s);
    const r = loadGame(store);
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(JSON.stringify(r.state.eng)).toBe(before);
  });
});

describe("Mission 04: A Place to Call Home", () => {
  it("a finished Mission 03 leads straight into Mission 04", () => {
    const s = afterMission03();
    expect(getObjective(s).stage).toBe("m4_call");
    expect(verb(s, "beacon")).toBe("Answer the call");
    expect(verb(s, "habitat")).toBe("Check habitat"); // sealed until the base override
  });

  it("plays start to finish on the rules, recommending one step at a time", () => {
    const s = afterMission03();
    const stages: string[] = [];
    const note = () => {
      const st = getObjective(s).stage;
      if (stages[stages.length - 1] !== st) stages.push(st);
    };
    note();
    use(s, "beacon");
    note();
    expect(verb(s, "habitat")).toBe("Go down");
    markReturned(s);
    note();
    use(s, "base_terminal");
    note();
    restoreBase(s);
    note();
    expect(getObjective(s).stage).toBe("m4_wait");
    startLightsOut(s);
    note();
    setAllocation(s, "adventure", recommendedAllocation(s, "adventure"));
    note();
    use(s, "panel_1");
    use(s, "panel_3");
    note();
    const fx = completeMission04(s);
    note();
    expect(events(fx)).toContain("m4Complete");
    // Phase 5: no separate "check the terminal" stage; Chapter 5 follows Chapter 4.
    expect(stages).toEqual(["m4_call", "m4_home", "m4_regulator", "m4_wait", "m4_balance", "m4_sweep", "m4_look", "m5_call"]);
    expect(s.flags.m4Complete).toBe(true);
    expect(completeMission04(s)).toEqual([]); // once
  });

  it("restoration tasks work in another sensible order (shelter and greenhouse before life support)", () => {
    const s = afterMission03();
    use(s, "beacon");
    use(s, "cargo_locker");
    use(s, "battery");
    use(s, "shelter_terminal");
    use(s, "probe_shelter");
    use(s, "probe_surface");
    use(s, "shelter_terminal");
    use(s, "water_processor");
    use(s, "sampler");
    use(s, "water_processor");
    use(s, "grow_power");
    use(s, "grow_valve");
    use(s, "habitat_storage");
    use(s, "planter");
    use(s, "planter");
    expect(getObjective(s).stage).toBe("m4_cartridge"); // Phase 5: straight to "dig up the pump"
    use(s, "recycler");
    use(s, "buried_cartridge");
    use(s, "recycler");
    use(s, "recycler_power");
    use(s, "recycler");
    expect(lightsOutReady(s)).toBe(true);
  });

  it("spending metal on Thruster Boots first never blocks the base (mission items are unique)", () => {
    const s = afterMission03();
    s.inventory.metal = 2;
    s.inventory.electronics = 1;
    craft(s, "boots", true); // build boots at the workbench (Phase 5)
    expect(s.abilities.thrusters).toBe(true);
    restoreBase(s);
    expect(lightsOutReady(s)).toBe(true);
  });

  it("the journal unlocks entries from achievements, each with a source and a fiction note", () => {
    const s = afterMission03();
    syncScience(s);
    expect(s.science).toEqual(expect.arrayContaining(["water_ice", "relays", "delay", "solar_dust"]));
    for (const e of SCIENCE) {
      expect(e.source.url.startsWith("https://"), e.id).toBe(true);
      expect(e.fiction.length, e.id).toBeGreaterThan(10);
    }
  });
});

describe("saves (v4) and migration", () => {
  it("is version 5 (Phase 5 added the workbench)", () => {
    expect(STATE_VERSION).toBe(5);
  });

  it("a completed Phase 3 (v3) save continues into Mission 04 with everything kept", () => {
    const s3 = afterMission03() as unknown as Record<string, unknown>;
    const raw: Record<string, unknown> = { ...s3, version: 3 };
    delete raw.eng;
    delete raw.science;
    const store = memStore();
    store.setItem("laika-the-last-signal/save", JSON.stringify(raw));
    const r = loadGame(store);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    const s = r.state;
    expect(s.version).toBe(STATE_VERSION);
    expect(s.flags.ridgeCableOpen && s.flags.relayAnalyzed && s.flags.demoComplete).toBe(true);
    expect(s.collected).toEqual(expect.arrayContaining(["sampler", "coupling_cache"]));
    expect(s.abilities.headlamp).toBe(true);
    expect(s.discovered.maps).toEqual(expect.arrayContaining(["surface", "depths", "ridge"]));
    expect(s.eng.suit).toBe(SUIT.max);
    expect(s.eng.battery).toBe(0);
    expect(s.science).toContain("water_ice"); // back-filled
    expect(getObjective(s).stage).toBe("m4_call");
  });

  it("v1 and v2 saves migrate all the way to the current version", () => {
    expect(migrate({ version: 1, flags: {}, abilities: { sniff: true } })?.version).toBe(STATE_VERSION);
    expect(migrate({ version: 2, flags: {} })?.version).toBe(STATE_VERSION);
  });

  it("recovers a corrupted engineering block instead of erasing the campaign", () => {
    const raw = { ...(afterMission03() as unknown as Record<string, unknown>), eng: { battery: -50, growMs: "lots", suit: 9999, alloc: "x", dusty: ["panel_9", "panel_1"] }, science: ["nope", "battery"] };
    const s = sanitize(raw);
    expect(s.eng.battery).toBe(0);
    expect(s.eng.growMs).toBe(0);
    expect(s.eng.suit).toBe(SUIT.max);
    expect(s.eng.alloc).toEqual({ water: true, greenhouse: true, research: true });
    expect(s.eng.dusty).toEqual(["panel_1"]);
    expect(s.science).toEqual(["battery"]);
    expect(s.flags.ridgeCableOpen).toBe(true);
  });

  it("saving during LIGHTS OUT and loading resumes exactly there", () => {
    const s = afterMission03();
    restoreBase(s);
    startLightsOut(s);
    setAllocation(s, "adventure", recommendedAllocation(s, "adventure"));
    use(s, "panel_1");
    const store = memStore();
    saveGame(store, s);
    const r = loadGame(store);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.state.eng.dusty).toEqual(["panel_3"]);
    expect(getObjective(r.state).stage).toBe("m4_sweep");
  });

  it("mission items are never lost or duplicated (an interrupted repair keeps its part)", () => {
    const s = afterMission03();
    use(s, "beacon");
    use(s, "cargo_locker");
    s.inventory.regulator = 0; // lost somehow, e.g. a hand-edited save
    const store = memStore();
    saveGame(store, s);
    let r = loadGame(store);
    expect(r.status === "ok" && r.state.inventory.regulator).toBe(1);
    const t = cloneState(s);
    t.flags.batteryRestored = true;
    t.inventory.regulator = 3;
    saveGame(store, t);
    r = loadGame(store);
    expect(r.status === "ok" && r.state.inventory.regulator).toBe(0);
  });

  it("an installed part's source is marked empty on load (no second cartridge from an old or edited save)", () => {
    const s = afterMission03();
    restoreBase(s);
    s.collected = s.collected.filter((id) => id !== "buried_cartridge");
    s.seen = s.seen.filter((id) => !id.startsWith("took:"));
    const store = memStore();
    saveGame(store, s);
    const r = loadGame(store);
    if (r.status !== "ok") throw new Error(r.status);
    expect(r.state.collected).toContain("buried_cartridge");
    expect(r.state.seen).toEqual(expect.arrayContaining(["took:cargo_locker", "took:drill_coupling", "took:habitat_storage"]));
    expect(r.state.inventory.recyclerPart).toBe(0);
  });

  it("changing Survival Assistance mid-mission keeps everything valid", () => {
    const s = afterMission03();
    restoreBase(s);
    s.eng.battery = 100;
    run(s, 1000, "expedition"); // smaller battery: clamped, not lost progress
    expect(s.eng.battery).toBeLessThanOrEqual(ENGINEERING.batteryCapacity.expedition);
    run(s, 1000, "relaxed");
    expect(s.flags.batteryRestored && s.flags.recyclerOn).toBe(true);
  });
});
