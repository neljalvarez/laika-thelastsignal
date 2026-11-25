import { describe, expect, it } from "vitest";
import { STATE_VERSION } from "../src/systems/state";
import { SAVE_KEY, TUNING } from "../src/config/constants";
import { LAIKA_ANIMS, LAIKA_FRAME_NAMES, laikaFrames, legAt, WALK, TROT } from "../src/art/laika";
import { OBJECTS } from "../src/data/world";
import { createIdle, gaitTimeScale, locomotionAnim, LIE_AFTER_MS, SIT_AFTER_MS, SLEEP_AFTER_MS, stepIdle } from "../src/systems/animState";
import { createHints, createStruggle, HINT_TIMES, recordJump, requestHint, updateHints } from "../src/systems/hints";
import { barkEffects, getInteraction } from "../src/systems/interactions";
import { getObjective } from "../src/systems/mission";
import { initialMoveState, maxJumpHeight, stepMovement } from "../src/systems/movement";
import { loadGame, type KeyValueStore } from "../src/systems/save";
import { defaultSettings, parseSettings } from "../src/systems/settings";
import { detect, signalLevel, trend, sniffTargets } from "../src/systems/sniff";
import { createNewState } from "../src/systems/state";

const obj = (id: string) => OBJECTS.find((o) => o.id === id)!;

describe("save migration v1 -> v2", () => {
  const v1 = {
    version: 1,
    flags: { checkedShipRadio: true, hatchOpen: true, inspectedReceiver: true, solarRepaired: true },
    inventory: { metal: 2, electronics: 1, commsModule: 1, sample: 1, treat: 0 },
    collected: ["metal_ship", "comms_module"],
    abilities: { sniff: true, sweep: true, thrusters: true },
    sweptPanels: ["panel_1"],
    seen: [],
    checkpoint: "cp_rover",
    visitedCheckpoints: ["cp_ship", "cp_rover"],
    playTimeMs: 99000,
  };
  const store = (data: unknown): KeyValueStore => {
    const d: Record<string, string> = { [SAVE_KEY]: JSON.stringify(data) };
    return { getItem: (k) => d[k] ?? null, setItem: (k, v) => void (d[k] = v), removeItem: (k) => void delete d[k] };
  };

  it("keeps all Phase 1 progress, adds Bark, and never forces the tutorial", () => {
    const r = loadGame(store(v1));
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    const s = r.state;
    expect(s.version).toBe(STATE_VERSION); // migrates step by step to the current format (v3 since Phase 3)
    // Every Phase 1 item count is kept exactly; items added in later phases start at zero.
    expect(s.inventory).toEqual({ ...v1.inventory, coupling: 0, relayCell: 0, recording: 0, roverPart: 0 });
    expect(s.abilities).toEqual({ sniff: true, sweep: true, thrusters: true, bark: true, headlamp: false }); // Headlamp: Phase 3, not yet found
    expect(s.flags.solarRepaired).toBe(true);
    expect(s.checkpoint).toBe("cp_rover");
    expect(s.tutorial).toEqual({ status: "skipped", stage: "done" });
  });

  it("recovers a corrupt tutorial record instead of trapping the player", () => {
    const bad = { ...createNewState(), tutorial: { status: "banana", stage: 42 } };
    const r = loadGame(store(bad));
    expect(r.status === "ok" && r.state.tutorial).toEqual({ status: "skipped", stage: "done" });
    const weird = { ...createNewState(), tutorial: { status: "active", stage: "nope" } };
    const r2 = loadGame(store(weird));
    expect(r2.status === "ok" && r2.state.tutorial.status).toBe("active");
    expect(r2.status === "ok" && r2.state.tutorial.stage).toBe("done");
  });

  it("an 'active' tutorial with campaign progress is treated as finished", () => {
    const s = createNewState();
    s.flags.hatchOpen = true;
    const r = loadGame(store(s));
    expect(r.status === "ok" && r.state.tutorial.status).toBe("done");
  });
});

