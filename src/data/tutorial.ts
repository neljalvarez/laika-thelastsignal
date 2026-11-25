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
    title: "Let's get moving!",
    instruction: (c) =>
      by(
        c,
        `${c.keys.left} / ${c.keys.right} or ← / → to move.`,
        "Use the movement buttons to walk.",
        "Move the left stick (or the D-pad).",
      ),
    controls: ["left", "right"],
    done: (f) => f.movedPx >= MOVE_DISTANCE_PX || f.maxX > CRATE_RIGHT_X,
    hint: "Walk towards the crate on the right.",
    respawnCol: 6,
    next: "jump",
  },
  {
    id: "jump",
    title: "One small jump",
    instruction: (c) => by(c, `Hold ${c.keys.jump} to hop over the crate.`, "Hold JUMP to hop over the crate.", "Hold Ⓐ to hop over the crate."),
    controls: ["jump"],
    target: "crate",
    done: (f) => f.maxX > CRATE_RIGHT_X + 10,
    hint: "Try holding Jump a little longer, and keep walking right.",
    fallback: "Easy Jumps makes every jump higher and lets you glide. You can turn it on now.",
    respawnCol: 7,
    next: "console",
  },
  {
    id: "console",
    title: "What's that?",
    instruction: (c) =>
      by(c, `Walk up to the console and press ${c.keys.interact}.`, "Walk up to the console and tap the action button.", "Walk up to the console and press Ⓧ."),
    controls: ["interact"],
    target: "practice_console",
    done: (f) => f.consoleUsed,
    hint: "Stand right next to the blinking console. A little arrow appears above things you can use.",
    respawnCol: 13,
    next: "sniff",
  },
  {
    id: "sniff",
    title: "Follow your nose",
    instruction: (c) =>
      by(c, `Something is hiding nearby. Use Sniff! (${c.keys.sniff})`, "Something is hiding nearby. Tap SNIFF!", "Something is hiding nearby. Press Ⓨ to sniff!"),
    controls: ["sniff"],
    target: "practice_buried",
    done: (f) => f.revealed || f.collected,
    hint: "After a sniff, walk the way the arrow points. The signal bars fill up as you get closer.",
    respawnCol: 14,
    next: "dig",
  },
  {
    id: "dig",
    title: "Buried treasure",
    instruction: (c) => by(c, `Dig here! Press ${c.keys.interact}.`, "Dig here! Tap the action button.", "Dig here! Press Ⓧ."),
    controls: ["interact"],
    target: "practice_buried",
    done: (f) => f.collected,
    hint: "Stand on the sparkling spot in the soil tray.",
    respawnCol: 16,
    next: "repair",
  },
  {
    id: "repair",
    title: "A little repair",
    instruction: (c) =>
      by(c, `Use the component to repair this machine. Press ${c.keys.interact}.`, "Use the component to repair this machine. Tap the action button.", "Use the component to repair this machine. Press Ⓧ."),
    controls: ["interact"],
    target: "training_machine",
    done: (f) => f.repaired,
    hint: "The broken fan is at the end of the room. Walk up to it.",
    respawnCol: 18,
    next: "exit",
  },
  {
    id: "exit",
    title: "Hello, Mars!",
    instruction: () => "Ready to explore? Hop down the open hatch!",
    controls: ["right"],
    target: "floor_hatch",
    done: (f) => f.exited,
    hint: "The floor hatch on the right is open now. Walk onto it.",
    respawnCol: 19,
    next: "done",
  },
];

export const STAGE_ORDER: TutorialStageId[] = [...TUTORIAL_STAGES.map((s) => s.id), "done"];

export function stageDef(id: TutorialStageId): TutorialStageDef | undefined {
  return TUTORIAL_STAGES.find((s) => s.id === id);
}
