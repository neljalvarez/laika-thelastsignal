/** Player preferences (audio, accessibility, controls). Stored separately from the save. */
import { SETTINGS_KEY } from "../config/constants";
import type { KeyValueStore } from "./save";

export type Action = "left" | "right" | "jump" | "interact" | "sniff" | "sprint" | "bark" | "map" | "pause";
export const REMAPPABLE: Action[] = ["left", "right", "jump", "interact", "sniff", "sprint", "bark", "map"];

export const ACTION_LABELS: Record<Action, string> = {
  left: "Move left",
  right: "Move right",
  jump: "Jump",
  interact: "Interact / Dig",
  sniff: "Sniff (scanner)",
  sprint: "Sprint",
  bark: "Bark (optional)",
  map: "World map",
  pause: "Pause",
};

/** Primary keys (remappable, KeyboardEvent.code). Fixed alternates always work too. */
export const DEFAULT_BINDINGS: Record<Action, string> = {
  left: "KeyA",
  right: "KeyD",
  jump: "Space",
  interact: "KeyE",
  sniff: "KeyF",
  sprint: "ShiftLeft",
  bark: "KeyB",
  map: "KeyM",
  pause: "Escape",
};

export const ALT_BINDINGS: Record<Action, string[]> = {
  left: ["ArrowLeft"],
  right: ["ArrowRight"],
  jump: ["ArrowUp", "KeyW"],
  interact: ["Enter"],
  sniff: [],
  sprint: ["ShiftRight"],
  bark: [],
  map: [],
  pause: ["KeyP"],
};

export interface Settings {
  master: number;
  music: number;
  ambience: number;
  sfx: number;
  /** UI text scale: 1, 1.25 or 1.5. */
  textScale: number;
  reducedMotion: boolean;
  hints: boolean;
  assistJumps: boolean;
  touchControls: "auto" | "on" | "off";
  textSpeed: "normal" | "slow" | "instant";
  /** Short on-screen captions for important sounds (bark, scanner, machines). */
  captions: boolean;
  /** Phase 3: lighter darkness in caves (the Frozen Depths stay readable without the Headlamp). */
  brightCaves: boolean;
  bindings: Record<Action, string>;
}

export function defaultSettings(prefersReducedMotion = false): Settings {
  return {
    master: 0.8,
    music: 0.5,
    ambience: 0.5,
    sfx: 0.7,
    textScale: 1,
    reducedMotion: prefersReducedMotion,
    hints: true,
    assistJumps: false,
    touchControls: "auto",
    textSpeed: "normal",
    captions: true,
    brightCaves: false,
    bindings: { ...DEFAULT_BINDINGS },
  };
}

const clamp01 = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d);

export function parseSettings(text: string | null, prefersReducedMotion = false): Settings {
  const d = defaultSettings(prefersReducedMotion);
  if (!text) return d;
  let raw: Record<string, unknown>;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) return d;
    raw = parsed as Record<string, unknown>;
  } catch {
    return d;
  }
  const s: Settings = {
    master: clamp01(raw.master, d.master),
    music: clamp01(raw.music, d.music),
    ambience: clamp01(raw.ambience, d.ambience),
    sfx: clamp01(raw.sfx, d.sfx),
    textScale: [1, 1.25, 1.5].includes(raw.textScale as number) ? (raw.textScale as number) : d.textScale,
    reducedMotion: typeof raw.reducedMotion === "boolean" ? raw.reducedMotion : d.reducedMotion,
    hints: typeof raw.hints === "boolean" ? raw.hints : d.hints,
    assistJumps: typeof raw.assistJumps === "boolean" ? raw.assistJumps : d.assistJumps,
    touchControls: ["auto", "on", "off"].includes(raw.touchControls as string) ? (raw.touchControls as Settings["touchControls"]) : d.touchControls,
    textSpeed: ["normal", "slow", "instant"].includes(raw.textSpeed as string) ? (raw.textSpeed as Settings["textSpeed"]) : d.textSpeed,
    captions: typeof raw.captions === "boolean" ? raw.captions : d.captions,
    brightCaves: typeof raw.brightCaves === "boolean" ? raw.brightCaves : d.brightCaves,
    bindings: { ...DEFAULT_BINDINGS },
  };
  if (typeof raw.bindings === "object" && raw.bindings !== null) {
    const b = raw.bindings as Record<string, unknown>;
    for (const a of REMAPPABLE) if (typeof b[a] === "string" && (b[a] as string).length > 0) s.bindings[a] = b[a] as string;
  }
  return s;
}

export function loadSettings(store: KeyValueStore | null, prefersReducedMotion = false): Settings {
  try {
    return parseSettings(store?.getItem(SETTINGS_KEY) ?? null, prefersReducedMotion);
  } catch {
    return defaultSettings(prefersReducedMotion);
  }
}

export function saveSettings(store: KeyValueStore | null, s: Settings): void {
  try {
    store?.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Assigns a key to an action. If another action already used that key, the two swap. */
export function rebind(s: Settings, action: Action, code: string): Settings {
  const bindings = { ...s.bindings };
  const other = (Object.keys(bindings) as Action[]).find((a) => a !== action && bindings[a] === code);
  if (other) bindings[other] = bindings[action];
  bindings[action] = code;
  return { ...s, bindings };
}

/** "KeyE" -> "E", "Space" -> "Space", "ArrowLeft" -> "←". */
export function keyLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const map: Record<string, string> = {
    ArrowLeft: "←",
    ArrowRight: "→",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ShiftLeft: "Shift",
    ShiftRight: "Shift",
    ControlLeft: "Ctrl",
    ControlRight: "Ctrl",
    AltLeft: "Alt",
    AltRight: "Alt",
    Escape: "Esc",
    Enter: "Enter",
    Space: "Space",
  };
  return map[code] ?? code;
}
