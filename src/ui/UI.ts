/**
 * HTML overlay: HUD, transmissions, menus and touch controls.
 * DOM is used (not canvas text) so text is crisp at any size, scales with the Text Size
 * setting and works with screen readers. It is updated only when something changes, never
 * once per physics frame.
 */
import { NOTE_MS, NoteQueue, type NoteKind } from "../systems/notifications";
import { ITEM_ORDER, ITEMS, type ItemId } from "../data/items";
import type { Transmission } from "../data/story";
import { iconUrl } from "../art/icons";
import type { Objective } from "../systems/mission";
import { ACTION_LABELS, DEFAULT_BINDINGS, defaultSettings, keyLabel, REMAPPABLE, type Action, type Settings } from "../systems/settings";
import type { SignalLevel } from "../systems/sniff";
import type { InputManager, TouchButton } from "../input/InputManager";

type Tone = "info" | "good" | "warn";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(label: string, onClick: () => void, cls = "px-btn"): HTMLButtonElement {
  const b = el("button", cls, label);
  b.type = "button";
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return b;
}

export interface UICallbacks {
  click: () => void;
  hover: () => void;
  blip: () => void;
}

export class UI {
  readonly root: HTMLElement;
  private hud: HTMLElement;
  private objectiveEl: HTMLElement;
  private inventoryEl: HTMLElement;
  private promptEl: HTMLElement;
  private toastsEl: HTMLElement;
  private regionEl: HTMLElement;
  private transEl: HTMLElement;
  private readEl: HTMLElement;
  private tipEl: HTMLElement;
  private touchEl: HTMLElement;
  private screenEl: HTMLElement;
  private fadeEl: HTMLElement;
  private actBtn: HTMLButtonElement | null = null;
  private sniffBtn: HTMLButtonElement | null = null;
  private lastInventory = new Map<ItemId, number>();
  private transState: {
    t: Transmission;
    line: number;
    shown: number;
    timer: number | null;
    blocking: boolean;
    onDone: () => void;
    autoTimer: number | null;
  } | null = null;
  private readTimer: number | null = null;
  private tipTimer: number | null = null;
  private regionTimer: number | null = null;
  private currentObjective: Objective | null = null;
  settings: Settings;
  onPauseButton: (() => void) | null = null;
  onSettingsApplied: (() => void) | null = null;
  onHintButton: (() => void) | null = null;
  onMapButton: (() => void) | null = null;
  private abilitiesEl!: HTMLElement;

  constructor(
    root: HTMLElement,
    settings: Settings,
    private input: InputManager,
    private cb: UICallbacks,
  ) {
    this.root = root;
    this.settings = settings;
    this.hud = el("div", "hud hidden");
    this.objectiveEl = el("div", "hud-objective px-panel");
    this.objectiveEl.setAttribute("aria-live", "polite");
    const topRight = el("div", "hud-top-right");
    this.inventoryEl = el("div", "hud-inventory px-panel");
    this.inventoryEl.setAttribute("aria-label", "Inventory");
    const hintBtn = button("?", () => this.onHintButton?.(), "hud-btn interactive");
    hintBtn.title = "Hint";
    hintBtn.setAttribute("aria-label", "Show a hint");
    const pauseBtn = button("II", () => this.onPauseButton?.(), "hud-btn interactive");
    this.pauseBtn = pauseBtn;
    pauseBtn.title = "Pause";
    pauseBtn.setAttribute("aria-label", "Pause");
    const mapBtn = button("▦", () => this.onMapButton?.(), "hud-btn interactive");
    mapBtn.title = "World map";
    mapBtn.setAttribute("aria-label", "Open the world map");
    // Phase 3: a small strip of the gadgets Laika has (room for future ones, no inventory screen).
    this.abilitiesEl = el("div", "hud-abilities");
    topRight.append(this.abilitiesEl, this.inventoryEl, mapBtn, hintBtn, pauseBtn);
    this.promptEl = el("div", "hud-prompt px-panel hidden");
    this.promptEl.setAttribute("aria-live", "polite");
    // Phase 4: the right column holds the button row and, below it, the suit meter and power chip.
    this.hudRight = el("div", "hud-right");
    this.hudRight.append(topRight);
    this.hud.append(this.objectiveEl, this.hudRight, this.promptEl);

    this.toastsEl = el("div", "toasts");
    this.toastsEl.setAttribute("aria-live", "polite");
    this.regionEl = el("div", "region-banner hidden");
    this.transEl = el("div", "transmission px-panel hidden interactive");
    this.transEl.setAttribute("role", "dialog");
    this.transEl.addEventListener("click", () => this.advanceTransmission());
    this.readEl = el("div", "read-card px-panel hidden");
    this.readEl.setAttribute("aria-live", "polite");
    this.tipEl = el("div", "tip px-panel hidden");
    this.touchEl = el("div", "touch hidden");
    this.screenEl = el("div", "screen-host");
    this.fadeEl = el("div", "fade");
    root.append(this.hud, this.regionEl, this.readEl, this.tipEl, this.transEl, this.toastsEl, this.screenEl, this.fadeEl);
    // Touch buttons live on the whole screen (they can use the letterbox bars), not on the canvas.
    document.body.append(this.touchEl);
    this.buildTouch();
    this.applySettings(settings);
  }

  private fit = 1;

