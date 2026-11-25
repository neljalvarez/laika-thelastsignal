/**
 * Input abstraction. Keyboard (remappable), touch buttons and gamepads all feed one
 * InputFrame per game frame, so gameplay code never knows which device is used.
 * Presses are latched between frames, so even a very quick tap is never lost.
 */
import { ALT_BINDINGS, type Action, type Settings } from "../systems/settings";

export interface InputFrame {
  left: boolean;
  right: boolean;
  sprint: boolean;
  jumpHeld: boolean;
  jumpPressed: boolean;
  interactPressed: boolean;
  sniffPressed: boolean;
  barkPressed: boolean;
  /** Any gameplay input this frame (for hints: standing still on purpose is not "stuck"). */
  any: boolean;
}

export type Device = "keyboard" | "touch" | "gamepad";

export type TouchButton = "left" | "right" | "jump" | "interact" | "sniff" | "sprint" | "bark";

const GAME_KEYS = new Set(["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

export class InputManager {
  private down = new Set<string>();
  private latched = new Set<Action>();
  private touch: Record<TouchButton, boolean> = { left: false, right: false, jump: false, interact: false, sniff: false, sprint: false, bark: false };
  private touchSprintToggle = false;
  private padPrev: boolean[] = [];
  private codeToAction = new Map<string, Action>();
  /** When set, the next key press is captured for remapping instead of played. */
  private capture: ((code: string) => void) | null = null;
  onPause: (() => void) | null = null;
  onAnyInput: (() => void) | null = null;
  /** Fired when the player switches between keyboard, touch and gamepad (prompts re-render). */
  onDeviceChange: ((d: Device) => void) | null = null;
  private device: Device = "keyboard";

  get lastDevice(): Device {
    return this.device;
  }
  set lastDevice(d: Device) {
    if (d === this.device) return;
    this.device = d;
    this.onDeviceChange?.(d);
  }

  constructor(settings: Settings) {
    this.setBindings(settings);
    window.addEventListener("keydown", this.onKeyDown, { capture: true });
    window.addEventListener("keyup", this.onKeyUp, { capture: true });
    window.addEventListener("blur", () => this.releaseAll());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.releaseAll();
    });
  }

  setBindings(s: Settings): void {
    this.codeToAction.clear();
    for (const [action, alts] of Object.entries(ALT_BINDINGS) as Array<[Action, string[]]>) for (const c of alts) this.codeToAction.set(c, action);
    for (const [action, code] of Object.entries(s.bindings) as Array<[Action, string]>) this.codeToAction.set(code, action);
    this.codeToAction.set("Escape", "pause");
  }

  captureNextKey(cb: (code: string) => void): void {
    this.capture = cb;
  }

  cancelCapture(): void {
    this.capture = null;
  }

  private isTyping(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    return !!t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA") && (t as HTMLInputElement).type !== "range";
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.capture) {
      e.preventDefault();
      e.stopPropagation();
      const cb = this.capture;
      this.capture = null;
      if (e.code !== "Escape") cb(e.code);
      else cb("");
      return;
    }
    if (this.isTyping(e)) return;
    this.lastDevice = "keyboard";
    const action = this.codeToAction.get(e.code);
    if (action === "pause") {
      if (!e.repeat) this.onPause?.();
      e.preventDefault();
      return;
    }
    const inMenu = !!(e.target as HTMLElement | null)?.closest?.("[data-menu]");
    if (inMenu) return; // let menus handle their own keys (Enter / Space on buttons)
    if (GAME_KEYS.has(e.code) || action) e.preventDefault();
    if (!e.repeat) {
      this.onAnyInput?.();
      if (action) this.latched.add(action);
    }
    this.down.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
  };

  releaseAll(): void {
    this.down.clear();
    this.latched.clear();
    for (const k of Object.keys(this.touch) as TouchButton[]) this.touch[k] = false;
  }

  setTouch(button: TouchButton, pressed: boolean): void {
    this.lastDevice = "touch";
    if (button === "sprint") {
      if (pressed) this.touchSprintToggle = !this.touchSprintToggle;
      return;
    }
    if (pressed && !this.touch[button]) {
      this.onAnyInput?.();
      if (button === "jump" || button === "interact" || button === "sniff" || button === "bark") this.latched.add(button);
    }
    this.touch[button] = pressed;
  }

  get sprintToggled(): boolean {
    return this.touchSprintToggle;
  }

  private held(action: Action): boolean {
    for (const code of this.down) if (this.codeToAction.get(code) === action) return true;
    return false;
  }

  /** Reads gamepads (standard mapping). */
  private pollPad(): Partial<Record<Action, boolean>> & { axisX: number } {
    const res: Partial<Record<Action, boolean>> & { axisX: number } = { axisX: 0 };
    const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = Array.from(pads ?? []).find((p) => p && p.connected);
    if (!pad) return res;
    const b = (i: number) => !!pad.buttons[i]?.pressed;
    const now = pad.buttons.map((x) => x.pressed);
    const edge = (i: number) => now[i] && !this.padPrev[i];
    const ax = pad.axes[0] ?? 0;
    res.axisX = Math.abs(ax) > 0.35 ? ax : 0;
    res.left = b(14) || res.axisX < 0;
    res.right = b(15) || res.axisX > 0;
    res.jump = b(0);
    res.sprint = b(1) || b(5) || b(7);
    if (now.some((x) => x)) this.lastDevice = "gamepad";
    if (edge(0)) this.latched.add("jump");
    if (edge(2)) this.latched.add("interact");
    if (edge(3)) this.latched.add("sniff");
    if (edge(4)) this.latched.add("bark");
    if (edge(9)) this.onPause?.();
    if (now.some((x, i) => x && !this.padPrev[i])) this.onAnyInput?.();
    this.padPrev = now;
    return res;
  }

  poll(): InputFrame {
    const pad = this.pollPad();
    const f: InputFrame = {
      left: this.held("left") || this.touch.left || !!pad.left,
      right: this.held("right") || this.touch.right || !!pad.right,
      sprint: this.held("sprint") || this.touchSprintToggle || !!pad.sprint,
      jumpHeld: this.held("jump") || this.touch.jump || !!pad.jump,
      jumpPressed: this.latched.has("jump"),
      interactPressed: this.latched.has("interact"),
      sniffPressed: this.latched.has("sniff"),
      barkPressed: this.latched.has("bark"),
      any: false,
    };
    f.any = f.left || f.right || f.jumpHeld || f.jumpPressed || f.interactPressed || f.sniffPressed || f.barkPressed;
    this.latched.clear();
    return f;
  }

  /** Clears pending presses (e.g. after closing a dialogue so E doesn't trigger twice). */
  flush(): void {
    this.latched.clear();
  }
}
