/** Base pixel resolution. Everything is drawn at this size and scaled up with nearest-neighbour filtering. */
export const VIEW_W = 480;
export const VIEW_H = 270;

/** World tiles are 16 x 16 pixels. */
export const TILE = 16;

/** Storage namespace. Deliberately different from the original game ("laika-mission-red-planet/*"). */
export const STORAGE_PREFIX = "laika-the-last-signal";
export const SAVE_KEY = `${STORAGE_PREFIX}/save`;
export const SAVE_BACKUP_KEY = `${STORAGE_PREFIX}/save-corrupt-backup`;
export const SETTINGS_KEY = `${STORAGE_PREFIX}/settings`;

/**
 * Movement tuning (pixels and seconds). Tuned for fun, not for real Martian gravity:
 * jumps are floaty and generous but the character still stops and turns quickly.
 */
export interface MoveTuning {
  walkSpeed: number;
  sprintSpeed: number;
  groundAccel: number;
  groundDecel: number;
  turnAccel: number;
  airAccel: number;
  airDecel: number;
  /** Reversing direction in mid-air (quick, but softer than on the ground). */
  airTurnAccel: number;
  gravity: number;
  fallGravityMult: number;
  maxFall: number;
  jumpVelocity: number;
  /** Velocity multiplier applied once when jump is released while rising. */
  jumpCutMult: number;
  doubleJumpVelocity: number;
  coyoteMs: number;
  bufferMs: number;
  /** Maximum fall speed while gliding (assist mode, jump held). 0 = no glide. */
  glideMaxFall: number;
  /** Near the top of a held jump (|vy| below this), gravity is reduced: a short Martian float. */
  apexHangSpeed: number;
  apexHangMult: number;
}

/**
 * Phase 2 tuning (see PHASE_2_HANDOFF.md for the reasoning):
 * - faster ground acceleration/deceleration: Laika starts and stops crisply instead of sliding;
 * - a dedicated mid-air turn rate: direction changes in the air feel controllable;
 * - a short "apex hang" at the top of a held jump: the Mars float, without a floaty rise;
 * - heavier falling: landings feel decisive. The full jump height is unchanged (~3.5 tiles)
 *   so no mission gate or level route changes.
 */
export const TUNING: MoveTuning = {
  walkSpeed: 100,
  sprintSpeed: 156,
  groundAccel: 1500,
  groundDecel: 1900,
  turnAccel: 2600,
  airAccel: 950,
  airDecel: 520,
  airTurnAccel: 1500,
  gravity: 640,
  fallGravityMult: 1.5,
  maxFall: 400,
  jumpVelocity: 268,
  jumpCutMult: 0.45,
  doubleJumpVelocity: 235,
  coyoteMs: 110,
  bufferMs: 140,
  glideMaxFall: 0,
  apexHangSpeed: 45,
  apexHangMult: 0.55,
};

/** "Easy jumps" assist: higher jumps, longer grace periods and a gentle glide while jump is held. */
export const ASSIST_TUNING: MoveTuning = {
  ...TUNING,
  jumpVelocity: 290,
  coyoteMs: 220,
  bufferMs: 260,
  glideMaxFall: 90,
  airAccel: 1100,
};

/** Interaction and sniff ranges in pixels. */
export const INTERACT_RANGE = 26;
export const SNIFF_RADIUS = 176;
export const SNIFF_REVEAL_RADIUS = 44;
export const SNIFF_COOLDOWN_MS = 700;