  /** Scales the whole overlay with the game's on-screen size (phones vs. big monitors). */
  setFit(fit: number): void {
    this.fit = fit;
    document.documentElement.style.setProperty("--ui-scale", String(this.settings.textScale * this.fit));
  }

  applySettings(s: Settings): void {
    this.settings = s;
    document.documentElement.style.setProperty("--ui-scale", String(s.textScale * this.fit));
    document.body.classList.toggle("reduced-motion", s.reducedMotion);
    document.body.classList.toggle("hud-detailed", s.hud === "detailed");
    if (this.currentObjective) this.setObjective(this.currentObjective);
    this.updateTouchVisibility();
    this.onSettingsApplied?.();
  }

  // ---------------- HUD ----------------

  showHud(on: boolean): void {
    this.hud.classList.toggle("hidden", !on);
    this.updateTouchVisibility(on);
  }

  private expanded = false;
  private hintLevel = 0;

  /** Label for an action on the device in use ("E", "X", "tap the action button"...). */
  actionLabel(a: Action): string {
    const d = this.input.lastDevice;
    if (d === "touch") return a === "interact" ? "Action" : a === "sniff" ? "SNIFF" : a === "jump" ? "JUMP" : a === "left" || a === "right" ? "◀ ▶" : a.toUpperCase();
    if (d === "gamepad") return ({ jump: "Ⓐ", interact: "Ⓧ", sniff: "Ⓨ", bark: "LB", sprint: "Ⓑ", left: "Stick", right: "Stick", pause: "Start" } as Record<Action, string>)[a];
    return keyLabel(this.settings.bindings[a]);
  }

  /**
   * Collapsed: ONE actionable line (what + where) with the control to use.
   * Expanded (Details): the full checklist, then optional goals in their own section.
   */
  setObjective(o: Objective, hintLevel = this.hintLevel): void {
    this.currentObjective = o;
    this.hintLevel = hintLevel;
    const box = this.objectiveEl;
    box.replaceChildren();
    const detailed = this.settings.hud === "detailed";
    box.classList.toggle("expanded", detailed && this.expanded);
    box.classList.toggle("compact", !detailed);
    if (detailed) {
      const label = el("div", "title");
      label.append(el("span", "", o.title));
      const toggle = button(this.expanded ? "▴ Less" : "▾ Details", () => {
        this.expanded = !this.expanded;
        this.setObjective(o, this.hintLevel);
      }, "obj-toggle interactive");
      toggle.setAttribute("aria-expanded", String(this.expanded));
      label.append(toggle);
      box.append(label);
    }
    const main = el("div", "primary");
    this.dirEl = el("span", "dir", this.dirText);
    this.dirEl.setAttribute("aria-hidden", "true");
    main.append(this.dirEl, el("span", "txt", o.primary));
    if (o.action) {
      const a: Action = o.action === "move" ? "right" : o.action;
      main.append(el("span", "key", this.actionLabel(a)));
    }
    box.append(main);
    if (hintLevel >= 2 && o.hint) box.append(el("div", "hint", o.hint));
    if (detailed && this.expanded) {
      const ul = el("ul");
      for (const st of o.steps) {
        const li = el("li", st.done ? "done" : "");
        li.append(el("span", "box", st.done ? "[x]" : "[ ]"), el("span", "", st.text));
        ul.append(li);
      }
      box.append(ul);
      if (o.optional.length) {
        box.append(el("div", "opt-head", "Optional"));
        const ol = el("ul", "optional");
        for (const st of o.optional) {
          const li = el("li", st.done ? "done" : "");
          li.append(el("span", "box", st.done ? "[x]" : "[ ]"), el("span", "", st.text));
          ol.append(li);
        }
        box.append(ol);
      }
    }
  }

  private dirEl: HTMLElement | null = null;
  private dirText = "▶";
  /** Phase 5: the objective line's small direction arrow (from the waypoint system). */
  setDirection(d: "left" | "right" | "up" | "down" | "here" | null): void {
    const t = d === "left" ? "◀" : d === "right" ? "▶" : d === "up" ? "▲" : d === "down" ? "▼" : d === "here" ? "●" : "▶";
    if (t === this.dirText) return;
    this.dirText = t;
    if (this.dirEl) this.dirEl.textContent = t;
  }

  setHintLevel(level: number): void {
    if (level === this.hintLevel || !this.currentObjective) return;
    this.setObjective(this.currentObjective, level);
  }

  showObjective(on: boolean): void {
    this.objectiveEl.classList.toggle("hidden", !on);
  }

  // ---------------- scanner meter & captions ----------------

  private signalEl: HTMLElement | null = null;
  setSignal(level: SignalLevel | null, trendWord: "warmer" | "colder" | "steady" = "steady"): void {
    if (!this.signalEl) {
      this.signalEl = el("div", "signal px-panel hidden");
      this.signalEl.setAttribute("aria-live", "polite");
      this.root.append(this.signalEl);
    }
    const e = this.signalEl;
    if (!level) {
      e.classList.add("hidden");
      return;
    }
    const bars = { none: 0, weak: 1, strong: 3, located: 4 }[level];
    const words = { none: "No signal nearby", weak: "Weak signal", strong: "Strong signal!", located: "Found it! Dig here" }[level];
    const tr = level === "none" || level === "located" ? "" : trendWord === "warmer" ? " ▲ closer" : trendWord === "colder" ? " ▼ further" : "";
    const meter = el("span", "bars");
    for (let i = 0; i < 4; i++) meter.append(el("span", i < bars ? "bar on" : "bar"));
    e.replaceChildren(el("span", "lbl", "SCANNER"), meter, el("span", "", words + tr));
    e.classList.remove("hidden");
  }

