import { describe, expect, it } from "vitest";
import { SAVE_BACKUP_KEY, SAVE_KEY, SETTINGS_KEY } from "../src/config/constants";
import { deleteSave, hasSave, loadGame, repairState, saveGame, type KeyValueStore } from "../src/systems/save";
import { createNewState } from "../src/systems/state";

function memStore(init: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...init };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

describe("save system", () => {
  it("uses its own namespace, separate from the original game", () => {
    for (const k of [SAVE_KEY, SETTINGS_KEY, SAVE_BACKUP_KEY]) {
      expect(k.startsWith("laika-the-last-signal/")).toBe(true);
      expect(k.startsWith("laika-mission-red-planet")).toBe(false);
    }
  });

  it("round-trips a state", () => {
    const store = memStore();
    const s = createNewState();
    s.flags.hatchOpen = true;
    s.inventory.metal = 3;
    s.collected.push("metal_ship");
    s.checkpoint = "cp_outpost";
    s.visitedCheckpoints.push("cp_outpost");
    expect(saveGame(store, s)).toBe(true);
    const r = loadGame(store);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.state.flags.hatchOpen).toBe(true);
    expect(r.state.inventory.metal).toBe(3);
    expect(r.state.checkpoint).toBe("cp_outpost");
  });

  it("never touches the original game's save", () => {
    const store = memStore({ "laika-mission-red-planet/save": "ORIGINAL" });
    saveGame(store, createNewState());
    deleteSave(store);
    expect(store.data["laika-mission-red-planet/save"]).toBe("ORIGINAL");
  });

  it("backs up and ignores corrupted JSON", () => {
    const store = memStore({ [SAVE_KEY]: "{not json" });
    const r = loadGame(store);
    expect(r.status).toBe("corrupt");
    expect(store.data[SAVE_BACKUP_KEY]).toBe("{not json");
    expect(hasSave(store)).toBe(false);
  });

  it("rejects saves from an unknown version", () => {
    const store = memStore({ [SAVE_KEY]: JSON.stringify({ version: 99 }) });
    expect(loadGame(store).status).toBe("corrupt");
  });

  it("sanitizes junk values", () => {
    const junk = {
      version: 1,
      flags: { hatchOpen: "yes", solarRepaired: true },
      inventory: { metal: -5, electronics: 1e9, commsModule: "x" },
      collected: ["metal_ship", "metal_ship", 42, "not_a_real_object"],
      checkpoint: "nowhere",
      sweptPanels: ["panel_1", "panel_9"],
    };
    const r = loadGame(memStore({ [SAVE_KEY]: JSON.stringify(junk) }));
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.state.flags.hatchOpen).toBe(true); // implied by later progress (solar repaired)
    expect(r.state.inventory.metal).toBeGreaterThanOrEqual(0);
    expect(r.state.inventory.electronics).toBeLessThanOrEqual(99);
    expect(r.state.collected).toEqual(["metal_ship"]);
    expect(r.state.checkpoint).toBe("cp_ship");
    expect(r.state.sweptPanels).toEqual(["panel_1"]);
  });

  it("returns a lost comms module (mission-critical items are never lost)", () => {
    const s = createNewState();
    s.collected.push("comms_module");
    s.inventory.commsModule = 0;
    const fixed = repairState(s);
    expect(s.inventory.commsModule).toBe(1);
    expect(fixed.join()).toContain("comms module");
  });

  it("tops up solar parts if they were somehow spent elsewhere", () => {
    const s = createNewState();
    // Every metal in the world collected but none held, array not repaired.
    s.collected.push("metal_ship", "metal_crates", "metal_canyon", "metal_cavern", "metal_mesa");
    s.inventory.metal = 0;
    repairState(s);
    expect(s.inventory.metal).toBeGreaterThanOrEqual(2);
  });

  it("makes later milestones imply earlier ones", () => {
    const s = createNewState();
    s.flags.bridgeExtended = true;
    repairState(s);
    expect(s.flags.commsOnline).toBe(true);
    expect(s.flags.moduleInstalled).toBe(true);
    expect(s.flags.solarRepaired).toBe(true);
    expect(s.sweptPanels).toHaveLength(3);
    expect(s.abilities.sniff).toBe(true);
  });

  it("works without storage (private mode)", () => {
    expect(loadGame(null).status).toBe("none");
    expect(saveGame(null, createNewState())).toBe(false);
  });
});
