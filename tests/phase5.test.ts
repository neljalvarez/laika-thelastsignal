/**
 * Phase 5 rules: chapter transitions, objective guidance (waypoints), notification priorities,
 * crafting and equipment, cosmetics, Mission 05, save v4 -> v5 and the text-length budget.
 * Everything runs on the pure systems, without a browser.
 */
import { describe, expect, it } from "vitest";
import { COSMETIC_ORDER, EQUIPMENT, EQUIPMENT_ORDER, GEAR } from "../src/data/equipment";
import { ITEMS } from "../src/data/items";
import { ALL_OBJECTS, findObject, MAPS, mapOfObject, type MapId } from "../src/data/regions/registry";
import { TUTORIAL_STAGES } from "../src/data/tutorial";
import { autoAdvance, CHAPTERS, chapterOfStage } from "../src/systems/chapters";
import {
  cosmeticUnlocked,
  craft,
  craftCard,
  lookKey,
  lookOf,
  recipeIsSafe,
  revealRadiusFactor,
  sniffRadiusFactor,
  suitMax,
  thrusterCostFactor,
  headlampFactor,
  toggleCosmetic,
  workbenchCards,
} from "../src/systems/crafting";
import { getInteraction, performInteraction, type Effect } from "../src/systems/interactions";
import { getObjective } from "../src/systems/mission";
import { BASIC_JUMP, canStand, cellKey, reachableFrom, standCellFor } from "../src/systems/navigation";
import { NoteQueue } from "../src/systems/notifications";
import { loadGame, migrate, sanitize, type KeyValueStore } from "../src/systems/save";
import { defaultSettings, parseSettings } from "../src/systems/settings";
import { sniffableObjects } from "../src/systems/sniff";
import { createNewState, STATE_VERSION, type GameState } from "../src/systems/state";
import { costFor, suitMaxOf } from "../src/systems/survival";
import { findPath, nextWaypoint, portals } from "../src/systems/waypoints";
import { buildMap } from "../src/systems/worldBuilder";

const revealed = new Set<string>(["buried_cartridge", "beacon_cache", "metal_cache"]);
const ctx = { revealed, mode: "relaxed" as const };
const use = (s: GameState, id: string): Effect[] => performInteraction(findObject(id)!, s, ctx);
const verb = (s: GameState, id: string) => getInteraction(findObject(id)!, s, ctx)?.verb;
const events = (fx: Effect[]) => fx.filter((e) => e.type === "world").map((e) => (e as { event: string }).event);
const words = (t: string) => t.split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;

const M01 = ["checkedShipRadio", "hatchOpen", "reachedOutpost", "inspectedReceiver", "solarRepaired", "moduleInstalled", "commsOnline", "bridgeExtended", "stationDoorOpen", "reachedStation", "demoComplete"] as const;
const M02 = ["m2Briefed", "depthsReached", "passageOpen", "junctionInspected", "circuitRestored", "iceChamberReached", "depthsLiftOpen", "relayAnalyzed"] as const;
const M03 = ["ridgeReached", "relayASwept", "cellInstalled", "relayCFound", "relayNetworkOnline", "towerReached", "signalTraced", "ridgeCableOpen"] as const;
const M04 = [
  "m4Briefed", "baseReturned", "baseSurveyed", "batteryRestored", "recyclerInspected", "recyclerFixed", "recyclerPowered", "recyclerOn", "waterRestored",
  "growPowered", "growValveOpen", "seedsPlanted", "growLightsOn", "shelterInspected", "probeOutRead", "probeInRead", "shelterRestored",
  "lightsOutStarted", "lightsOutBalanced", "lightsOutDone", "m4Complete",
] as const;

function base(): GameState {
  const s = createNewState();
  s.tutorial = { status: "done", stage: "done" };
  s.abilities.sniff = true;
  s.abilities.headlamp = true;
  s.sweptPanels = ["panel_1", "panel_2", "panel_3"];
  s.collected = ["sampler", "coupling_cache"];
  s.discovered.maps = ["surface", "depths", "ridge"];
  s.visitedCheckpoints = ["cp_ship", "cp_outpost", "cp_station", "cp_station_cable"];
  for (const id of ["relay_a", "relay_b", "relay_c"]) s.puzzles.relayAim[id] = findObject(id)!.aim ?? 0;
  return s;
}
function upTo(...groups: ReadonlyArray<readonly string[]>): GameState {
  const s = base();
  for (const g of groups) for (const f of g) (s.flags as Record<string, boolean>)[f] = true;
  return s;
}
function memStore(): KeyValueStore {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
}