describe("adaptive hints", () => {
  const ctx = (over: Partial<Parameters<typeof updateHints>[2]> = {}) => ({ enabled: true, blocked: false, active: true, exploringOptional: false, progressKey: "a", ...over });

  it("escalate with active play and reset on progress", () => {
    const h = createHints("a");
    updateHints(h, HINT_TIMES[0] - 100, ctx());
    expect(h.level).toBe(0);
    // dt is capped per frame, so simulate many frames
    for (let i = 0; i < 400; i++) updateHints(h, 100, ctx());
    expect(h.level).toBe(1);
    for (let i = 0; i < 300; i++) updateHints(h, 100, ctx());
    expect(h.level).toBe(2);
    for (let i = 0; i < 300; i++) updateHints(h, 100, ctx());
    expect(h.level).toBe(3);
    updateHints(h, 16, ctx({ progressKey: "b" }));
    expect(h.level).toBe(0);
  });

  it("never accumulate while idle on purpose, blocked (pause, dialogue, hidden tab) or exploring optional content", () => {
    for (const c of [ctx({ active: false }), ctx({ blocked: true }), ctx({ exploringOptional: true })]) {
      const h = createHints("a");
      for (let i = 0; i < 2000; i++) updateHints(h, 100, c);
      expect(h.level).toBe(0);
    }
  });

  it("respect the setting, but the Hint button always works", () => {
    const h = createHints("a");
    for (let i = 0; i < 2000; i++) updateHints(h, 100, ctx({ enabled: false }));
    expect(h.level).toBe(0);
    expect(requestHint(h)).toBe(1);
    expect(requestHint(h)).toBe(2);
    updateHints(h, 16, ctx({ enabled: false }));
    expect(h.level).toBe(2);
  });

  it("struggle detection offers an assist after repeated jumps in one spot, once", () => {
    const st = createStruggle();
    let offered = false;
    for (let i = 0; i < 4; i++) offered = recordJump(st, 180 + (i % 2) * 6, i * 1000, 1) || offered;
    expect(offered).toBe(true);
    expect(recordJump(st, 180, 5000, 1)).toBe(false);
  });

  it("struggle detection does not fire for a player making progress", () => {
    const st = createStruggle();
    let offered = false;
    for (let i = 0; i < 10; i++) offered = recordJump(st, 100 + i * 80, i * 1000, 1) || offered;
    expect(offered).toBe(false);
  });
});

describe("objectives: one actionable instruction", () => {
  it("every stage has a primary instruction and optional goals are separate", () => {
    const s = createNewState();
    s.tutorial = { status: "done", stage: "done" };
    const o = getObjective(s);
    expect(o.primary).toContain("radio");
    expect(o.optional).toEqual([]);
    s.flags.checkedShipRadio = s.flags.hatchOpen = s.flags.inspectedReceiver = true;
    const r = getObjective(s);
    expect(r.stage).toBe("restore");
    expect(r.primary).toMatch(/spare parts/i);
    expect(r.optional.length).toBe(3);
    expect(r.steps.length).toBe(3);
  });

  it("recommends a logical next step without blocking other orders", () => {
    const s = createNewState();
    s.flags.checkedShipRadio = s.flags.hatchOpen = s.flags.inspectedReceiver = true;
    s.inventory.metal = 2;
    s.inventory.electronics = 1;
    expect(getObjective(s).target).toBe("solarControl");
    s.flags.solarRepaired = true;
    expect(getObjective(s).primary).toMatch(/Sweep/);
    s.sweptPanels = ["panel_1", "panel_2", "panel_3"];
    expect(getObjective(s).target).toBe("comms_module");
    s.inventory.commsModule = 1;
    expect(getObjective(s).primary).toMatch(/Carry the comms module/);
  });
});

