/**
 * Mission 00 rules. Pure functions over an isolated TutorialState: practice items never enter
 * the campaign inventory, so replaying the tutorial can never duplicate resources or change
 * mission progress.
 *
 * Stages advance only from facts produced by real gameplay (distance walked, the crate cleared,
 * the console used, the component revealed / dug up, the machine repaired, the drop through the
 * hatch). Because completion is fact-based, doing things out of order simply skips ahead.
 */
import { STAGE_ORDER, TUTORIAL_STAGES, stageDef, type TutorialFacts, type TutorialStageId } from "../data/tutorial";
import type { WorldObject } from "../data/world";
import type { Effect, Interaction } from "./interactions";

export type TutorialMode = "first" | "replay";

export interface TutorialState {
  mode: TutorialMode;
  stage: TutorialStageId;
  facts: TutorialFacts;
  /** The practice component is carried (dug up but not yet used). */
  holding: boolean;
}

export function emptyFacts(): TutorialFacts {
  return { movedPx: 0, maxX: 0, woke: false, consoleUsed: false, revealed: false, collected: false, repaired: false, exited: false, jumpFails: 0 };
}

export function createTutorial(mode: TutorialMode, stage: TutorialStageId = "wake"): TutorialState {
  const t: TutorialState = { mode, stage: "wake", facts: emptyFacts(), holding: false };
  // Resuming a saved first-time tutorial: rebuild the facts implied by the saved stage.
  const idx = Math.max(0, STAGE_ORDER.indexOf(stage));
  for (const s of STAGE_ORDER.slice(0, idx)) impliedBy(t.facts, s);
  t.stage = STAGE_ORDER[idx] ?? "wake";
  t.holding = t.facts.collected && !t.facts.repaired;
  return t;
}

/** Facts that must be true once a stage is complete (used to restore a saved tutorial). */
function impliedBy(f: TutorialFacts, s: TutorialStageId): void {
  switch (s) {
    case "wake":
      f.woke = true;
      break;
    case "move":
      f.movedPx = Math.max(f.movedPx, 999);
      break;
    case "jump":
      f.maxX = Math.max(f.maxX, 9999);
      break;
    case "console":
      f.consoleUsed = true;
      break;
    case "sniff":
      f.revealed = true;
      break;
    case "dig":
      f.collected = true;
      break;
    case "repair":
      f.repaired = true;
      break;
    case "exit":
      f.exited = true;
      break;
    case "done":
      break;
  }
}

/** Advances through every stage whose completion fact is already true. Returns the stages completed. */
export function advance(t: TutorialState): TutorialStageId[] {
  const completed: TutorialStageId[] = [];
  let def = stageDef(t.stage);
  while (def && def.done(t.facts)) {
    completed.push(def.id);
    t.stage = def.next;
    def = stageDef(t.stage);
  }
  return completed;
}

export type TutorialEvent =
  | { type: "woke" }
  | { type: "moved"; dx: number; x: number }
  | { type: "jumpFailed" }
  | { type: "revealed" }
  | { type: "exited" };

/** Records a gameplay fact. Returns the stages that this completed. */
export function tutorialEvent(t: TutorialState, ev: TutorialEvent): TutorialStageId[] {
  const f = t.facts;
  switch (ev.type) {
    case "woke":
      f.woke = true;
      break;
    case "moved":
      if (!f.woke) return [];
      f.movedPx += Math.abs(ev.dx);
      f.maxX = Math.max(f.maxX, ev.x);
      break;
    case "jumpFailed":
      if (t.stage === "jump") f.jumpFails += 1;
      break;
    case "revealed":
      f.revealed = true;
      break;
    case "exited":
      // Only counts once the machine is repaired (the hatch only opens then anyway).
      if (f.repaired) f.exited = true;
      break;
  }
  return advance(t);
}

export function isComplete(t: TutorialState): boolean {
  return t.stage === "done";
}

/** True while the floor hatch should be open. */
export function hatchOpen(t: TutorialState): boolean {
  return t.facts.repaired;
}

// ---------------------------------------------------------------------------
// Practice interactions (console, buried component, training machine)
// ---------------------------------------------------------------------------

export function getPracticeInteraction(o: WorldObject, t: TutorialState): Interaction | null {
  switch (o.kind) {
    case "practiceConsole":
      return t.facts.consoleUsed ? null : { verb: "Use console" };
    case "practiceBuried":
      return t.facts.revealed && !t.facts.collected ? { verb: "Dig" } : null;
    case "trainingMachine":
      if (t.facts.repaired) return null;
      return t.holding ? { verb: "Repair the fan", detail: "Uses the spare component" } : { verb: "Inspect the fan", detail: "Needs a component" };
    default:
      return null;
  }
}

/**
 * Applies a practice interaction. Idempotent: a second press after success does nothing,
 * so rapid inputs can never collect or consume twice.
 */
export function performPracticeInteraction(o: WorldObject, t: TutorialState): { effects: Effect[]; completed: TutorialStageId[] } {
  const fx: Effect[] = [];
  if (!getPracticeInteraction(o, t)) return { effects: fx, completed: [] };
  switch (o.kind) {
    case "practiceConsole":
      t.facts.consoleUsed = true;
      fx.push({ type: "anim", name: "interact" }, { type: "world", event: "practiceConsole", objectId: o.id }, { type: "sound", name: "stageDone" });
      fx.push({ type: "toast", text: "Console online: suit sensors calibrated!", tone: "good" });
      break;
    case "practiceBuried":
      t.facts.collected = true;
      t.holding = true;
      fx.push({ type: "anim", name: "dig" }, { type: "world", event: "practiceCollected", objectId: o.id });
      fx.push({ type: "toast", text: "Found a spare component!", tone: "good" });
      break;
    case "trainingMachine":
      if (!t.holding) {
        fx.push({ type: "anim", name: "interact" }, { type: "sound", name: "error" });
        fx.push({ type: "toast", text: "The fan is missing a component. Something is buried in the soil tray...", tone: "warn" });
        return { effects: fx, completed: [] };
      }
      t.holding = false;
      t.facts.repaired = true;
      fx.push({ type: "anim", name: "repair" }, { type: "world", event: "practiceRepaired", objectId: o.id }, { type: "sound", name: "repair" });
      fx.push({ type: "toast", text: "Fan repaired! The lights are back on.", tone: "good" });
      break;
  }
  return { effects: fx, completed: advance(t) };
}

/** Stage progress for the progress dots: index of the current stage among the playable ones. */
export function stageIndex(t: TutorialState): number {
  const i = TUTORIAL_STAGES.findIndex((s) => s.id === t.stage);
  return i < 0 ? TUTORIAL_STAGES.length : i;
}