// ---------------------------------------------------------------------------------------------

describe("chapters and mission transitions", () => {
  it("names five chapters in order", () => {
    expect(CHAPTERS.map((c) => c.n)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(CHAPTERS.slice(1).map((c) => c.title)).toEqual(["The Lost Signal", "Beneath the Red", "Echoes Above", "A Place to Call Home", "Built to Explore"]);
  });

  it("maps objective stages to chapters", () => {
    expect(chapterOfStage("m2_freight")).toBe(2);
    expect(chapterOfStage("m3_ridge")).toBe(3);
    expect(chapterOfStage("m4_battery")).toBe(4);
    expect(chapterOfStage("m5_bench")).toBe(5);
    expect(chapterOfStage("m3_complete")).not.toBe(3);
  });

  it("Mission 01 flows straight into Chapter 2 (no console trip, no end screen)", () => {
    const s = upTo(M01);
    const fx = autoAdvance(s);
    expect(s.flags.m2Briefed).toBe(true);
    expect(fx.some((e) => e.type === "transmission")).toBe(true);
    expect(autoAdvance(s)).toEqual([]); // only once
    const o = getObjective(s)!;
    expect(o.stage.startsWith("m2_")).toBe(true);
    expect(o.chapter).toBe(2);
  });

  it("Mission 03 flows into Chapter 4 by itself (the habitat ladder opens)", () => {
    const s = upTo(M01, M02, M03);
    expect(getObjective(s)!.stage).toBe("m4_call");
    autoAdvance(s);
    expect(s.flags.m4Briefed).toBe(true);
    expect(getObjective(s)!.stage).toBe("m4_home");
    expect(getObjective(s)!.chapter).toBe(4);
    const g = buildMap(MAPS.surface, s);
    expect(portals("surface", s, g).map((p) => p.objectId).sort()).toEqual(["habitat", "lower_stairs"]);
  });

  it("Mission 04 flows into Chapter 5", () => {
    const s = upTo(M01, M02, M03, M04);
    expect(getObjective(s)!.stage).toBe("m5_call");
    const fx = autoAdvance(s);
    expect(s.flags.m5Briefed).toBe(true);
    expect(fx.length).toBeGreaterThan(0);
    expect(getObjective(s)!.stage).toBe("m5_bench");
    expect(getObjective(s)!.chapter).toBe(5);
  });

  it("every chapter boundary has a next objective (the adventure never looks finished early)", () => {
    for (const groups of [[M01], [M01, M02], [M01, M02, M03], [M01, M02, M03, M04]] as const) {
      const s = upTo(...groups);
      for (let i = 0; i < 3; i++) autoAdvance(s);
      expect(getObjective(s), groups.length + " missions done").not.toBeNull();
    }
  });
});

describe("objective waypoints", () => {
  it("points at the ladder when the target is on the other level", () => {
    const s = upTo(M01, M02, M03, ["m4Briefed", "baseReturned"]);
    const g = buildMap(MAPS.surface, s);
    const wp = nextWaypoint(g, s, "surface", { col: 62, row: 30 }, "battery");
    expect(wp).not.toBeNull();
    expect(wp!.kind).toBe("portal");
    expect(wp!.objectId).toBe("lower_stairs");
  });

  it("points at the route (lift / gate) when the target is on another map", () => {
    const s = upTo(M01, M02, M03, ["m4Briefed", "baseReturned", "batteryRestored", "recyclerOn"]);
    const g = buildMap(MAPS.surface, s);
    expect(mapOfObject("sampler")).toBe("depths");
    const wp = nextWaypoint(g, s, "surface", { col: 66, row: 23 }, "sampler");
    expect(wp).not.toBeNull();
    expect(wp!.otherMap).toBe(true);
    expect(wp!.objectId).not.toBe("sampler");
    expect(mapOfObject(wp!.objectId!)).toBe("surface");
    // From the outpost the nearby survey lift is the way down, not the far freight lift.
    expect(wp!.objectId).toBe("outpost_lift");
    const far = nextWaypoint(g, s, "surface", { col: 224, row: 23 }, "sampler");
    expect(far!.objectId).toBe("station_lift");
  });

  it("gives no waypoint through a route that is still locked", () => {
    const s = createNewState(); // nothing open yet: the ridge cannot be reached
    const g = buildMap(MAPS.surface, s);
    const ridgeObj = ALL_OBJECTS.find((o) => mapOfObject(o.id) === "ridge")!;
    expect(nextWaypoint(g, s, "surface", { col: 10, row: 20 }, ridgeObj.id)).toBeNull();
  });

  it("follows standable cells around walls instead of a straight line", () => {
    const s = upTo(M01, M02, M03, ["m4Briefed"]);
    const g = buildMap(MAPS.surface, s);
    const start = standCellFor(g, 62, 31)!;
    const goal = standCellFor(g, findObject("battery")!.col, findObject("battery")!.row)!;
    const path = findPath(g, start, goal, BASIC_JUMP, portals("surface", s, g))!;
    expect(path).not.toBeNull();
    expect(path.some((p) => p.via === "lower_stairs")).toBe(true);
    for (const p of path) expect(canStand(g, p.c, p.r)).toBe(true);
    // Without the ladder there is no way up from the lower level.
    expect(findPath(g, start, goal, BASIC_JUMP, [])).toBeNull();
  });

  it("route waypoints are always on standable ground", () => {
    const s = upTo(M01);
    const g = buildMap(MAPS.surface, s);
    const wp = nextWaypoint(g, s, "surface", { col: 10, row: 20 }, "station_door");
    if (wp && wp.kind === "route") expect(canStand(g, Math.floor(wp.x / 16), Math.floor((wp.y + 12) / 16) - 1)).toBe(true);
  });
});

describe("notifications", () => {
  it("shows one at a time and never more than two", () => {
    const q = new NoteQueue();
    q.push({ text: "a", kind: "info" }, 0);
    q.push({ text: "b", kind: "info" }, 0);
    q.push({ text: "c", kind: "warn" }, 0);
    expect(q.take(0)!.text).toBe("c"); // warnings first
    expect(q.take(0)).toBeNull(); // only a warning may join a visible message
    expect(q.take(5000)!.text).toBe("a");
  });

  it("drops repeated text and merges pick-ups", () => {
    const q = new NoteQueue();
    q.push({ text: "Hello", kind: "info" }, 0);
    expect(q.take(0)!.text).toBe("Hello");
    expect(q.push({ text: "Hello", kind: "info" }, 1000)).toBe(false);
    q.push({ text: "+1 Metal", kind: "item", itemKey: "metal", amount: 1 }, 1000);
    q.push({ text: "+1 Metal", kind: "item", itemKey: "metal", amount: 1 }, 1100);
    expect(q.pending).toBe(1);
    expect(q.take(9000)!.text).toBe("+2 Metal");
  });

  it("keeps warnings and milestones when busy, drops routine messages first", () => {
    const q = new NoteQueue();
    for (let i = 0; i < 6; i++) q.push({ text: "info " + i, kind: "info" }, 0);
    q.push({ text: "Low power", kind: "warn" }, 0);
    q.push({ text: "Chapter 2", kind: "milestone" }, 0);
    expect(q.pending).toBeLessThanOrEqual(4);
    const out: string[] = [];
    for (let t = 0; t < 60000; t += 3000) {
      const n = q.take(t);
      if (n) out.push(n.text);
    }
    expect(out[0]).toBe("Low power");
    expect(out[1]).toBe("Chapter 2");
  });
});

describe("crafting", () => {
  const powered = true;
  it("recipes use only Metal and Circuits (never mission items)", () => {
    for (const id of EQUIPMENT_ORDER) {
      expect(recipeIsSafe(EQUIPMENT[id].cost), id).toBe(true);
      for (const k of Object.keys(EQUIPMENT[id].cost)) {
        expect(["metal", "electronics"]).toContain(k);
        expect(ITEMS[k as keyof typeof ITEMS].critical ?? false).toBe(false);
      }
    }
  });

  it("builds with enough parts, spends them once, and never twice", () => {
    const s = upTo(M01);
    s.inventory.metal = 5;
    s.inventory.electronics = 3;
    s.inventory.commsModule = 1; // a mission item: must never be touched
    s.gear.blueprints.push("booster");
    const fx = craft(s, "booster", powered);
    expect(events(fx)).toContain("crafted");
    expect(s.gear.built).toContain("booster");
    expect(s.inventory.metal).toBe(3);
    expect(s.inventory.electronics).toBe(2);
    expect(s.inventory.commsModule).toBe(1);
    expect(craft(s, "booster", powered).some((e) => e.type === "spend")).toBe(false);
    expect(s.inventory.metal).toBe(3);
    expect(s.gear.built.filter((g) => g === "booster")).toHaveLength(1);
  });

  it("refuses without enough parts, without power, or without the blueprint", () => {
    const s = upTo(M01);
    s.inventory.metal = 1;
    s.inventory.electronics = 0;
    s.gear.blueprints.push("booster");
    expect(craftCard(s, "booster", powered).status).toBe("missing");
    craft(s, "booster", powered);
    expect(s.gear.built).not.toContain("booster");
    expect(s.inventory.metal).toBe(1);
    s.inventory.metal = 9;
    s.inventory.electronics = 9;
    expect(craftCard(s, "booster", false).status).toBe("noPower");
    craft(s, "booster", false);
    expect(s.gear.built).not.toContain("booster");
    // No blueprint yet: the card is not even on the bench, and building it is refused.
    expect(workbenchCards(s, powered).map((c) => c.id)).not.toContain("reserveBattery");
    craft(s, "reserveBattery", powered);
    expect(s.gear.built).not.toContain("reserveBattery");
  });

  it("Efficient Boots need the Thruster Boots first", () => {
    const s = upTo(M01);
    s.inventory.metal = 9;
    s.inventory.electronics = 9;
    s.gear.blueprints.push("efficientBoots");
    expect(craftCard(s, "efficientBoots", powered).status).toBe("locked");
    craft(s, "boots", powered);
    expect(s.abilities.thrusters).toBe(true);
    expect(craftCard(s, "efficientBoots", powered).status).toBe("ready");
  });

  it("the workbench shows known blueprints only, all of them after Mission 05", () => {
    expect(workbenchCards(upTo(M01), powered).map((c) => c.id)).toEqual(["boots"]);
    const s = upTo(M01, M02, M03, M04, ["m5Briefed", "m5Blueprint", "beaconFound", "m5Complete"]);
    s.gear.blueprints = [...EQUIPMENT_ORDER];
    expect(workbenchCards(s, powered).map((c) => c.id)).toEqual(EQUIPMENT_ORDER);
  });

  it("equipment effects are permanent and automatic", () => {
    const s = upTo(M01, M02, M03, M04);
    s.inventory.metal = 20;
    s.inventory.electronics = 20;
    s.gear.blueprints = [...EQUIPMENT_ORDER];
    const before = { sniff: sniffRadiusFactor(s), reveal: revealRadiusFactor(s), suit: suitMax(s), thrust: thrusterCostFactor(s), lamp: headlampFactor(s) };
    for (const id of EQUIPMENT_ORDER) craft(s, id, powered);
    expect(sniffRadiusFactor(s)).toBeCloseTo(before.sniff * GEAR.boosterSniffRadius);
    expect(revealRadiusFactor(s)).toBeGreaterThan(before.reveal);
    expect(suitMax(s)).toBe(GEAR.reserveSuitMax);
    expect(suitMaxOf(s)).toBe(GEAR.reserveSuitMax);
    expect(thrusterCostFactor(s)).toBeCloseTo(GEAR.efficientCostFactor);
    expect(costFor(s, "thrust", "adventure")).toBeLessThan(costFor(upTo(M01), "thrust", "adventure") || 1e9);
    expect(headlampFactor(s)).toBeGreaterThan(before.lamp);
  });

  it("each upgrade opens one optional cache", () => {
    const s = upTo(M01, M02, M03, M04);
    const gated = ALL_OBJECTS.filter((o) => o.needs);
    expect(gated.map((o) => o.needs).sort()).toEqual(expect.arrayContaining(["booster", "surveyLamp"]));
    const near = (id: string) => sniffableObjects(ALL_OBJECTS, s).some((o) => o.id === id);
    expect(near("metal_cache")).toBe(false);
    s.gear.built.push("booster");
    expect(near("metal_cache")).toBe(true);
  });

  it("the world holds enough Metal and Circuits for Mission 01 plus every upgrade", () => {
    const cost = EQUIPMENT_ORDER.reduce(
      (a, id) => ({ metal: a.metal + (EQUIPMENT[id].cost.metal ?? 0), elec: a.elec + (EQUIPMENT[id].cost.electronics ?? 0) }),
      { metal: 2, elec: 1 }, // Mission 01's solar box repair
    );
    const supply = { metal: 0, elec: 0 };
    for (const o of ALL_OBJECTS) {
      if (o.item === "metal") supply.metal += 1;
      if (o.item === "electronics") supply.elec += 1;
    }
    expect(supply.metal).toBeGreaterThanOrEqual(cost.metal);
    expect(supply.elec).toBeGreaterThanOrEqual(cost.elec);
  });

  it("new crafting parts can be reached with the starting jump", () => {
    const s = upTo(M01, M02, M03, M04);
    const ids = ["metal_lower", "metal_hab", "elec_lower", "beacon_cache", "metal_cache", "metal_depths", "elec_depths", "metal_fissure", "metal_ice", "lamp_cache", "metal_ridge", "elec_ridge", "metal_ridge2", "elec_ridge2"];
    const groups = new Map<MapId, string[]>();
    for (const id of ids) {
      const m = mapOfObject(id);
      expect(m, id).toBeDefined();
      groups.set(m!, [...(groups.get(m!) ?? []), id]);
    }
    for (const [m, list] of groups) {
      const g = buildMap(MAPS[m], s);
      const cps = ALL_OBJECTS.filter((o) => o.kind === "checkpoint" && mapOfObject(o.id) === m);
      const reach = new Set<number>();
      for (const cp of cps) {
        const c = standCellFor(g, cp.col, cp.row);
        if (c) for (const k of reachableFrom(g, c[0], c[1], BASIC_JUMP)) reach.add(k);
      }
      for (const id of list) {
        const o = findObject(id)!;
        const c = standCellFor(g, o.col, o.row);
        expect(c, id).not.toBeNull();
        expect(reach.has(cellKey(c![0], c![1])), id).toBe(true);
      }
    }
  });
});

describe("cosmetics", () => {
  it("unlock from play and toggle on Laika", () => {
    const s = upTo(M01, M02, M03, M04);
    expect(cosmeticUnlocked(s, "patch")).toBe(true);
    expect(cosmeticUnlocked(s, "trimBlue")).toBe(false);
    expect(toggleCosmetic(s, "trimBlue")).toBe(false);
    expect(toggleCosmetic(s, "patch")).toBe(true);
    expect(lookOf(s).wear).toContain("patch");
    expect(lookKey(lookOf(s))).not.toBe("laika");
    toggleCosmetic(s, "patch");
    expect(lookOf(s).wear).not.toContain("patch");
    expect(COSMETIC_ORDER.length).toBeGreaterThanOrEqual(3);
    expect(COSMETIC_ORDER.length).toBeLessThanOrEqual(5);
  });

  it("built equipment shows on Laika automatically", () => {
    const s = upTo(M01);
    expect(lookKey(lookOf(s))).toBe("laika");
    s.gear.built.push("booster");
    expect(lookOf(s).booster).toBe(true);
  });
});

describe("Mission 05: Built to Explore", () => {
  it("can be completed: blueprint, build, find the beacon, link it", () => {
    const s = upTo(M01, M02, M03, M04);
    autoAdvance(s);
    expect(verb(s, "workstation")).toBe("Workbench");
    const fx = use(s, "workstation");
    expect(fx.some((e) => e.type === "ui")).toBe(true);
    expect(s.flags.m5Blueprint).toBe(true);
    expect(s.gear.blueprints).toContain("booster");
    s.inventory.metal = 2;
    s.inventory.electronics = 1;
    expect(getObjective(s)!.stage).toBe("m5_build");
    craft(s, "booster", true);
    expect(getObjective(s)!.stage).toBe("m5_beacon");
    use(s, "beacon_cache");
    expect(s.flags.beaconFound).toBe(true);
    expect(s.inventory.navBeacon).toBe(1);
    expect(getObjective(s)!.stage).toBe("m5_link");
    expect(verb(s, "receiver")).toBe("Link beacon");
    const end = use(s, "receiver");
    expect(s.flags.m5Complete).toBe(true);
    expect(end.some((e) => e.type === "transmission")).toBe(true);
    expect(s.gear.blueprints).toEqual(expect.arrayContaining([...EQUIPMENT_ORDER]));
  });

  it("asks for parts when the player has none", () => {
    const s = upTo(M01, M02, M03, M04);
    autoAdvance(s);
    use(s, "workstation");
    s.inventory.metal = 0;
    s.inventory.electronics = 0;
    const o = getObjective(s)!;
    expect(o.stage).toBe("m5_parts");
    expect(o.target).toBeDefined();
  });
});

describe("save v4 -> v5", () => {
  it("adds equipment to an old save and keeps everything else", () => {
    const s = upTo(M01, M02, M03, ["m4Briefed", "batteryRestored"]);
    const raw = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    raw.version = 4;
    delete raw.gear;
    (raw.abilities as Record<string, boolean>).thrusters = true;
    const st = memStore();
    st.setItem("laika-the-last-signal/save", JSON.stringify(raw));
    const r = loadGame(st);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.state.version).toBe(STATE_VERSION);
    expect(r.state.gear.built).toEqual([]);
    expect(r.state.gear.blueprints).toContain("boots");
    expect(r.state.abilities.thrusters).toBe(true);
    expect(r.state.flags.batteryRestored).toBe(true);
  });

  it("ignores unknown equipment ids and caps the suit without the reserve battery", () => {
    const raw = migrate({ ...JSON.parse(JSON.stringify(createNewState())), version: 5 })!;
    (raw as { gear: unknown }).gear = { built: ["laserCannon", "booster"], blueprints: ["booster", "???"], wear: ["nope"] };
    (raw as { eng: { suit: number } }).eng.suit = 140;
    const s = sanitize(raw);
    expect(s.gear.built).toEqual(["booster"]);
    expect(s.gear.blueprints).toEqual(["boots", "booster"]);
    expect(s.gear.wear).toEqual([]);
    expect(s.eng.suit).toBeLessThanOrEqual(100);
  });
});

