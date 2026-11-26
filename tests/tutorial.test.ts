import { describe, expect, it } from "vitest";
import { CRATE_RIGHT_X, MOVE_DISTANCE_PX, STAGE_ORDER, TUTORIAL_STAGES, type PromptContext } from "../src/data/tutorial";
import { OBJECTS } from "../src/data/world";
import { performInteraction } from "../src/systems/interactions";
import { loadGame, saveGame, type KeyValueStore } from "../src/systems/save";
import { DEFAULT_BINDINGS, keyLabel, rebind, defaultSettings, type Action } from "../src/systems/settings";
import { createNewState } from "../src/systems/state";
import { createTutorial, getPracticeInteraction, isComplete, performPracticeInteraction, tutorialEvent, type TutorialState } from "../src/systems/tutorial";

const obj = (id: string) => OBJECTS.find((o) => o.id === id)!;
const use = (t: TutorialState, id: string) => performPracticeInteraction(obj(id), t);
const mem = (): KeyValueStore => {
  const d: Record<string, string> = {};
  return { getItem: (k) => d[k] ?? null, setItem: (k, v) => void (d[k] = v), removeItem: (k) => void delete d[k] };
};

/** Plays the tutorial the intended way and returns the stages in the order they completed. */
function playThrough(t: TutorialState): string[] {
  const done: string[] = [];
  const push = (s: string[]) => done.push(...s);
  push(tutorialEvent(t, { type: "woke" }));
  push(tutorialEvent(t, { type: "moved", dx: 40, x: 140 }));
  push(tutorialEvent(t, { type: "moved", dx: 30, x: 170 }));
  push(tutorialEvent(t, { type: "moved", dx: 30, x: CRATE_RIGHT_X + 16 }));
  push(use(t, "practice_console").completed);
  push(tutorialEvent(t, { type: "revealed" }));
  push(use(t, "practice_buried").completed);
  push(use(t, "training_machine").completed);
  push(tutorialEvent(t, { type: "exited" }));
  return done;
}