describe("sniff signal states", () => {
  it("distinguishes none, weak, strong and located", () => {
    expect(signalLevel(null)).toBe("none");
    expect(signalLevel(500)).toBe("none");
    expect(signalLevel(150)).toBe("weak");
    expect(signalLevel(80)).toBe("strong");
    expect(signalLevel(20)).toBe("located");
    expect(trend(100, 80)).toBe("warmer");
    expect(trend(80, 100)).toBe("colder");
    expect(trend(80, 81)).toBe("steady");
  });

  it("struggling players get a longer range for mission-critical finds only", () => {
    const s = createNewState();
    const targets = sniffTargets(OBJECTS, s);
    const m = targets.find((t) => t.id === "comms_module")!;
    const far = m.x - 240;
    expect(detect(far, m.y - 8, targets).find((d) => d.id === "comms_module")).toBeUndefined();
    expect(detect(far, m.y - 8, targets, undefined, undefined, 1.6).find((d) => d.id === "comms_module")).toBeDefined();
    const sample = targets.find((t) => t.id === "sample_gypsum")!;
    expect(sample.critical).toBe(false);
  });

  it("the practice component is only a target when the tutorial asks for it", () => {
    const s = createNewState();
    expect(sniffTargets(OBJECTS, s).some((t) => t.kind === "practice")).toBe(false);
    expect(sniffTargets(OBJECTS, s, { id: "practice_buried", active: true }).some((t) => t.kind === "practice")).toBe(true);
  });
});

describe("Bark", () => {
  it("is optional and answers at the echo sensor (with a visual + text fact the first time)", () => {
    const s = createNewState();
    expect(getInteraction(obj("echo_sensor"), s, { revealed: new Set() })?.verb).toBe("Bark");
    const fx = barkEffects(obj("echo_sensor"), s);
    expect(fx.some((e) => e.type === "world" && e.event === "echoSensor")).toBe(true);
    expect(fx.some((e) => e.type === "read")).toBe(true);
    expect(barkEffects(obj("echo_sensor"), s).some((e) => e.type === "read")).toBe(false);
    expect(barkEffects(null, s).map((e) => e.type)).toEqual(["anim", "sound"]);
    expect(getObjective(s).steps.every((st) => !/bark/i.test(st.text))).toBe(true);
  });
});

