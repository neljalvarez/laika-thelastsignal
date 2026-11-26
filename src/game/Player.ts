/**
 * Laika: Arcade body + sprite + animation state machine.
 * Velocities come from the pure movement controller (systems/movement.ts); Arcade Physics
 * resolves tile collisions; systems/animState.ts chooses animations. The hitbox never changes
 * with the pose.
 *
 * Phase 2 adds: gait-matched walk / trot / gallop with speed-scaled playback, jump anticipation
 * (shown while already rising, never delaying the jump), apex / fall / landing poses, turn skids,
 * idle personality (blink, ear twitch, look back, wag, sit, lie down, nap), curiosity near new
 * equipment, corner correction under ceilings and a small ledge assist for near-miss landings.
 */
import Phaser from "phaser";
import { ASSIST_TUNING, TUNING } from "../config/constants";
import type { InputFrame } from "../input/InputManager";
import { createIdle, gaitTimeScale, locomotionAnim, stepIdle, type IdleContext } from "../systems/animState";
import { initialMoveState, stepMovement, type MoveEvent, type MoveState } from "../systems/movement";
import { DEPTH } from "./WorldView";

/** Hitbox (pixels) inside the 26 x 22 frame. Feet line up with the bottom of the paws. */
const BODY_W = 14;
const BODY_H = 15;
const BODY_OX = 6;
const BODY_OY = 6;
/** Max sideways nudge when Laika's head clips a ceiling corner. */
const CORNER_NUDGE = 5;
/** Max step-up when Laika's feet just miss the top of a ledge. */
const LEDGE_ASSIST = 7;

export type ActionAnim = "sniff" | "dig" | "interact" | "repair" | "celebrate" | "sweep" | "bark";

const ACTION_MS: Record<ActionAnim, number> = { sniff: 450, dig: 620, interact: 250, repair: 500, celebrate: 560, sweep: 560, bark: 400 };

export interface PlayerContext {
  isSolid: (x: number, y: number) => boolean;
  idle: Omit<IdleContext, "moving">;
}

export class Player {
  sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  move: MoveState = initialMoveState();
  private tex = "laika";
  private anim = "";
  private actionUntil = 0;
  private action: ActionAnim | null = null;
  private scripted: { anim: string; until: number } | null = null;
  private landUntil = 0;
  private jumpStartUntil = 0;
  private turnUntil = 0;
  private airJumpUntil = 0;
  private idle = createIdle();
  private lastFallSpeed = 0;
  private carry: Phaser.GameObjects.Image;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private thrust: Phaser.GameObjects.Particles.ParticleEmitter;
  private glow: Phaser.GameObjects.Image;
  boots = false;
  /** Phase 4: air jumps allowed given how many were used this jump (suit energy decides). */
  airJumpLimit: ((used: number) => number) | null = null;
  assist = false;
  reducedMotion = false;
  onSound: ((name: string, opts?: { pitch?: number; volume?: number }) => void) | null = null;
  /** Called on each paw contact (footprints). */
  onStep: ((x: number, y: number, facing: 1 | -1) => void) | null = null;
  private stepToggle = false;

