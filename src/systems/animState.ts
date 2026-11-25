/**
 * Animation state selection, kept pure so transitions can be unit-tested.
 *
 * Priority: action (dig, sniff, repair...) > air (jump start, rise, apex, fall, air jump) >
 * landing > turning > locomotion (walk / trot / gallop by real speed) > idle personality.
 * Animations never delay control: the jump-start pose plays while Laika is already rising.
 */

export interface LocomotionInput {
  now: number;
  grounded: boolean;
  vx: number;
  vy: number;
  walkSpeed: number;
  landUntil: number;
  jumpStartUntil: number;
  turnUntil: number;
  airJumpUntil: number;
}

/** Returns a locomotion / air animation, or null when Laika is standing still on the ground. */
export function locomotionAnim(i: LocomotionInput): string | null {
  if (!i.grounded) {
    if (i.now < i.airJumpUntil) return "airJump";
    if (i.now < i.jumpStartUntil) return "jumpStart";
    if (i.vy < -70) return "rise";
    if (i.vy < 70) return "apex";
    return "fall";
  }
  if (i.now < i.landUntil) return "land";
  const speed = Math.abs(i.vx);
  if (i.now < i.turnUntil && speed > 20) return "turn";
  if (speed > i.walkSpeed * 1.12) return "run";
  if (speed > i.walkSpeed * 0.6) return "trot";
  if (speed > 6) return "walk";
  return null;
}

/** Playback speed so feet don't slide: proportional to the real speed for each gait. */
export function gaitTimeScale(anim: string, speed: number, walkSpeed: number): number {
  const nominal = anim === "run" ? walkSpeed * 1.56 : anim === "trot" ? walkSpeed : anim === "walk" ? walkSpeed * 0.45 : 0;
  if (!nominal) return 1;
  return Math.max(0.6, Math.min(1.5, speed / nominal));
}

// ---------------------------------------------------------------------------
// Idle personality
// ---------------------------------------------------------------------------

export const SIT_AFTER_MS = 9_000;
export const LIE_AFTER_MS = 22_000;
export const SLEEP_AFTER_MS = 38_000;
const CURIOUS_COOLDOWN = 7_000;
const EXCITED_COOLDOWN = 6_000;

export type Posture = "stand" | "sit" | "lie" | "sleep";

export interface IdleState {
  idleMs: number;
  posture: Posture;
  behavior: string | null;
  until: number;
  nextAt: number;
  lastCuriousAt: number;
  lastExcitedAt: number;
}

export interface IdleContext {
  /** Any movement or action this frame resets idling immediately. */
  moving: boolean;
  /** Standing next to equipment Laika has not used yet. */
  nearUnfamiliar: boolean;
  /** Standing next to a revealed collectible or a dig spot. */
  nearTreasure: boolean;
  /** Somewhere calm enough to sit down (on the ground, no dialogue). */
  safe: boolean;
}

export function createIdle(): IdleState {
  return { idleMs: 0, posture: "stand", behavior: null, until: 0, nextAt: 0, lastCuriousAt: -1e9, lastExcitedAt: -1e9 };
}

const MICRO: Array<[string, number, number]> = [
  // [animation, weight, duration ms]
  ["blink", 4, 150],
  ["earTwitch", 2, 320],
  ["wag", 2, 1100],
  ["lookBack", 2, 1300],
];

export function stepIdle(st: IdleState, dtMs: number, now: number, ctx: IdleContext, rand: () => number): string {
  if (ctx.moving) {
    st.idleMs = 0;
    st.posture = "stand";
    st.behavior = null;
    st.nextAt = now + 1800 + rand() * 1500;
    return "idle";
  }
  st.idleMs += dtMs;
  // Longer idling in a calm place: sit, lie down, and eventually nap.
  if (ctx.safe) {
    if (st.posture === "stand" && st.idleMs > SIT_AFTER_MS && !ctx.nearUnfamiliar) {
      st.posture = "sit";
      st.behavior = "sitDown";
      st.until = now + 260;
    } else if (st.posture === "sit" && st.idleMs > LIE_AFTER_MS) {
      st.posture = "lie";
      st.behavior = "lieDown";
      st.until = now + 340;
    } else if (st.posture === "lie" && st.idleMs > SLEEP_AFTER_MS) {
      st.posture = "sleep";
    }
  }
  if (st.behavior && now < st.until) return st.behavior;
  st.behavior = null;
  if (st.posture === "sit") return "sit";
  if (st.posture === "lie") return "lie";
  if (st.posture === "sleep") return "sleep";
  // Contextual curiosity (with cooldowns so it never becomes noisy).
  if (ctx.nearTreasure && now - st.lastExcitedAt > EXCITED_COOLDOWN) {
    st.lastExcitedAt = now;
    st.behavior = "wag";
    st.until = now + 1200;
    return "wag";
  }
  if (ctx.nearUnfamiliar && st.idleMs > 500 && now - st.lastCuriousAt > CURIOUS_COOLDOWN) {
    st.lastCuriousAt = now;
    st.behavior = rand() < 0.5 ? "tilt" : "alert";
    st.until = now + 1100;
    return st.behavior;
  }
  if (now >= st.nextAt) {
    const total = MICRO.reduce((a, m) => a + m[1], 0);
    let r = rand() * total;
    const pick = MICRO.find((m) => (r -= m[1]) < 0) ?? MICRO[0];
    st.behavior = pick[0];
    st.until = now + pick[2];
    st.nextAt = now + 2600 + rand() * 3200;
    return pick[0];
  }
  return "idle";
}