describe("Mission 00: First Pawprints", () => {
  it("is defined as data, in order, ending with done", () => {
    expect(STAGE_ORDER).toEqual(["wake", "move", "jump", "console", "sniff", "dig", "repair", "exit", "done"]);
    for (const s of TUTORIAL_STAGES) {
      expect(s.title.length).toBeGreaterThan(0);
      expect(s.hint.length > 0 || s.id === "wake").toBe(true);
    }
  });

  it("new games start in the tutorial", () => {
    const s = createNewState();
    expect(s.tutorial).toEqual({ status: "active", stage: "wake" });
    const t = createTutorial("first", s.tutorial.stage);
    expect(t.stage).toBe("wake");
    expect(t.holding).toBe(false);
  });

  it("completes every stage in order from real gameplay events", () => {
    const t = createTutorial("first");
    expect(playThrough(t)).toEqual(["wake", "move", "jump", "console", "sniff", "dig", "repair", "exit"]);
    expect(isComplete(t)).toBe(true);
  });

  it("does not advance on a key press alone: moving needs real distance", () => {
    const t = createTutorial("first");
    tutorialEvent(t, { type: "woke" });
    tutorialEvent(t, { type: "moved", dx: 2, x: 106 });
    expect(t.stage).toBe("move");
    tutorialEvent(t, { type: "moved", dx: MOVE_DISTANCE_PX, x: 160 });
    expect(t.stage).toBe("jump");
  });

  it("ignores movement before Laika is awake, and jumping requires clearing the crate", () => {
    const t = createTutorial("first");
    tutorialEvent(t, { type: "moved", dx: 500, x: 500 });
    expect(t.facts.movedPx).toBe(0);
    tutorialEvent(t, { type: "woke" });
    tutorialEvent(t, { type: "moved", dx: 80, x: CRATE_RIGHT_X - 2 });
    expect(t.stage).toBe("jump");
  });

  it("rejects invalid attempts: no dig before reveal, no repair without the component, sniff alone is not enough", () => {
    const t = createTutorial("first");
    tutorialEvent(t, { type: "woke" });
    expect(getPracticeInteraction(obj("practice_buried"), t)).toBeNull();
    expect(use(t, "practice_buried").completed).toEqual([]);
    const fan = use(t, "training_machine");
    expect(t.facts.repaired).toBe(false);
    expect(fan.effects.some((e) => e.type === "toast" && e.tone === "warn")).toBe(true);
    // A sniff with nothing revealed changes nothing.
    expect(t.facts.revealed).toBe(false);
    // The exit only counts after the repair.
    tutorialEvent(t, { type: "exited" });
    expect(t.facts.exited).toBe(false);
  });

  it("handles actions out of order by skipping ahead once earlier stages are done", () => {
    const t = createTutorial("first");
    tutorialEvent(t, { type: "woke" });
    // Player rushes right past everything and uses the console first.
    use(t, "practice_console");
    expect(t.stage).toBe("move");
    tutorialEvent(t, { type: "moved", dx: 120, x: CRATE_RIGHT_X + 30 });
    expect(t.stage).toBe("sniff"); // move, jump and console all done
  });

  it("prevents duplicate rewards from rapid presses", () => {
    const t = createTutorial("first");
    tutorialEvent(t, { type: "revealed" });
    use(t, "practice_buried");
    expect(use(t, "practice_buried").effects).toEqual([]);
    use(t, "training_machine");
    expect(t.holding).toBe(false);
    expect(use(t, "training_machine").effects).toEqual([]);
  });

  it("replay is isolated: practice never touches the campaign inventory, flags or abilities", () => {
    const s = createNewState();
    s.tutorial = { status: "done", stage: "done" };
    s.inventory.metal = 3;
    s.flags.solarRepaired = true;
    const before = JSON.stringify(s);
    const t = createTutorial("replay");
    playThrough(t);
    expect(isComplete(t)).toBe(true);
    expect(JSON.stringify(s)).toBe(before);
    // Practice objects have no campaign interaction at all.
    expect(performInteraction(obj("practice_buried"), s, { revealed: new Set(["practice_buried"]) })).toEqual([]);
  });

  it("restarting gives a fresh practice state", () => {
    const t = createTutorial("first");
    playThrough(t);
    const r = createTutorial("first");
    expect(r.facts.collected).toBe(false);
    expect(r.stage).toBe("wake");
  });

  it("saves and reloads mid-tutorial, rebuilding the facts implied by the stage", () => {
    const store = mem();
    const s = createNewState();
    s.tutorial = { status: "active", stage: "repair" };
    saveGame(store, s);
    const r = loadGame(store);
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.state.tutorial).toEqual({ status: "active", stage: "repair" });
    const t = createTutorial("first", r.state.tutorial.stage);
    expect(t.stage).toBe("repair");
    expect(t.facts.collected).toBe(true);
    expect(t.holding).toBe(true); // the dug-up component is not lost on reload
    use(t, "training_machine");
    expect(t.stage).toBe("exit");
  });

  it("skipping grants no resources", () => {
    const s = createNewState();
    s.tutorial = { status: "skipped", stage: "done" };
    expect(Object.values(s.inventory).every((n) => n === 0)).toBe(true);
    expect(s.abilities.sniff).toBe(false); // still unlocked by the receiver in Mission 01
  });
});

describe("Prompts adapt to the control scheme and bindings", () => {
  const keys = (b = DEFAULT_BINDINGS) => {
    const k = {} as Record<Action, string>;
    for (const a of Object.keys(b) as Action[]) k[a] = keyLabel(b[a]);
    return k;
  };
  const jump = TUTORIAL_STAGES.find((s) => s.id === "jump")!;
  const move = TUTORIAL_STAGES.find((s) => s.id === "move")!;

  it("shows keyboard, touch and gamepad wording", () => {
    const base: PromptContext = { device: "keyboard", keys: keys() };
    // Phase 5: the instruction is the control itself (the short goal is the stage title).
    expect(move.instruction(base)).toBe("(A) (D) or (← →)");
    expect(move.instruction({ ...base, device: "touch" })).toBe("(◀) (▶)");
    expect(move.instruction({ ...base, device: "gamepad" })).toContain("left stick");
    expect(jump.instruction(base)).toBe("Hold Space");
    expect(move.title).toBe("Move right.");
    expect(jump.title).toBe("Jump over the crate.");
  });

  it("follows remapped keys", () => {
    const s = rebind(defaultSettings(), "jump", "KeyK");
    expect(jump.instruction({ device: "keyboard", keys: keys(s.bindings) })).toBe("Hold K");
  });
});
