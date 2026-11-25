/**
 * Adaptive hints. Escalate only on a meaningful lack of progress while the player is actively
 * playing, never while paused, in dialogue, in a menu, with the tab hidden, during a cutscene,
 * while standing still on purpose, or while exploring optional content.
 *
 *   level 1: highlight the relevant object      (after HINT_TIMES[0] of active play)
 *   level 2: show a short instruction            (HINT_TIMES[1])
 *   level 3: show a direction arrow to the target (HINT_TIMES[2])
 *
 * Hints never act for the player: they only change what is drawn.
 */
export const HINT_TIMES = [35_000, 60_000, 90_000] as const;

export type HintLevel = 0 | 1 | 2 | 3;

export interface HintState {
  progressKey: string;
  activeMs: number;
  level: HintLevel;
  /** Level requested with the Hint button (stays until progress is made). */
  manual: HintLevel;
}

export interface HintContext {
  enabled: boolean;
  /** Paused, dialogue, settings, cutscene or hidden tab. */
  blocked: boolean;
  /** The player gave input recently (standing still on purpose does not count). */
  active: boolean;
  /** In an optional area or chasing an optional item. */
  exploringOptional: boolean;
  /** Changes whenever the player makes progress (objective step, item, new area...). */
  progressKey: string;
}

export function createHints(progressKey = ""): HintState {
  return { progressKey, activeMs: 0, level: 0, manual: 0 };
}

export function updateHints(h: HintState, dtMs: number, ctx: HintContext): HintLevel {
  if (ctx.progressKey !== h.progressKey) {
    h.progressKey = ctx.progressKey;
    h.activeMs = 0;
    h.level = 0;
    h.manual = 0;
  }
  if (!ctx.blocked && ctx.active && !ctx.exploringOptional) h.activeMs += Math.min(dtMs, 100);
  const auto: HintLevel = !ctx.enabled ? 0 : h.activeMs >= HINT_TIMES[2] ? 3 : h.activeMs >= HINT_TIMES[1] ? 2 : h.activeMs >= HINT_TIMES[0] ? 1 : 0;
  h.level = Math.max(auto, h.manual) as HintLevel;
  return h.level;
}

/** The Hint button: show the next level right away (works even if automatic hints are off). */
export function requestHint(h: HintState): HintLevel {
  h.manual = Math.min(3, Math.max(h.level, h.manual) + 1) as HintLevel;
  h.level = Math.max(h.level, h.manual) as HintLevel;
  return h.level;
}

// ---------------------------------------------------------------------------
// Platforming struggle detection -> offer Easy Jumps (never forced, never shaming)
// ---------------------------------------------------------------------------

export interface StruggleState {
  jumps: Array<{ x: number; t: number }>;
  bestX: number;
  offered: boolean;
}

export const STRUGGLE_JUMPS = 4;
export const STRUGGLE_WINDOW_MS = 25_000;
export const STRUGGLE_RADIUS_PX = 56;

export function createStruggle(): StruggleState {
  return { jumps: [], bestX: -Infinity, offered: false };
}

/**
 * Records a jump. Returns true when the player has jumped several times in the same small area
 * recently without getting further: the moment to kindly offer an assist.
 */
export function recordJump(st: StruggleState, x: number, t: number, direction: 1 | -1): boolean {
  st.jumps = st.jumps.filter((j) => t - j.t < STRUGGLE_WINDOW_MS);
  st.jumps.push({ x, t });
  const progress = direction * x;
  if (progress > st.bestX + STRUGGLE_RADIUS_PX) {
    st.bestX = progress;
    st.jumps = [{ x, t }];
    return false;
  }
  const near = st.jumps.filter((j) => Math.abs(j.x - x) <= STRUGGLE_RADIUS_PX);
  if (!st.offered && near.length >= STRUGGLE_JUMPS) {
    st.offered = true;
    return true;
  }
  return false;
}
