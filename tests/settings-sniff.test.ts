import { describe, expect, it } from "vitest";
import { OBJECTS, objectPos } from "../src/data/world";
import { defaultSettings, keyLabel, parseSettings, rebind } from "../src/systems/settings";
import { sniff } from "../src/systems/sniff";
import { createNewState } from "../src/systems/state";
import { canAfford, collectOnce, missing, spend } from "../src/systems/inventory";

describe("settings", () => {
  it("falls back to defaults for missing or broken data", () => {
    expect(parseSettings(null)).toEqual(defaultSettings());
    expect(parseSettings("{oops")).toEqual(defaultSettings());
    const s = parseSettings(JSON.stringify({ master: 5, music: -1, textScale: 7, touchControls: "maybe" }));
    expect(s.master).toBe(1);
    expect(s.music).toBe(0);
    expect(s.textScale).toBe(1);
    expect(s.touchControls).toBe("auto");
  });

  it("respects the system reduced-motion preference by default", () => {
    expect(defaultSettings(true).reducedMotion).toBe(true);
  });

  it("rebinding a key already in use swaps the two actions", () => {
    const s = rebind(defaultSettings(), "jump", "KeyE");
    expect(s.bindings.jump).toBe("KeyE");
    expect(s.bindings.interact).toBe("Space");
  });

  it("labels keys readably", () => {
    expect(keyLabel("KeyE")).toBe("E");
    expect(keyLabel("ArrowLeft")).toBe("←");
    expect(keyLabel("ShiftLeft")).toBe("Shift");
  });
});

describe("inventory", () => {
  it("affordability, missing amounts and spending", () => {
    const s = createNewState();
    s.inventory.metal = 1;
    expect(canAfford(s, { metal: 2 })).toBe(false);
    expect(missing(s, { metal: 2, electronics: 1 })).toEqual({ metal: 1, electronics: 1 });
    s.inventory.metal = 3;
    spend(s, { metal: 2 });
    expect(s.inventory.metal).toBe(1);
    expect(collectOnce(s, "x", "metal")).toBe(true);
    expect(collectOnce(s, "x", "metal")).toBe(false);
    expect(s.inventory.metal).toBe(2);
  });
});

describe("sniff scanner", () => {
  const s = createNewState();
  const module = OBJECTS.find((o) => o.id === "comms_module")!;
  const p = objectPos(module);

  it("detects buried things in range with direction and strength", () => {
    const d = sniff(p.x - 100, p.y - 6, OBJECTS, s);
    const hit = d.find((x) => x.id === "comms_module")!;
    expect(hit).toBeDefined();
    expect(hit.dx).toBeGreaterThan(0);
    expect(hit.revealed).toBe(false);
    expect(hit.strength).toBeGreaterThan(0);
  });

  it("only reveals a spot when Laika is close", () => {
    const d = sniff(p.x - 10, p.y - 6, OBJECTS, s);
    expect(d.find((x) => x.id === "comms_module")?.revealed).toBe(true);
  });

  it("does not detect far away or already collected things", () => {
    expect(sniff(p.x - 600, p.y, OBJECTS, s).find((x) => x.id === "comms_module")).toBeUndefined();
    const s2 = createNewState();
    s2.collected.push("comms_module");
    expect(sniff(p.x, p.y - 6, OBJECTS, s2).find((x) => x.id === "comms_module")).toBeUndefined();
  });

  it("never lists pickups that are already visible (only hidden things)", () => {
    const d = sniff(objectPos(OBJECTS.find((o) => o.id === "metal_ship")!).x, 352, OBJECTS, createNewState());
    expect(d.every((x) => x.kind === "buried" || x.kind === "secret")).toBe(true);
  });
});