describe("animation", () => {
  const base = { now: 1000, grounded: true, vx: 0, vy: 0, walkSpeed: TUNING.walkSpeed, landUntil: 0, jumpStartUntil: 0, turnUntil: 0, airJumpUntil: 0 };

  it("chooses gaits by real speed and air poses by vertical speed", () => {
    expect(locomotionAnim(base)).toBeNull();
    expect(locomotionAnim({ ...base, vx: 30 })).toBe("walk");
    expect(locomotionAnim({ ...base, vx: TUNING.walkSpeed })).toBe("trot");
    expect(locomotionAnim({ ...base, vx: TUNING.sprintSpeed })).toBe("run");
    expect(locomotionAnim({ ...base, grounded: false, vy: -200 })).toBe("rise");
    expect(locomotionAnim({ ...base, grounded: false, vy: 10 })).toBe("apex");
    expect(locomotionAnim({ ...base, grounded: false, vy: 200 })).toBe("fall");
    expect(locomotionAnim({ ...base, grounded: false, vy: -250, jumpStartUntil: 1050 })).toBe("jumpStart");
    expect(locomotionAnim({ ...base, landUntil: 1100 })).toBe("land");
    expect(locomotionAnim({ ...base, vx: 90, turnUntil: 1100 })).toBe("turn");
  });

  it("plays gaits faster when moving faster (feet don't slide)", () => {
    expect(gaitTimeScale("trot", TUNING.walkSpeed * 1.2, TUNING.walkSpeed)).toBeGreaterThan(gaitTimeScale("trot", TUNING.walkSpeed * 0.7, TUNING.walkSpeed));
  });

  it("idle personality: micro-behaviours, then sit, lie down, sleep; any input wakes instantly", () => {
    const st = createIdle();
    const ctx = { moving: false, nearUnfamiliar: false, nearTreasure: false, safe: true };
    const seen = new Set<string>();
    let now = 0;
    const rnd = () => 0.3;
    for (; now < SLEEP_AFTER_MS + 2000; now += 50) seen.add(stepIdle(st, 50, now, ctx, rnd));
    for (const a of ["idle", "sitDown", "sit", "lieDown", "lie", "sleep"]) expect(seen.has(a), a).toBe(true);
    expect(st.posture).toBe("sleep");
    expect(stepIdle(st, 16, now, { ...ctx, moving: true }, rnd)).toBe("idle");
    expect(st.posture).toBe("stand");
    expect(SIT_AFTER_MS).toBeLessThan(LIE_AFTER_MS);
  });

  it("curiosity and excitement have cooldowns", () => {
    const st = createIdle();
    const ctx = { moving: false, nearUnfamiliar: true, nearTreasure: false, safe: false };
    const out: string[] = [];
    for (let now = 0; now < 6000; now += 50) out.push(stepIdle(st, 50, now, ctx, () => 0.9));
    const tilts = out.filter((a, i) => (a === "tilt" || a === "alert") && out[i - 1] !== a).length;
    expect(tilts).toBe(1);
  });

  it("every animation references existing frames, and all frames share one size", () => {
    for (const [name, a] of Object.entries(LAIKA_ANIMS)) for (const f of a.frames) expect(LAIKA_FRAME_NAMES, `${name}:${f}`).toContain(f);
    for (const f of laikaFrames(false)) {
      expect(f.grid.length).toBe(22);
      expect(f.grid.every((r) => r.length === 26)).toBe(true);
    }
  });

  it("walk cycle: each hind leg follows the opposite fore leg by a quarter cycle; strides are equal", () => {
    expect((((WALK.phase.fh - WALK.phase.nf) % 1) + 1) % 1).toBeCloseTo(0.75);
    const span = (ph: number) => {
      const xs = Array.from({ length: 60 }, (_, i) => legAt(i / 60, ph, WALK).dx);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(span(WALK.phase.nf)).toBe(span(WALK.phase.nh));
    expect(TROT.phase.nf).toBe(TROT.phase.fh);
  });
});

describe("movement tuning (Phase 2)", () => {
  it("keeps the full jump height (level gates unchanged) and gains an apex float", () => {
    expect(maxJumpHeight(TUNING) / 16).toBeGreaterThan(3.3);
    expect(maxJumpHeight(TUNING) / 16).toBeLessThan(3.8);
    let s = initialMoveState();
    s.grounded = false;
    s.vy = 10;
    const held = stepMovement(s, { left: false, right: false, jumpHeld: true, jumpPressed: false, sprint: false }, { grounded: false, ceiling: false, dtMs: 16.67, tuning: TUNING, airJumps: 0, locked: false }).state;
    const free = stepMovement(s, { left: false, right: false, jumpHeld: false, jumpPressed: false, sprint: false }, { grounded: false, ceiling: false, dtMs: 16.67, tuning: TUNING, airJumps: 0, locked: false }).state;
    expect(held.vy).toBeLessThan(free.vy);
  });

  it("reaches walking speed in under 0.1 s and reverses in the air quickly", () => {
    let s = initialMoveState();
    let t = 0;
    while (s.vx < TUNING.walkSpeed - 0.01 && t < 1000) {
      s = stepMovement(s, { left: false, right: true, jumpHeld: false, jumpPressed: false, sprint: false }, { grounded: true, ceiling: false, dtMs: 16.67, tuning: TUNING, airJumps: 0, locked: false }).state;
      t += 16.67;
    }
    expect(t).toBeLessThan(100);
    let a = { ...initialMoveState(), vx: 100, grounded: false };
    let n = 0;
    while (a.vx > -50 && n < 60) {
      a = stepMovement(a, { left: true, right: false, jumpHeld: false, jumpPressed: false, sprint: false }, { grounded: false, ceiling: false, dtMs: 16.67, tuning: TUNING, airJumps: 0, locked: false }).state;
      n++;
    }
    expect(n * 16.67).toBeLessThan(150);
  });

  it("emits a turn event when reversing at speed (skid feedback)", () => {
    const s = { ...initialMoveState(), vx: 100, facing: 1 as const };
    const r = stepMovement(s, { left: true, right: false, jumpHeld: false, jumpPressed: false, sprint: false }, { grounded: true, ceiling: false, dtMs: 16.67, tuning: TUNING, airJumps: 0, locked: false });
    expect(r.events).toContain("turn");
  });
});

describe("settings (Phase 2)", () => {
  it("adds a remappable Bark key and sound captions with safe defaults", () => {
    const d = defaultSettings();
    expect(d.bindings.bark).toBe("KeyB");
    expect(d.captions).toBe(true);
    const old = parseSettings(JSON.stringify({ bindings: { jump: "KeyK" } }));
    expect(old.bindings.bark).toBe("KeyB");
    expect(old.bindings.jump).toBe("KeyK");
  });
});
