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
}

export const TUNING: MoveTuning = {
  walkSpeed: 96,
  sprintSpeed: 150,
  groundAccel: 1000,
  groundDecel: 1300,
  turnAccel: 1900,
  airAccel: 760,
  airDecel: 420,
  gravity: 640,
  fallGravityMult: 1.35,
  maxFall: 380,
  jumpVelocity: 268,
  jumpCutMult: 0.45,
  doubleJumpVelocity: 235,
  coyoteMs: 110,
  bufferMs: 140,
  glideMaxFall: 0,
};

/** "Easy jumps" assist: higher jumps, longer grace periods and a gentle glide while jump is held. */
export const ASSIST_TUNING: MoveTuning = {
  ...TUNING,
  jumpVelocity: 290,
  coyoteMs: 220,
  bufferMs: 260,
  glideMaxFall: 90,
  airAccel: 900,
};

/** Interaction and sniff ranges in pixels. */
export const INTERACT_RANGE = 26;
export const SNIFF_RADIUS = 176;
export const SNIFF_REVEAL_RADIUS = 44;
export const SNIFF_COOLDOWN_MS = 700;