  private captionTimer: number | null = null;
  caption(text: string): void {
    if (!this.settings.captions) return;
    let c = this.root.querySelector<HTMLElement>(".caption");
    if (!c) {
      c = el("div", "caption");
      c.setAttribute("aria-live", "polite");
      this.root.append(c);
    }
    c.textContent = `♪ ${text}`;
    c.classList.remove("hidden");
    if (this.captionTimer) window.clearTimeout(this.captionTimer);
    this.captionTimer = window.setTimeout(() => c!.classList.add("hidden"), 1600);
  }

  setInventory(inv: Record<ItemId, number>): void {
    let changed = false;
    this.inventoryEl.replaceChildren();
    for (const id of ITEM_ORDER) {
      const n = inv[id] ?? 0;
      if (n <= 0 && !ITEMS[id].alwaysShow) continue;
      const chip = el("div", "inv-chip");
      chip.title = ITEMS[id].name;
      const img = el("img", "icon-img");
      img.src = iconUrl(id);
      img.alt = ITEMS[id].name;
      chip.append(img, el("span", "", id === "commsModule" || id === "treat" ? "" : `×${n}`));
      chip.setAttribute("aria-label", `${ITEMS[id].name}: ${n}`);
      if ((this.lastInventory.get(id) ?? 0) !== n) {
        chip.classList.add("bump");
        changed = true;
      }
      this.inventoryEl.append(chip);
    }
    for (const id of ITEM_ORDER) this.lastInventory.set(id, inv[id] ?? 0);
    if (changed && this.inventorySeeded) this.peekInventory(3200);
    this.inventorySeeded = true;
  }

  private inventorySeeded = false;
  private peekTimer: number | null = null;
  /** Phase 5: show the inventory for a moment (after a pick-up, at the workbench). 0 ms = until told. */
  peekInventory(ms: number, on = true): void {
    if (this.peekTimer) window.clearTimeout(this.peekTimer);
    this.inventoryEl.classList.toggle("peek", on);
    if (on && ms > 0) this.peekTimer = window.setTimeout(() => this.inventoryEl.classList.remove("peek"), ms);
  }

  setPrompt(p: { verb: string; detail?: string } | null): void {
    if (!p) {
      this.promptEl.classList.add("hidden");
      this.actBtn?.classList.remove("ready");
      if (this.actBtn) this.actBtn.textContent = "E";
      return;
    }
    this.promptEl.replaceChildren();
    const key = el("span", "key", this.actionLabel("interact"));
    this.promptEl.append(key, el("span", "", p.verb));
    if (p.detail) this.promptEl.append(el("span", "detail", `(${p.detail})`));
    this.promptEl.classList.remove("hidden");
    if (this.actBtn) {
      this.actBtn.classList.add("ready");
      this.actBtn.textContent = p.verb.split(" ")[0];
    }
  }

  private notes = new NoteQueue();
  private noteTimer: number | null = null;

  /**
   * Phase 5: every toast goes through a priority queue: one at a time, no duplicates, pick-ups
   * merge, warnings first. `kind` overrides the default mapping from the tone.
   */
  toast(text: string, tone: Tone = "info", icon?: ItemId, kind?: NoteKind): void {
    const k: NoteKind = kind ?? (tone === "warn" ? "warn" : icon ? "item" : tone === "good" ? "milestone" : "info");
    this.notes.push({ text, kind: k, icon, itemKey: icon, amount: 1 }, performance.now());
    this.pumpNotes();
  }

  private pumpNotes(): void {
    const n = this.notes.take(performance.now());
    if (n) this.showToastNow(n.text, n.kind === "warn" ? "warn" : n.kind === "info" ? "info" : "good", n.icon as ItemId | undefined);
    if (this.notes.pending > 0 && this.noteTimer === null) {
      this.noteTimer = window.setTimeout(() => {
        this.noteTimer = null;
        this.pumpNotes();
      }, 400);
    }
  }

  private showToastNow(text: string, tone: Tone, icon?: ItemId): void {
    const t = el("div", `toast px-panel ${tone}`);
    if (icon) {
      const img = el("img", "icon-img");
      img.src = iconUrl(icon);
      img.alt = "";
      t.append(img);
    }
    t.append(el("span", "", text));
    this.toastsEl.append(t);
    while (this.toastsEl.children.length > 2) this.toastsEl.firstElementChild?.remove();
    window.setTimeout(() => t.classList.add("out"), NOTE_MS - 400);
    window.setTimeout(() => t.remove(), NOTE_MS);
  }

  private pauseBtn: HTMLButtonElement | null = null;
  /** Phase 5: a small dot on the pause button when the journal has something new. */
  setJournalBadge(on: boolean): void {
    this.pauseBtn?.classList.toggle("badge", on);
    if (this.pauseBtn) this.pauseBtn.setAttribute("aria-label", on ? "Pause (journal has news)" : "Pause");
  }

  /** Phase 5: a small chapter label that fades by itself (no card to dismiss). */
  showChapter(label: string, title: string): void {
    this.showRegion(title.toUpperCase(), label);
  }