  constructor(scene: Phaser.Scene, x: number, groundY: number) {
    this.sprite = scene.physics.add.sprite(x, groundY - 10, "laika", "idle0");
    this.sprite.setDepth(DEPTH.player);
    this.sprite.body.setSize(BODY_W, BODY_H, false);
    this.sprite.body.setOffset(BODY_OX, BODY_OY);
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setCollideWorldBounds(true);
    this.sprite.body.setMaxVelocity(400, 520);
    this.carry = scene.add.image(x, groundY, "icon_commsModule").setDepth(DEPTH.player + 1).setVisible(false);
    this.glow = scene.add.image(x, groundY, "glow").setDepth(DEPTH.fx).setTint(0xffb060).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.dust = scene.add.particles(0, 0, "px_dust", {
      speed: { min: 10, max: 45 },
      angle: { min: 200, max: 340 },
      lifespan: { min: 250, max: 520 },
      gravityY: 40,
      alpha: { start: 0.9, end: 0 },
      emitting: false,
    });
    this.dust.setDepth(DEPTH.fx);
    this.thrust = scene.add.particles(0, 0, "px_thrust", {
      speed: { min: 25, max: 70 },
      angle: { min: 70, max: 110 },
      lifespan: 320,
      alpha: { start: 1, end: 0 },
      scale: { start: 1, end: 0.5 },
      emitting: false,
    });
    this.thrust.setDepth(DEPTH.fx);
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_a: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      // Paw contacts: twice per 6-frame cycle.
      if ((this.anim === "walk" || this.anim === "trot" || this.anim === "run") && (frame.index === 1 || frame.index === 4)) {
        this.stepToggle = !this.stepToggle;
        const run = this.anim === "run";
        this.onSound?.("step", { pitch: (this.stepToggle ? 1 : 0.86) * (0.95 + Math.random() * 0.1), volume: run ? 1 : this.anim === "trot" ? 0.75 : 0.5 });
        this.onStep?.(this.sprite.x - this.move.facing * 3, this.feetY, this.move.facing);
        if (run && !this.reducedMotion) this.puff(1, -this.move.facing);
      }
    });
  }

  get x(): number {
    return this.sprite.x;
  }
  get feetY(): number {
    return this.sprite.body.bottom;
  }
  get centerY(): number {
    return this.sprite.body.center.y;
  }
  get facing(): 1 | -1 {
    return this.move.facing;
  }
  get busy(): boolean {
    return this.action !== null || this.scripted !== null;
  }

  setBoots(on: boolean): void {
    this.boots = on;
    this.tex = on ? "laika_boots" : "laika";
    this.anim = "";
  }

  setCarry(icon: string | null): void {
    if (icon) this.carry.setTexture(icon);
    this.carry.setData("on", !!icon);
  }

  placeAt(x: number, groundY: number): void {
    // Frame centre is 11 px below the top; the body's bottom is 21 px below the top.
    this.sprite.body.reset(x, groundY - (BODY_OY + BODY_H - 11));
    this.move = initialMoveState();
    this.move.facing = this.sprite.flipX ? -1 : 1;
    this.action = null;
    this.idle = createIdle();
  }

  /** Turns Laika to face a direction (used to face a machine, or turn her tail to a panel). */
  face(dir: 1 | -1): void {
    this.move.facing = dir;
    this.sprite.setFlipX(dir < 0);
  }

  /** Plays a non-interactive animation (wake-up sequence). Movement is locked until it ends or is cleared. */
  playScripted(anim: string, ms: number, now: number): void {
    this.scripted = { anim, until: now + ms };
    this.play(anim, true);
  }

  clearScripted(): void {
    this.scripted = null;
  }

  get inScript(): boolean {
    return this.scripted !== null;
  }

  doAction(a: ActionAnim, now: number): void {
    this.action = a;
    this.actionUntil = now + ACTION_MS[a];
    this.play(a, true);
    this.idle = createIdle();
  }

  /** A short happy wag after a discovery (does not lock movement). */
  wag(now: number, ms = 1300): void {
    this.idle.behavior = "wag";
    this.idle.until = now + ms;
    this.idle.lastExcitedAt = now;
  }

  private play(name: string, restart = false): void {
    if (this.anim === name && !restart) return;
    this.anim = name;
    this.sprite.anims.play(`${this.tex}_${name}`, true);
    if (restart) this.sprite.anims.restart();
  }

  private puff(n: number, dir = 0): void {
    this.dust.emitParticleAt(this.sprite.x + dir * 4, this.feetY - 1, n);
  }

  /** Celeste-style corner correction: slide around a ceiling corner instead of bonking. */
  private cornerCorrect(ctx: PlayerContext): boolean {
    const b = this.sprite.body;
    const y = b.top - 2;
    const clear = (dx: number) => !ctx.isSolid(b.left + dx + 1, y) && !ctx.isSolid(b.right + dx - 1, y) && !ctx.isSolid(b.center.x + dx, y);
    const order = this.move.vx >= 0 ? [1, -1] : [-1, 1];
    for (let d = 1; d <= CORNER_NUDGE; d++) {
      for (const s of order) {
        if (clear(s * d)) {
          b.x += s * d;
          this.sprite.x += s * d;
          return true;
        }
      }
    }
    return false;
  }

  /** Forgiving landing: if the feet just miss the top of a ledge, step up onto it. */
  private ledgeAssist(ctx: PlayerContext, dir: number): void {
    const b = this.sprite.body;
    if (dir === 0 || this.move.vy < -30) return;
    const wallX = dir > 0 ? b.right + 1 : b.left - 1;
    const feet = b.bottom;
    if (!ctx.isSolid(wallX, feet - 1)) return;
    const tileTop = Math.floor((feet - 1) / 16) * 16;
    const lift = feet - tileTop;
    if (lift <= 0 || lift > LEDGE_ASSIST) return;
    // There must be room for Laika on top.
    if (ctx.isSolid(wallX, tileTop - 2) || ctx.isSolid(wallX, tileTop - BODY_H)) return;
    b.y -= lift;
    this.sprite.y -= lift;
    b.x += dir * 2;
    this.sprite.x += dir * 2;
    this.move.vy = 0;
  }

  update(input: InputFrame, dtMs: number, now: number, locked: boolean, ctx: PlayerContext): MoveEvent[] {
    const body = this.sprite.body;
    if (this.action && now >= this.actionUntil) this.action = null;
    if (this.scripted && now >= this.scripted.until) this.scripted = null;
    const grounded = body.blocked.down || body.touching.down;
    let ceiling = body.blocked.up;
    if (ceiling && this.move.vy < 0 && this.cornerCorrect(ctx)) ceiling = false;
    const dirInput = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (!grounded && (body.blocked.left || body.blocked.right) && !locked) this.ledgeAssist(ctx, dirInput);
    const wasFalling = this.move.vy;
    const { state, events } = stepMovement(this.move, input, {
      grounded,
      ceiling,
      dtMs,
      tuning: this.assist ? ASSIST_TUNING : TUNING,
      airJumps: !this.boots ? 0 : this.airJumpLimit ? this.airJumpLimit(this.move.airJumpsUsed) : 1,
      locked: locked || this.action !== null || this.scripted !== null,
    });
    if ((state.vx > 0 && body.blocked.right) || (state.vx < 0 && body.blocked.left)) state.vx = 0;
    this.move = state;
    body.setVelocity(state.vx, state.vy);
    if (!grounded) this.lastFallSpeed = Math.max(this.lastFallSpeed, wasFalling);

    for (const e of events) {
      if (e === "jump") {
        this.jumpStartUntil = now + 90;
        this.onSound?.("jump", { pitch: 0.95 + Math.random() * 0.1 });
        this.puff(3);
      } else if (e === "airJump") {
        this.airJumpUntil = now + 260;
        this.onSound?.("airJump");
        this.thrust.emitParticleAt(this.sprite.x, this.feetY, this.reducedMotion ? 4 : 12);
        // The second (boosted) air jump flashes cyan so it reads differently from the first.
        this.glow.setPosition(this.sprite.x, this.feetY).setAlpha(0.7).setScale(state.airJumpsUsed >= 2 ? 0.9 : 0.6).setTint(state.airJumpsUsed >= 2 ? 0x7de8ff : 0xffffff);
        this.sprite.scene.tweens.add({ targets: this.glow, alpha: 0, scale: 1, duration: 260 });
      } else if (e === "land") {
        const hard = this.lastFallSpeed > 220;
        this.landUntil = now + (hard ? 120 : 70);
        this.onSound?.("land", { volume: Math.min(1, 0.35 + this.lastFallSpeed / 450), pitch: hard ? 0.9 : 1.05 });
        this.puff(this.reducedMotion ? 2 : hard ? 7 : 3);
        this.lastFallSpeed = 0;
      } else if (e === "turn") {
        this.turnUntil = now + 110;
        if (!this.reducedMotion) this.puff(3, this.move.facing);
        this.onSound?.("skid");
      }
    }

    this.sprite.setFlipX(state.facing < 0);

    // Animation, by priority. Switches only when the state really changes (no flicker).
    const speed = Math.abs(state.vx);
    const moving = speed > 6 || !grounded || dirInput !== 0 || input.jumpHeld;
    if (this.action) {
      // the action animation keeps playing
    } else if (this.scripted) {
      // scripted animation keeps playing
    } else {
      const loco = locomotionAnim({
        now,
        grounded: grounded || body.blocked.down,
        vx: state.vx,
        vy: state.vy,
        walkSpeed: TUNING.walkSpeed,
        landUntil: this.landUntil,
        jumpStartUntil: this.jumpStartUntil,
        turnUntil: this.turnUntil,
        airJumpUntil: this.airJumpUntil,
      });
      if (loco) {
        stepIdle(this.idle, dtMs, now, { ...ctx.idle, moving: true }, Math.random);
        this.play(loco);
        this.sprite.anims.timeScale = gaitTimeScale(loco, speed, TUNING.walkSpeed);
      } else {
        const a = stepIdle(this.idle, dtMs, now, { ...ctx.idle, moving }, Math.random);
        this.play(a);
        this.sprite.anims.timeScale = 1;
      }
    }

    const carrying = !!this.carry.getData("on");
    this.carry.setVisible(carrying);
    if (carrying) {
      const bob = this.anim === "walk" || this.anim === "trot" || this.anim === "run" ? Math.floor(now / 110) % 2 : 0;
      this.carry.setPosition(Math.round(this.sprite.x - state.facing * 5), Math.round(this.sprite.y - 12 - bob));
    }
    return events;
  }

  get currentAnim(): string {
    return this.anim;
  }
}
