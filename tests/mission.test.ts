import { describe, expect, it } from "vitest";
import { OBJECTS } from "../src/data/world";
import { getInteraction, performInteraction, type Effect } from "../src/systems/interactions";
import { getObjective } from "../src/systems/mission";
import { createNewState, isPowered, type GameState } from "../src/systems/state";

const all = new Set(OBJECTS.map((o) => o.id));
const ctx = { revealed: all };
const obj = (id: string) => OBJECTS.find((o) => o.id === id)!;
const use = (s: GameState, id: string): Effect[] => performInteraction(obj(id), s, ctx);
const worldEvents = (fx: Effect[]) => fx.filter((e) => e.type === "world").map((e) => (e as { event: string }).event);

describe("Mission 01: A Signal in the Silence", () => {
  it("starts in the ship with the radio objective", () => {
    const s = createNewState();
    expect(getObjective(s).stage).toBe("radio");
    expect(s.abilities.sniff).toBe(false);
    expect(s.checkpoint).toBe("cp_ship");
  });

  it("plays from start to finish in order and every stage advances", () => {
    const s = createNewState();
    const stages: string[] = [getObjective(s).stage];
    const step = (id: string) => {
      const fx = use(s, id);
      const st = getObjective(s).stage;
      if (stages[stages.length - 1] !== st) stages.push(st);
      return fx;
    };
    step("shipRadio");
    expect(worldEvents(step("hatch"))).toContain("hatchOpen");
    step("metal_ship");
    const rec = step("receiver");
    expect(worldEvents(rec)).toContain("sniffUnlocked");
    expect(s.abilities.sniff).toBe(true);
    step("metal_crates");
    step("elec_outpost");
    expect(worldEvents(step("solarControl"))).toContain("solarRepaired");
    expect(isPowered(s)).toBe(false);
    step("panel_1");
    step("panel_2");
    const last = step("panel_3");
    expect(worldEvents(last)).toContain("powerOn");
    expect(isPowered(s)).toBe(true);
    step("comms_module");
    expect(s.inventory.commsModule).toBe(1);
    expect(worldEvents(step("receiver"))).toContain("moduleInstalled");
    expect(s.inventory.commsModule).toBe(0);
    const tune = step("receiver");
    expect(worldEvents(tune)).toContain("commsOnline");
    expect(tune.some((e) => e.type === "transmission" && e.id === "firstSignal")).toBe(true);
    expect(worldEvents(step("bridgeControl"))).toContain("bridgeExtend");
    expect(worldEvents(step("stationDoor"))).toContain("stationDoorOpen");
    s.flags.reachedStation = true; // set by walking inside
    if (stages[stages.length - 1] !== getObjective(s).stage) stages.push(getObjective(s).stage);
    expect(worldEvents(step("beacon"))).toContain("demoComplete");
    // Phase 3: finishing Mission 01 now leads straight into Mission 02's first objective.
    expect(stages).toEqual(["radio", "hatch", "receiver", "restore", "bridge", "station", "beacon", "m2_brief"]);
  });

  it("allows the solar repair and the comms module in either order", () => {
    const s = createNewState();
    for (const id of ["shipRadio", "hatch", "receiver", "comms_module"]) use(s, id);
    use(s, "receiver"); // install before power
    expect(s.flags.moduleInstalled).toBe(true);
    expect(getInteraction(obj("receiver"), s, ctx)?.detail).toBe("No power");
    for (const id of ["metal_ship", "metal_crates", "elec_outpost", "solarControl", "panel_1", "panel_2", "panel_3"]) use(s, id);
    expect(getInteraction(obj("receiver"), s, ctx)?.verb).toBe("Tune receiver");
  });

  it("panels can be swept before the array is repaired", () => {
    const s = createNewState();
    for (const id of ["panel_1", "panel_2", "panel_3"]) use(s, id);
    expect(isPowered(s)).toBe(false);
    s.abilities.sniff = true;
    for (const id of ["metal_ship", "metal_crates", "elec_outpost"]) use(s, id);
    const fx = use(s, "solarControl");
    expect(worldEvents(fx)).toContain("powerOn");
  });

  it("never collects the same item twice", () => {
    const s = createNewState();
    use(s, "metal_ship");
    expect(use(s, "metal_ship")).toEqual([]);
    expect(s.inventory.metal).toBe(1);
    expect(s.collected.filter((c) => c === "metal_ship")).toHaveLength(1);
  });

  it("cannot dig before the scanner works or before the spot is revealed", () => {
    const s = createNewState();
    expect(getInteraction(obj("elec_outpost"), s, ctx)).toBeNull();
    s.abilities.sniff = true;
    expect(getInteraction(obj("elec_outpost"), s, { revealed: new Set() })).toBeNull();
    expect(getInteraction(obj("elec_outpost"), s, ctx)?.verb).toBe("Dig");
  });

  it("does not spend parts without enough of them", () => {
    const s = createNewState();
    s.inventory.metal = 1;
    s.inventory.electronics = 1;
    const fx = use(s, "solarControl");
    expect(s.flags.solarRepaired).toBe(false);
    expect(s.inventory.metal).toBe(1);
    expect(fx.some((e) => e.type === "toast" && e.tone === "warn")).toBe(true);
  });

  it("gates the bridge and the station door behind the radio", () => {
    const s = createNewState();
    use(s, "bridgeControl");
    expect(s.flags.bridgeExtended).toBe(false);
    use(s, "stationDoor");
    expect(s.flags.stationDoorOpen).toBe(false);
  });

  it("the workstation builds Thruster Boots only with power and parts", () => {
    const s = createNewState();
    s.inventory.metal = 4;
    s.inventory.electronics = 2;
    use(s, "workstation");
    expect(s.abilities.thrusters).toBe(false);
    s.flags.solarRepaired = true;
    s.sweptPanels = ["panel_1", "panel_2", "panel_3"];
    expect(worldEvents(use(s, "workstation"))).toContain("thrusters");
    expect(s.abilities.thrusters).toBe(true);
    expect(s.inventory.metal).toBe(2);
  });

  it("objective text tracks part counts", () => {
    const s = createNewState();
    s.flags.hatchOpen = true;
    s.flags.inspectedReceiver = true;
    s.inventory.metal = 1;
    const o = getObjective(s);
    expect(o.steps[0].text).toContain("Metal 1/2");
    expect(o.hint).toContain("Crimson Canyon");
  });
});