  showRegion(name: string, sub = ""): void {
    this.regionEl.replaceChildren(el("small", "", sub), document.createTextNode(name));
    this.regionEl.classList.remove("hidden");
    this.regionEl.style.opacity = "1";
    if (this.regionTimer) window.clearTimeout(this.regionTimer);
    this.regionTimer = window.setTimeout(() => {
      this.regionEl.style.opacity = "0";
      this.regionTimer = window.setTimeout(() => this.regionEl.classList.add("hidden"), 700);
    }, 2000);
  }

  showRead(title: string, lines: string[]): void {
    this.readEl.replaceChildren(el("div", "title", title), ...lines.map((l) => el("div", "", l)));
    this.readEl.classList.remove("hidden");
    if (this.readTimer) window.clearTimeout(this.readTimer);
    this.readTimer = window.setTimeout(() => this.hideRead(), 4500 + lines.length * 1800);
  }

  hideRead(): void {
    this.readEl.classList.add("hidden");
  }

  get readOpen(): boolean {
    return !this.readEl.classList.contains("hidden");
  }

  showTip(text: string, label = "Science"): void {
    this.tipEl.replaceChildren(el("span", "label", `${label}: `), document.createTextNode(text));
    this.tipEl.classList.remove("hidden");
    // Sit just below the top-right HUD column (it grows by the suit meter and power chip in Phase 4).
    const col = this.hudRight?.getBoundingClientRect();
    const root = this.root.getBoundingClientRect();
    if (col && col.height > 0 && !this.hud.classList.contains("hidden")) this.tipEl.style.top = `${Math.round(col.bottom - root.top + 6)}px`;
    else this.tipEl.style.top = "";
    if (this.tipTimer) window.clearTimeout(this.tipTimer);
    this.tipTimer = window.setTimeout(() => this.tipEl.classList.add("hidden"), 7000);
  }

  // ---------------- Transmissions ----------------

  get transmissionOpen(): boolean {
    return this.transState !== null;
  }

  get transmissionBlocking(): boolean {
    return !!this.transState?.blocking;
  }

  showTransmission(t: Transmission, onDone: () => void, blocking = true): void {
    this.closeTransmission(false);
    this.transState = { t, line: 0, shown: 0, timer: null, blocking, onDone, autoTimer: null };
    this.transEl.classList.toggle("passive", !blocking);
    this.transEl.classList.remove("hidden");
    this.renderLine();
  }

  private charDelay(): number {
    return this.settings.textSpeed === "instant" ? 0 : this.settings.textSpeed === "slow" ? 55 : 26;
  }

  private renderLine(): void {
    const st = this.transState;
    if (!st) return;
    const line = st.t.lines[st.line];
    this.transEl.replaceChildren();
    const head = el("div", "head");
    head.append(el("span", "rec", st.t.title), el("span", "", `${st.line + 1}/${st.t.lines.length}`));
    const speaker = el("div", "speaker", line.speaker);
    const text = el("div", `text${line.static ? " static" : ""}`);
    text.setAttribute("aria-live", "polite");
    const next = el("div", "next", st.blocking ? (st.line < st.t.lines.length - 1 ? "Next ▶" : "Close ▶") : "");
    this.transEl.append(head, speaker, text, next);
    st.shown = 0;
    const delay = this.charDelay();
    if (delay === 0) {
      st.shown = line.text.length;
      text.textContent = line.text;
      this.afterLine();
      return;
    }
    st.timer = window.setInterval(() => {
      st.shown += 1;
      text.textContent = line.text.slice(0, st.shown);
      if (st.shown % 3 === 1 && line.text[st.shown - 1] !== " ") this.cb.blip();
      if (st.shown >= line.text.length) {
        if (st.timer) window.clearInterval(st.timer);
        st.timer = null;
        this.afterLine();
      }
    }, delay);
  }

  private afterLine(): void {
    const st = this.transState;
    if (!st || st.blocking) return;
    st.autoTimer = window.setTimeout(() => this.advanceTransmission(), 2300);
  }

  /** E / Space / click: finish the current line, or go to the next one. */
  advanceTransmission(): void {
    const st = this.transState;
    if (!st) return;
    const line = st.t.lines[st.line];
    if (st.timer) {
      window.clearInterval(st.timer);
      st.timer = null;
      st.shown = line.text.length;
      const text = this.transEl.querySelector(".text");
      if (text) text.textContent = line.text;
      this.afterLine();
      return;
    }
    if (st.autoTimer) window.clearTimeout(st.autoTimer);
    if (st.line < st.t.lines.length - 1) {
      st.line += 1;
      this.renderLine();
    } else {
      this.closeTransmission(true);
    }
  }

  closeTransmission(callDone: boolean): void {
    const st = this.transState;
    if (!st) return;
    if (st.timer) window.clearInterval(st.timer);
    if (st.autoTimer) window.clearTimeout(st.autoTimer);
    this.transState = null;
    this.transEl.classList.add("hidden");
    if (callDone) st.onDone();
  }

  // ---------------- Screens ----------------

  get screenOpen(): boolean {
    return this.screenEl.childElementCount > 0;
  }

  closeScreen(): void {
    this.screenEl.replaceChildren();
    (document.activeElement as HTMLElement | null)?.blur?.();
  }

  /** Phase 4: opens a game panel (base status, power console, science journal). */
  showCustom(content: HTMLElement): HTMLElement {
    return this.openScreen(content);
  }

  /** Phase 4: adds a HUD element (suit meter, power chip) that follows the HUD's visibility. */
  mountHud(node: HTMLElement): void {
    this.hudRight.append(node);
  }

