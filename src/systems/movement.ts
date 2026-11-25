/**
 * Laika's movement rules, independent of Phaser so they can be unit-tested.
 * The physics engine owns positions and collisions; this decides velocities.
 *
 * Features: acceleration / deceleration, quick turn-around, variable jump height (release to
 * cut), coyote time, jump buffering, heavier fall for snappy arcs, optional double jump
 * (Thruster Boots) and an optional glide for the "Easy jumps" assist. Everything is scaled by
 * dt, so it behaves the same at any frame rate.
 */
import type { MoveTuning } from "../config/constants";

export interface MoveInput {
  left: boolean;
  right: boolean;
  jumpHeld: boolean;
  jumpPressed: boolean;
  sprint: boolean;
}

export interface MoveState {
  vx: number;
  vy: number;
  facing: 1 | -1;
  /** ms left in which a jump is still allowed after leaving the ground. */
  coyote: number;
  /** ms left in which a pressed jump will still trigger on landing. */
  buffer: number;
  /** True while rising from a jump whose height can still be cut. */
  rising: boolean;
  airJumpsUsed: number;
  grounded: boolean;
}

export interface MoveContext {
  grounded: boolean;
  /** Head hit a ceiling this frame. */
  ceiling: boolean;
  dtMs: number;
  tuning: MoveTuning;
  airJumps: number;
  /** Movement frozen (dialogue, digging...). Gravity still applies. */
  locked: boolean;
}

export type MoveEvent = "jump" | "airJump" | "land" | "leaveGround" | "turn";

export function initialMoveState(): MoveState {
  return { vx: 0, vy: 0, facing: 1, coyote: 0, buffer: 0, rising: false, airJumpsUsed: 0, grounded: true };
}

function approach(v: number, target: number, step: number): number {
  if (v < target) return Math.min(v + step, target);
  if (v > target) return Math.max(v - step, target);
  return v;
}

export function stepMovement(prev: MoveState, input: MoveInput, ctx: MoveContext): { state: MoveState; events: MoveEvent[] } {
  const t = ctx.tuning;
  const dt = Math.min(ctx.dtMs, 50) / 1000; // clamp huge frames (tab switches) to avoid tunnelling
  const s: MoveState = { ...prev };
  const events: MoveEvent[] = [];

  // Ground transitions.
  if (ctx.grounded && !prev.grounded) {
    events.push("land");
    s.airJumpsUsed = 0;
    s.rising = false;
  }
  if (!ctx.grounded && prev.grounded) events.push("leaveGround");
  s.grounded = ctx.grounded;
  if (ctx.grounded) {
    s.coyote = t.coyoteMs;
    if (s.vy > 0) s.vy = 0;
  } else {
    s.coyote = Math.max(0, s.coyote - ctx.dtMs);
  }

  // Horizontal.
  const dir = ctx.locked ? 0 : (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0 && dir !== s.facing) {
    if (ctx.grounded && Math.abs(s.vx) > t.walkSpeed * 0.6) events.push("turn");
    s.facing = dir as 1 | -1;
  }
  const maxSpeed = input.sprint ? t.sprintSpeed : t.walkSpeed;
  const target = dir * maxSpeed;
  let accel: number;
  if (dir === 0) accel = ctx.grounded ? t.groundDecel : t.airDecel;
  else if (Math.sign(s.vx) !== 0 && Math.sign(s.vx) !== dir) accel = ctx.grounded ? t.turnAccel : t.airTurnAccel;
  else accel = ctx.grounded ? t.groundAccel : t.airAccel;
  s.vx = approach(s.vx, target, accel * dt);

  // Jump buffering.
  if (input.jumpPressed && !ctx.locked) s.buffer = t.bufferMs;
  else s.buffer = Math.max(0, s.buffer - ctx.dtMs);

  if (s.buffer > 0 && !ctx.locked) {
    if (ctx.grounded || s.coyote > 0) {
      s.vy = -t.jumpVelocity;
      s.rising = true;
      s.coyote = 0;
      s.buffer = 0;
      s.grounded = false;
      events.push("jump");
    } else if (input.jumpPressed && s.airJumpsUsed < ctx.airJumps) {
      s.vy = -t.doubleJumpVelocity;
      s.rising = true;
      s.airJumpsUsed += 1;
      s.buffer = 0;
      events.push("airJump");
    }
  }

  // Variable jump height: releasing jump while rising cuts the jump short.
  if (s.rising && !input.jumpHeld && s.vy < 0) {
    s.vy *= t.jumpCutMult;
    s.rising = false;
  }
  if (s.vy >= 0) s.rising = false;
  if (ctx.ceiling && s.vy < 0) {
    s.vy = 0;
    s.rising = false;
  }

  // Gravity (heavier when falling), terminal velocity, optional glide. Gravity also applies on
  // the ground so the body keeps pressing into the floor and ground contact never flickers.
  let g = s.vy > 0 ? t.gravity * t.fallGravityMult : t.gravity;
  if (!s.grounded && input.jumpHeld && Math.abs(s.vy) < t.apexHangSpeed) g = t.gravity * t.apexHangMult;
  s.vy += g * dt;
  let maxFall = t.maxFall;
  if (t.glideMaxFall > 0 && input.jumpHeld && s.vy > 0 && !s.grounded) maxFall = t.glideMaxFall;
  if (s.vy > maxFall) s.vy = maxFall;
  return { state: s, events };
}

/** Peak jump height in pixels for a full (held) jump: v^2 / 2g. Used by tests and level validation. */
export function maxJumpHeight(t: MoveTuning): number {
  return (t.jumpVelocity * t.jumpVelocity) / (2 * t.gravity);
}
