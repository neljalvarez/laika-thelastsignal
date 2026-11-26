/**
 * Phase 5: notification priorities. Pure (no DOM): the UI asks `take()` what to show next.
 *
 * - One message at a time, two at most on screen (warnings can join a visible message).
 * - Identical text within a few seconds is dropped (no spam from repeated actions).
 * - Item pick-ups of the same kind merge ("+1 Metal", "+1 Metal" -> "+2 Metal").
 * - When the queue is busy, routine and info messages are dropped first; warnings and
 *   milestones are always kept.
 */
export type NoteKind = "warn" | "milestone" | "item" | "info";

export interface Note {
  text: string;
  kind: NoteKind;
  /** Item icon (pick-ups). */
  icon?: string;
  /** For merging pick-ups. */
  itemKey?: string;
  amount?: number;
}

const PRIORITY: Record<NoteKind, number> = { warn: 3, milestone: 2, item: 1, info: 0 };
export const NOTE_MS = 2400;
const DEDUPE_MS = 5000;
const MAX_QUEUE = 4;

export class NoteQueue {
  private queue: Note[] = [];
  private recent = new Map<string, number>();
  private showing: Array<{ note: Note; until: number }> = [];

  /** Adds a note. Returns false if it was dropped (duplicate or low priority while busy). */
  push(n: Note, now: number): boolean {
    const last = this.recent.get(n.text);
    if (last !== undefined && now - last < DEDUPE_MS && n.kind !== "milestone") return false;
    // Merge item pick-ups waiting in the queue.
    if (n.kind === "item" && n.itemKey) {
      const q = this.queue.find((x) => x.kind === "item" && x.itemKey === n.itemKey);
      if (q) {
        q.amount = (q.amount ?? 1) + (n.amount ?? 1);
        q.text = q.text.replace(/^\+\d+/, `+${q.amount}`);
        return true;
      }
    }
    this.queue.push({ ...n });
    this.queue.sort((a, b) => PRIORITY[b.kind] - PRIORITY[a.kind]);
    while (this.queue.length > MAX_QUEUE) {
      // Drop the least important (never a warning or milestone).
      const i = this.queue.map((x) => PRIORITY[x.kind]).lastIndexOf(Math.min(...this.queue.map((x) => PRIORITY[x.kind])));
      if (PRIORITY[this.queue[i].kind] >= PRIORITY.milestone) break;
      this.queue.splice(i, 1);
    }
    return true;
  }

  /** The note to show now, if any (called every frame or on a timer). */
  take(now: number): Note | null {
    this.showing = this.showing.filter((x) => x.until > now);
    if (!this.queue.length) return null;
    const next = this.queue[0];
    const busy = this.showing.length >= 2 || (this.showing.length >= 1 && next.kind !== "warn");
    if (busy) return null;
    this.queue.shift();
    this.showing.push({ note: next, until: now + NOTE_MS });
    this.recent.set(next.text, now);
    return next;
  }

  get pending(): number {
    return this.queue.length;
  }
}
