/**
 * Mission 00 overlay: one short instruction at a time, in the player's current control scheme,
 * with progress dots, a celebratory check when a stage is done, an always-visible Skip button,
 * kind assist offers, and the MISSION 00 COMPLETE -> MISSION 01 title cards.
 * No dialogue boxes to click through: the player learns by doing.
 */
import { TUTORIAL_STAGES, type PromptContext, type TutorialStageDef } from "../data/tutorial";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export class TutorialUI {
  private card: HTMLElement;
  private assist: HTMLElement;
  private cards: HTMLElement;
  private cardTimer: number | null = null;
  onSkip: (() => void) | null = null;

  constructor(root: HTMLElement) {
    this.card = el("div", "tut-card px-panel hidden interactive");
    this.card.setAttribute("aria-live", "polite");
    this.assist = el("div", "tut-assist px-panel hidden interactive");
    this.assist.setAttribute("role", "dialog");
    this.cards = el("div", "mission-card hidden");
    this.cards.setAttribute("aria-live", "assertive");
    root.append(this.card, this.assist, this.cards);
  }

  show(stage: TutorialStageDef, ctx: PromptContext, opts: { hint?: string; replay: boolean }): void {
    const c = this.card;
    c.classList.remove("hidden", "done");
    c.replaceChildren();
    const head = el("div", "tut-head");
    head.append(el("span", "tut-mission", opts.replay ? "MISSION 00 · PRACTICE" : "MISSION 00 · FIRST PAWPRINTS"));
    const skip = el("button", "tut-skip", opts.replay ? "End practice" : "Skip tutorial");
    skip.type = "button";
    skip.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onSkip?.();
    });
    head.append(skip);
    const dots = el("div", "tut-dots");
    const playable = TUTORIAL_STAGES.filter((s) => s.id !== "wake");
    const idx = playable.findIndex((s) => s.id === stage.id);
    playable.forEach((_s, i) => dots.append(el("span", i < idx ? "dot done" : i === idx ? "dot now" : "dot", i < idx ? "●" : i === idx ? "◆" : "○")));
    dots.setAttribute("aria-label", `Step ${Math.max(1, idx + 1)} of ${playable.length}`);
    c.append(head, el("div", "tut-title", stage.title), this.withKeys(stage.instruction(ctx)), dots);
    if (opts.hint) c.append(el("div", "tut-hint", opts.hint));
  }

  /** Puts the key names inside chips: "Hold Space to hop" -> Hold [Space] to hop. */
  private withKeys(text: string): HTMLElement {
    const line = el("div", "tut-text");
    // Chip anything in the form "Hold X", "press X", "(X)", or a single symbol like Ⓐ.
    const parts = text.split(/(Ⓐ|Ⓧ|Ⓨ|\([^)]+\)|press [^.!]+|Hold [^ ]+)/);
    for (const part of parts) {
      if (!part) continue;
      const m = /^(press |Hold )(.+)$/.exec(part);
      if (m && m[2].length <= 12) {
        line.append(document.createTextNode(m[1]), el("span", "key", m[2]));
      } else if (/^\(.+\)$/.test(part) && part.length <= 14) {
        line.append(el("span", "key", part.slice(1, -1)));
      } else if (/^[ⒶⓍⓎ]$/.test(part)) {
        line.append(el("span", "key", part));
      } else {
        line.append(document.createTextNode(part));
      }
    }
    return line;
  }

  /** A small celebratory check before the next instruction appears. */
  success(text = "Nice!"): void {
    this.card.classList.add("done");
    const t = this.card.querySelector(".tut-title");
    if (t) t.textContent = `✓ ${text}`;
  }

  hide(): void {
    this.card.classList.add("hidden");
    this.assist.classList.add("hidden");
  }

  /** Kind, optional assist offer (e.g. Easy Jumps). Never blocks play. */
  offerAssist(text: string, yes: string, onYes: () => void, onNo: () => void = () => undefined): void {
    const a = this.assist;
    a.replaceChildren(el("div", "", text));
    const row = el("div", "row-buttons");
    const y = el("button", "px-btn", yes);
    y.type = "button";
    y.addEventListener("click", (e) => {
      e.stopPropagation();
      a.classList.add("hidden");
      onYes();
    });
    const n = el("button", "px-btn secondary", "No thanks");
    n.type = "button";
    n.addEventListener("click", (e) => {
      e.stopPropagation();
      a.classList.add("hidden");
      onNo();
    });
    row.append(y, n);
    a.append(row);
    a.classList.remove("hidden");
    window.setTimeout(() => a.classList.add("hidden"), 14000);
  }

  /** Big centred title cards shown one after another (e.g. MISSION 00 COMPLETE, MISSION 01). */
  missionCards(seq: Array<{ small: string; big: string }>, msEach: number, onDone: () => void): void {
    if (this.cardTimer) window.clearTimeout(this.cardTimer);
    const c = this.cards;
    let i = 0;
    const next = () => {
      if (i >= seq.length) {
        c.classList.add("hidden");
        onDone();
        return;
      }
      const s = seq[i++];
      c.replaceChildren(el("small", "", s.small), el("div", "", s.big));
      c.classList.remove("hidden");
      this.cardTimer = window.setTimeout(next, msEach);
    };
    next();
  }
}
