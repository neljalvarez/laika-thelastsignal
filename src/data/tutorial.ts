/**
 * Mission 00: First Pawprints. Data only: every stage, its prompt text per input device, its
 * environmental target, its completion fact and its hint. The rules live in systems/tutorial.ts.
 */
import type { Action } from "../systems/settings";

export type TutorialStageId = "wake" | "move" | "jump" | "console" | "sniff" | "dig" | "repair" | "exit" | "done";

export type Device = "keyboard" | "touch" | "gamepad";

/** Facts gathered from real gameplay. Stages complete when their fact is true. */
export interface TutorialFacts {
  /** Total horizontal distance walked, in pixels. */
  movedPx: number;
  /** Furthest x reached on the upper deck. */
  maxX: number;
  woke: boolean;
  consoleUsed: boolean;
  revealed: boolean;
  collected: boolean;
  repaired: boolean;
  exited: boolean;
  /** Jumps that landed back on the near side of the crate. */
  jumpFails: number;
}

export interface PromptContext {
  device: Device;
  /** Readable labels for the current bindings, e.g. { jump: "Space", interact: "E" }. */
  keys: Record<Action, string>;
}

export interface TutorialStageDef {
  id: TutorialStageId;
  /** Short heading shown above the instruction. */
  title: string;
  instruction: (c: PromptContext) => string;
  /** Actions this stage teaches (their key chips are highlighted). */
  controls: Action[];
  /** World object the stage points at (highlighted by the marker / hints), if any. */
  target?: string;
  /** Completion condition on the facts. */
  done: (f: TutorialFacts) => boolean;
  /** Extra help when the player seems stuck. */
  hint: string;
  /** Alternative for players who cannot perform the action precisely. */
  fallback?: string;
  /** Respawn column if the game is reloaded during this stage. */
  respawnCol: number;
  next: TutorialStageId;
}

/** Pixel x of the training crate's right edge (col 11) and of the landing marker. */
export const CRATE_RIGHT_X = 12 * 16;
export const MOVE_DISTANCE_PX = 56;

const by = (c: PromptContext, keyboard: string, touch: string, gamepad: string) =>
  c.device === "touch" ? touch : c.device === "gamepad" ? gamepad : keyboard;

export const TUTORIAL_STAGES: TutorialStageDef[] = [
  {
    id: "wake",
    title: "Wake up, Laika!",
    instruction: () => "Laika is waking up...",
    controls: [],
    done: (f) => f.woke,
    hint: "",
    respawnCol: 6,
    next: "move",
  },
  {
    id: "move",
    title: "Move right.",
    instruction: (c) => by(c, `(${c.keys.left}) (${c.keys.right}) or (← →)`, "(◀) (▶)", "(left stick)"),
    controls: ["left", "right"],
    done: (f) => f.movedPx >= MOVE_DISTANCE_PX || f.maxX > CRATE_RIGHT_X,
    hint: "Walk right.",
    respawnCol: 6,
    next: "jump",
  },
  {
    id: "jump",
    title: "Jump over the crate.",
    instruction: (c) => by(c, `Hold ${c.keys.jump}`, "Hold JUMP", "Hold Ⓐ"),
    controls: ["jump"],
    target: "crate",
    done: (f) => f.maxX > CRATE_RIGHT_X + 10,
    hint: "Hold Jump longer.",
    fallback: "Turn on Easy Jumps?",
    respawnCol: 7,
    next: "console",
  },
  {
    id: "console",
    title: "Use the console.",
    instruction: (c) => by(c, `press ${c.keys.interact}`, "(Action)", "press Ⓧ"),
    controls: ["interact"],
    target: "practice_console",
    done: (f) => f.consoleUsed,
    hint: "Stand next to the blinking console.",
    respawnCol: 13,
    next: "sniff",
  },
  {
    id: "sniff",
    title: "Sniff, then follow the signal.",
    instruction: (c) => by(c, `press ${c.keys.sniff}`, "(SNIFF)", "press Ⓨ"),
    controls: ["sniff"],
    target: "practice_buried",
    done: (f) => f.revealed || f.collected,
    hint: "Walk where the arrow points.",
    respawnCol: 14,
    next: "dig",
  },
  {
    id: "dig",
    title: "Dig here.",
    instruction: (c) => by(c, `press ${c.keys.interact}`, "(Action)", "press Ⓧ"),
    controls: ["interact"],
    target: "practice_buried",
    done: (f) => f.collected,
    hint: "Stand on the sparkly spot.",
    respawnCol: 16,
    next: "repair",
  },
  {
    id: "repair",
    title: "Fix the fan.",
    instruction: (c) => by(c, `press ${c.keys.interact}`, "(Action)", "press Ⓧ"),
    controls: ["interact"],
    target: "training_machine",
    done: (f) => f.repaired,
    hint: "The fan is at the end of the room.",
    respawnCol: 18,
    next: "exit",
  },
  {
    id: "exit",
    title: "Drop down the hatch.",
    instruction: () => "",
    controls: ["right"],
    target: "floor_hatch",
    done: (f) => f.exited,
    hint: "The hatch is on the right.",
    respawnCol: 19,
    next: "done",
  },
];

export const STAGE_ORDER: TutorialStageId[] = [...TUTORIAL_STAGES.map((s) => s.id), "done"];

export function stageDef(id: TutorialStageId): TutorialStageDef | undefined {
  return TUTORIAL_STAGES.find((s) => s.id === id);
}