  private hudRight!: HTMLElement;

  private openScreen(content: HTMLElement, opts: { dim?: boolean; cls?: string } = {}): HTMLElement {
    this.closeScreen();
    const screen = el("div", `screen${opts.dim === false ? "" : " dim"} ${opts.cls ?? ""}`);
    screen.dataset.menu = "1";
    screen.append(content);
    screen.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = Array.from(screen.querySelectorAll<HTMLElement>("button, input, select"));
      const i = items.indexOf(document.activeElement as HTMLElement);
      if (i < 0 || (document.activeElement as HTMLInputElement).type === "range") return;
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    });
    screen.addEventListener("mouseover", (e) => {
      if ((e.target as HTMLElement).tagName === "BUTTON") this.cb.hover();
    });
    screen.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).tagName === "BUTTON") this.cb.click();
    });
    this.screenEl.append(screen);
    window.setTimeout(() => screen.querySelector<HTMLElement>("button")?.focus({ preventScroll: true }), 30);
    return screen;
  }

  showTitle(opts: {
    canContinue: boolean;
    notice?: string;
    onContinue: () => void;
    onNew: () => void;
    onSettings: () => void;
    onCredits: () => void;
    onReplayTutorial?: () => void;
    onControls?: () => void;
    dedication: string;
  }): void {
    const block = el("div", "title-block");
    const logo = el("div", "logo");
    logo.append(document.createTextNode("LAIKA"), el("span", "sub", "THE LAST SIGNAL"));
    const tagline = el("div", "tagline", "One small dog. One lost signal.");
    const buttons = el("div", "title-buttons");
    if (opts.canContinue) buttons.append(button("▶ Continue", opts.onContinue, "px-btn big"));
    buttons.append(
      button(opts.canContinue ? "New Game" : "▶ New Game", opts.onNew, opts.canContinue ? "px-btn secondary" : "px-btn big"),
      button("Settings", opts.onSettings, "px-btn secondary"),
    );
    // Phase 5: secondary options live behind one small button.
    const more = el("div", "title-more hidden");
    if (opts.onReplayTutorial) more.append(button("Tutorial", opts.onReplayTutorial, "px-btn secondary small"));
    if (opts.onControls) more.append(button("Controls", opts.onControls, "px-btn secondary small"));
    more.append(button("Credits", opts.onCredits, "px-btn secondary small"));
    const moreBtn = button("More ▾", () => {
      const open = more.classList.toggle("hidden");
      moreBtn.textContent = open ? "More ▾" : "More ▴";
    }, "px-btn ghost small");
    buttons.append(moreBtn, more);
    block.append(logo, tagline, buttons);
    if (opts.notice) block.append(el("div", "toast px-panel warn", opts.notice));
    const wrap = el("div");
    wrap.style.display = "contents";
    wrap.append(block, el("div", "dedication", opts.dedication));
    this.openScreen(wrap, { dim: false, cls: "title-screen" });
  }

  confirm(text: string, yesLabel: string, onYes: () => void, onNo: () => void): void {
    const card = el("div", "menu-card px-panel");
    card.append(el("h2", "", "Are you sure?"), el("p", "", text));
    const row = el("div", "row-buttons");
    row.append(button("Cancel", onNo, "px-btn secondary"), button(yesLabel, onYes, "px-btn danger"));
    card.append(row);
    this.openScreen(card);
  }

  showInfo(title: string, paragraphs: string[], onBack: () => void): void {
    const card = el("div", "menu-card px-panel");
    card.style.maxWidth = "min(94%, 640px)";
    card.append(el("h2", "", title), ...paragraphs.map((p) => el("p", "", p)), button("Back", onBack, "px-btn secondary"));
    this.openScreen(card);
  }

  showPause(opts: {
    onResume: () => void;
    onSettings: () => void;
    onControls: () => void;
    onCheckpoint: () => void;
    onRestart: () => void;
    onMenu: () => void;
    tutorial: "first" | "replay" | null;
    onSkipTutorial?: () => void;
    onRestartTutorial?: () => void;
    onReplayTutorial?: () => void;
    onEndReplay?: () => void;
    onMap?: () => void;
    onBase?: () => void;
    onScience?: () => void;
    onJournal?: () => void;
  }): void {
    const card = el("div", "menu-card px-panel");
    card.append(el("h2", "", opts.tutorial ? "Paused · Tutorial" : "Paused"));
    card.append(button("▶ Resume", opts.onResume));
    if (opts.onMap) card.append(button("Map", opts.onMap, "px-btn secondary"));
    if (opts.onJournal) card.append(button("Journal", opts.onJournal, "px-btn secondary"));
    if (opts.onBase) card.append(button("Base status", opts.onBase, "px-btn secondary"));
    card.append(button("Settings", opts.onSettings, "px-btn secondary"), button("Controls", opts.onControls, "px-btn secondary"));
    if (opts.tutorial === "first") {
      card.append(button("Restart tutorial", opts.onRestartTutorial!, "px-btn secondary"), button("Skip tutorial", opts.onSkipTutorial!, "px-btn secondary"));
    } else if (opts.tutorial === "replay") {
      card.append(button("Restart tutorial", opts.onRestartTutorial!, "px-btn secondary"), button("End tutorial replay", opts.onEndReplay!, "px-btn secondary"));
    } else {
      card.append(button("Return to last checkpoint", opts.onCheckpoint, "px-btn secondary"));
      if (opts.onReplayTutorial) card.append(button("Replay tutorial", opts.onReplayTutorial, "px-btn secondary"));
    }
    card.append(button("Save & quit", opts.onMenu, "px-btn secondary"), button("Restart adventure", opts.onRestart, "px-btn secondary danger-text"));
    this.openScreen(card);
  }

  /** Controls reference, always reflecting the current bindings. */
  showControls(onBack: () => void): void {
    const b = this.settings.bindings;
    const card = el("div", "menu-card px-panel");
    card.style.maxWidth = "min(94%, 560px)";
    card.append(el("h2", "", "Controls"));
    const grid = el("div", "settings-grid");
    const row = (what: string, kb: string, touch: string, pad: string) => grid.append(el("span", "", what), el("span", "", `${kb} · ${touch} · ${pad}`));
    grid.append(el("h3", "", "Keyboard · Touch · Gamepad"));
    row("Move", `${keyLabel(b.left)}/${keyLabel(b.right)} or ←/→`, "◀ ▶ pad", "Stick / D-pad");
    row("Jump (hold = higher)", keyLabel(b.jump), "JUMP", "Ⓐ");
    row("Interact / Dig / Repair", keyLabel(b.interact), "Action button", "Ⓧ");
    row("Sniff (scanner)", keyLabel(b.sniff), "SNIFF", "Ⓨ");
    row("Sprint", keyLabel(b.sprint), "RUN (toggle)", "Ⓑ / RB");
    row("Bark (optional)", keyLabel(b.bark), "BARK", "LB");
    row("World map", `${keyLabel(b.map)} or Tab`, "▦ button", "Back / Select");
    row("Headlamp", "Automatic underground", "Automatic", "Automatic");
    row("Pause", "Esc / P", "II", "Start");
    card.append(grid, el("p", "", "Change keys in Settings → Controls."), button("Back", onBack));
    this.openScreen(card);
  }

  private settingsTab: "play" | "display" | "audio" | "controls" = "play";

  /**
   * Phase 5: four small categories instead of one long list, friendly labels, recommended
   * defaults marked, and Reset to defaults (asks once more before it resets).
   */
  showSettings(settings: Settings, onChange: (s: Settings) => void, onBack: () => void): void {
    let s = { ...settings, bindings: { ...settings.bindings } };
    const card = el("div", "menu-card px-panel settings-card");
    card.style.maxWidth = "min(94%, 560px)";
    card.append(el("h2", "", "Settings"));
    const tabs = el("div", "settings-tabs");
    tabs.setAttribute("role", "tablist");
    const TABS: Array<[typeof this.settingsTab, string]> = [
      ["play", "Gameplay help"],
      ["display", "Display"],
      ["audio", "Audio"],
      ["controls", "Controls"],
    ];
    const rerender = () => this.showSettings(s, onChange, onBack);
    for (const [id, label] of TABS) {
      const b = button(label, () => {
        this.settingsTab = id;
        rerender();
      }, `tab-btn${this.settingsTab === id ? " on" : ""}`);
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(this.settingsTab === id));
      tabs.append(b);
    }
    card.append(tabs);
    const grid = el("div", "settings-grid");
    const commit = (next: Settings) => {
      s = next;
      onChange(s);
    };
    const slider = (label: string, key: "master" | "music" | "ambience" | "sfx") => {
      const id = `set-${key}`;
      const lab = el("label", "", label);
      lab.htmlFor = id;
      const input = el("input");
      input.type = "range";
      input.id = id;
      input.min = "0";
      input.max = "100";
      input.step = "5";
      input.value = String(Math.round(s[key] * 100));
      input.setAttribute("aria-valuetext", `${input.value}%`);
      input.addEventListener("input", () => {
        input.setAttribute("aria-valuetext", `${input.value}%`);
        commit({ ...s, [key]: Number(input.value) / 100 });
      });
      grid.append(lab, input);
    };
    const toggle = (label: string, key: "reducedMotion" | "hints" | "assistJumps" | "captions" | "brightCaves", help?: string) => {
      const id = `set-${key}`;
      const lab = el("label", "", label);
      lab.htmlFor = id;
      const wrap = el("div", "switch");
      const input = el("input");
      input.type = "checkbox";
      input.id = id;
      input.checked = s[key];
      input.addEventListener("change", () => commit({ ...s, [key]: input.checked }));
      wrap.append(input, el("span", "", help ?? ""));
      grid.append(lab, wrap);
    };
    const select = <K extends "textScale" | "touchControls" | "textSpeed" | "survival" | "guidance" | "hud">(label: string, key: K, options: Array<[Settings[K], string]>) => {
      const id = `set-${key}`;
      const lab = el("label", "", label);
      lab.htmlFor = id;
      const sel = el("select");
      sel.id = id;
      for (const [v, text] of options) {
        const o = el("option", "", text);
        o.value = String(v);
        if (s[key] === v) o.selected = true;
        sel.append(o);
      }
      sel.addEventListener("change", () => {
        const raw = sel.value;
        const v = (key === "textScale" ? Number(raw) : raw) as Settings[K];
        commit({ ...s, [key]: v });
        if (key === "hud" && this.currentObjective) this.setObjective(this.currentObjective);
      });
      grid.append(lab, sel);
    };
    if (this.settingsTab === "play") {
      select("Guidance", "guidance", [
        ["guided", "Guided: show the way (recommended)"],
        ["explorer", "Explorer: a light hint"],
        ["minimal", "Minimal: only when I ask (?)"],
      ]);
      select("Suit energy", "survival", [
        ["relaxed", "Relaxed: nothing to watch (recommended)"],
        ["adventure", "Adventure: thrusters use energy"],
        ["expedition", "Expedition: plan your energy"],
      ]);
      select("Screen info", "hud", [
        ["simple", "Simple (recommended)"],
        ["detailed", "Detailed: show everything"],
      ]);
      toggle("Hints", "hints", "Help when stuck");
      toggle("Easy jumps", "assistJumps", "Higher jumps, glide");
    } else if (this.settingsTab === "display") {
      select("Text size", "textScale", [
        [1, "Standard"],
        [1.25, "Large"],
        [1.5, "Extra large"],
      ]);
      select("Radio text", "textSpeed", [
        ["normal", "Normal"],
        ["slow", "Slow"],
        ["instant", "Instant"],
      ]);
      toggle("Reduced motion", "reducedMotion", "No shakes or pans");
      toggle("Sound captions", "captions", "Text for sounds");
      toggle("Brighter caves", "brightCaves", "Easier to see");
      select("Touch buttons", "touchControls", [
        ["auto", "Automatic"],
        ["on", "Always on"],
        ["off", "Off"],
      ]);
    } else if (this.settingsTab === "audio") {
      slider("Volume", "master");
      slider("Music", "music");
      slider("Ambience", "ambience");
      slider("Effects", "sfx");
    }
    const keyButtons = new Map<Action, HTMLButtonElement>();
    if (this.settingsTab === "controls") {
      grid.append(el("p", "fine span", "Click a key, then press the new key."));
      for (const action of REMAPPABLE) {
        const lab = el("span", "", ACTION_LABELS[action]);
        const kb = el("button", "key-btn", keyLabel(s.bindings[action]));
        kb.type = "button";
        kb.setAttribute("aria-label", `${ACTION_LABELS[action]}: ${keyLabel(s.bindings[action])}. Press to change.`);
        kb.addEventListener("click", () => {
          kb.classList.add("listening");
          kb.textContent = "Press a key…";
          this.input.captureNextKey((code) => {
            kb.classList.remove("listening");
            if (code && code !== "Escape") {
              const next = { ...s, bindings: { ...s.bindings } };
              const other = REMAPPABLE.find((a) => a !== action && next.bindings[a] === code);
              if (other) next.bindings[other] = next.bindings[action];
              next.bindings[action] = code;
              commit(next);
            }
            for (const [a, b] of keyButtons) b.textContent = keyLabel(s.bindings[a]);
            kb.focus();
          });
        });
        keyButtons.set(action, kb);
        grid.append(lab, kb);
      }
    }
    card.append(grid);
    const row = el("div", "row-buttons");
    let armed = false;
    const reset = button("Reset to defaults", () => {
      if (!armed) {
        armed = true;
        reset.textContent = "Tap again to reset";
        reset.classList.add("danger");
        return;
      }
      const d = defaultSettings(s.reducedMotion);
      commit(this.settingsTab === "controls" ? { ...s, bindings: { ...DEFAULT_BINDINGS } } : { ...d, bindings: s.bindings });
      rerender();
    }, "px-btn secondary");
    row.append(
      button("Back", () => {
        this.input.cancelCapture();
        onBack();
      }),
      reset,
    );
    card.append(row);
    this.openScreen(card);
  }

  showComplete(stats: { samples: number; samplesTotal: number; treat: boolean; boots: boolean; minutes: number }, onExplore: () => void, onMenu: () => void): void {
    const card = el("div", "menu-card px-panel complete-card");
    card.append(el("div", "big", "MISSION 01 COMPLETE"), el("p", "", "A Signal in the Silence"));
    const ul = el("ul");
    ul.append(
      el("li", "", `${stats.samples >= stats.samplesTotal ? "[x]" : "[ ]"} Geological samples: ${stats.samples}/${stats.samplesTotal}`),
      el("li", "", `${stats.treat ? "[x]" : "[ ]"} Secret Golden Treat ${stats.treat ? "found!" : "still hidden"}`),
      el("li", "", `${stats.boots ? "[x]" : "[ ]"} Thruster Boots ${stats.boots ? "built" : "not built"}`),
      el("li", "", `Time: about ${stats.minutes} min`),
    );
    card.append(ul, el("p", "", "Someone out there knows Laika's name..."), el("p", "", "Mission 02 begins: check the signal console again."));
    const row = el("div", "row-buttons");
    row.append(button("Keep exploring", onExplore), button("Title screen", onMenu, "px-btn secondary"));
    card.append(row);
    this.openScreen(card);
  }

  /** Phase 3: end-of-mission card for the later missions (journal of discoveries). */
  showStoryComplete(info: { title: string; subtitle: string; lines: string[]; minutes: number; epilogue?: string }, onExplore: () => void, onMenu: () => void): void {
    const card = el("div", "menu-card px-panel complete-card");
    card.append(el("div", "big", info.title), el("p", "", info.subtitle));
    const ul = el("ul");
    for (const l of info.lines) ul.append(el("li", "", l));
    ul.append(el("li", "", `Time: about ${info.minutes} min`));
    card.append(ul, el("p", "", info.epilogue ?? "The signal is older than the station... and it knows her name."), el("p", "", "To be continued."));
    const row = el("div", "row-buttons");
    row.append(button("Keep exploring", onExplore), button("Title screen", onMenu, "px-btn secondary"));
    card.append(row);
    this.openScreen(card);
  }

  /** Gadget strip: one small chip per ability Laika has (text + symbol, never colour alone). */
  setAbilities(a: { sniff: boolean; headlamp: boolean; thrusters: boolean }): void {
    const chips: Array<[boolean, string, string]> = [
      [a.sniff, "SCAN", "Scanner (Sniff)"],
      [a.headlamp, "LAMP", "Headlamp"],
      [a.thrusters, "BOOTS", "Thruster Boots"],
    ];
    this.abilitiesEl.replaceChildren(...chips.filter(([on]) => on).map(([, sym, name]) => {
      const c = el("span", "ability-chip", sym);
      c.title = name;
      c.setAttribute("aria-label", name);
      return c;
    }));
  }

  fade(on: boolean): void {
    this.fadeEl.classList.toggle("on", on);
  }

  // ---------------- Touch ----------------

  private buildTouch(): void {
    const mk = (cls: string, label: string, btn: TouchButton, aria: string) => {
      const b = el("button", cls, label);
      b.type = "button";
      b.setAttribute("aria-label", aria);
      const down = (e: PointerEvent) => {
        e.preventDefault();
        try {
          b.setPointerCapture(e.pointerId);
        } catch {
          /* synthetic or already-released pointer */
        }
        b.classList.add("pressed");
        this.input.setTouch(btn, true);
        if (btn === "sprint") b.classList.toggle("on", this.input.sprintToggled);
      };
      const up = (e: PointerEvent) => {
        e.preventDefault();
        b.classList.remove("pressed");
        this.input.setTouch(btn, false);
      };
      b.addEventListener("pointerdown", down);
      b.addEventListener("pointerup", up);
      b.addEventListener("pointercancel", up);
      b.addEventListener("lostpointercapture", () => {
        b.classList.remove("pressed");
        this.input.setTouch(btn, false);
      });
      b.addEventListener("contextmenu", (e) => e.preventDefault());
      this.touchEl.append(b);
      return b;
    };
    // One D-pad for both directions: slide your thumb between ◀ and ▶ without lifting it.
    const pad = el("div", "t-dpad");
    pad.setAttribute("role", "group");
    pad.setAttribute("aria-label", "Move left or right");
    const leftHalf = el("span", "half", "◀");
    const rightHalf = el("span", "half", "▶");
    pad.append(leftHalf, rightHalf);
    let padPointer: number | null = null;
    const setDir = (clientX: number | null) => {
      const r = pad.getBoundingClientRect();
      const dir = clientX === null ? 0 : clientX < r.left + r.width / 2 ? -1 : 1;
      this.input.setTouch("left", dir < 0);
      this.input.setTouch("right", dir > 0);
      leftHalf.classList.toggle("pressed", dir < 0);
      rightHalf.classList.toggle("pressed", dir > 0);
    };
    pad.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      padPointer = e.pointerId;
      try {
        pad.setPointerCapture(e.pointerId);
      } catch {
        /* synthetic pointer */
      }
      setDir(e.clientX);
    });
    pad.addEventListener("pointermove", (e) => {
      if (e.pointerId === padPointer) setDir(e.clientX);
    });
    const release = (e: PointerEvent) => {
      if (e.pointerId !== padPointer) return;
      padPointer = null;
      setDir(null);
    };
    pad.addEventListener("pointerup", release);
    pad.addEventListener("pointercancel", release);
    pad.addEventListener("lostpointercapture", release as EventListener);
    pad.addEventListener("contextmenu", (e) => e.preventDefault());
    this.touchEl.append(pad);
    this.clearTouchVisuals = () => {
      padPointer = null;
      leftHalf.classList.remove("pressed");
      rightHalf.classList.remove("pressed");
      this.touchEl.querySelectorAll(".pressed").forEach((x) => x.classList.remove("pressed"));
    };
    mk("t-sprint", "RUN", "sprint", "Toggle sprint");
    mk("t-jump", "JUMP", "jump", "Jump");
    this.actBtn = mk("t-act", "E", "interact", "Interact");
    this.sniffBtn = mk("t-sniff", "SNIFF", "sniff", "Sniff");
    mk("t-bark", "BARK", "bark", "Bark");
  }

  private clearTouchVisuals: () => void = () => undefined;

  /** Releases every touch control (pause, blur, device change): nothing can stay stuck down. */
  clearTouch(): void {
    this.clearTouchVisuals();
    this.input.releaseAll();
  }

  setSniffAvailable(on: boolean): void {
    this.sniffBtn?.classList.toggle("hidden", !on);
  }

  private touchWanted(): boolean {
    const mode = this.settings.touchControls;
    if (mode === "on") return true;
    if (mode === "off") return false;
    return window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window;
  }

  /** Full-screen menus (pause, map, confirm, completion) hide the touch controls so they never cover a menu button. */
  setMenuOpen(on: boolean): void {
    this.touchEl.classList.toggle("menu-open", on);
  }

  private hudOn = false;
  updateTouchVisibility(hudOn = this.hudOn): void {
    this.hudOn = hudOn;
    const on = hudOn && this.touchWanted();
    this.touchEl.classList.toggle("hidden", !on);
    this.root.classList.toggle("touch-on", on);
  }
}