describe("simplified text", () => {
  const states = [createNewState(), upTo(M01), upTo(M01, M02), upTo(M01, M02, M03), upTo(M01, M02, M03, M04)];
  it("objectives are short (a handful of words)", () => {
    for (const s0 of states) {
      const s = JSON.parse(JSON.stringify(s0)) as GameState;
      for (let i = 0; i < 3; i++) autoAdvance(s);
      const o = getObjective(s);
      if (!o) continue;
      expect(words(o.primary), o.primary).toBeLessThanOrEqual(7);
      expect(words(o.hint ?? ""), o.hint).toBeLessThanOrEqual(8);
    }
  });

  it("action prompts are one to three words", () => {
    for (const s of states) {
      for (const o of ALL_OBJECTS) {
        const it = getInteraction(o, s, ctx);
        if (it) expect(words(it.verb), `${o.id}: ${it.verb}`).toBeLessThanOrEqual(3);
      }
    }
  });

  it("item names are short and friendly", () => {
    for (const it of Object.values(ITEMS)) expect(words(it.short), it.short).toBeLessThanOrEqual(3);
  });

  it("tutorial steps are one short line", () => {
    for (const st of TUTORIAL_STAGES) expect(words(st.title), st.title).toBeLessThanOrEqual(6);
  });

  it("equipment benefits are one line", () => {
    for (const id of EQUIPMENT_ORDER) expect(words(EQUIPMENT[id].benefit), id).toBeLessThanOrEqual(8);
  });
});

describe("settings defaults", () => {
  it("new players get guided markers, a simple HUD and relaxed survival", () => {
    const d = defaultSettings();
    expect(d.guidance).toBe("guided");
    expect(d.hud).toBe("simple");
    expect(d.survival).toBe("relaxed");
  });

  it("existing choices are kept, accessibility options survive", () => {
    const d = parseSettings(JSON.stringify({ survival: "expedition", reducedMotion: true, textScale: 1.3, guidance: "minimal", hud: "detailed" }));
    expect(d.survival).toBe("expedition");
    expect(d.reducedMotion).toBe(true);
    expect(d.guidance).toBe("minimal");
    expect(d.hud).toBe("detailed");
    expect(parseSettings(JSON.stringify({ guidance: "bogus" })).guidance).toBe("guided");
  });
});
