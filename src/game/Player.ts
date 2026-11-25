/**
 * Laika: Arcade body + sprite + animation state machine. Velocities come from the pure
 * movement controller (systems/movement.ts); Arcade Physics resolves tile collisions.
 */
import Phaser from "phaser";
import { ASSIST_TUNING, TUNING } from "../config/constants";
import type { InputFrame } from "../input/InputManager";
import { initialMoveState, stepMovement, type MoveEvent, type MoveState } from "../systems/movement";
import { DEPTH } from "./WorldView";

/** Hitbox (pixels) inside the 26 x 22 frame. Feet line up with the bottom of the paws. */
const BODY_W = 14;
const BODY_H = 15;
const BODY_OX = 6;
const BODY_OY = 6;

export type ActionAnim = "sniff" | "dig" | "interact" | "celebrate" | "sweep";

const ACTION_MS: Record<ActionAnim, number> = { sniff: 420, dig: 620, interact: 260, celebrate: 700, sweep: 560 };

export class Player {
  sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  move: MoveState = initialMoveState();
  private tex = "laika";
  private anim = "";
  private actionUntil = 0;
  private action: ActionAnim | null = null;
  private landUntil = 0;
  private idleSince = 0;
  private wagUntil = 0;
  private tiltUntil = 0;
  private sleeping = false;
  private carry: Phaser.GameObjects.Image;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private thrust: Phaser.GameObjects.Particles.ParticleEmitter;
  boots = false;
  assist = false;
  /** Called for footsteps, jumps, landings. */
  onSound: ((name: string, opts?: { pitch?: number; volume?: number }) => void) | null = null;
  private stepToggle = false;

  constructor(scene: Phaser.Scene, x: number, groundY: number) {
    this.sprite = scene.physics.add.sprite(x, groundY - 10, "laika", "idle0");
    this.sprite.setDepth(DEPTH.player);
    this.sprite.body.setSize(BODY_W, BODY_H, false);
    this.sprite.body.setOffset(BODY_OX, BODY_OY);
    this.sprite.body.setAllowGravity(false);
    this.sprite.body.setCollideWorldBounds(true);
    this.sprite.body.setMaxVelocity(400, 500);
    this.carry = scene.add.image(x, groundY, "icon_commsModule").setDepth(DEPTH.player + 1).setVisible(false);
    this.dust = scene.add.particles(0, 0, "px_dust", {
      speed: { min: 10, max: 40 },
      angle: { min: 200, max: 340 },
      lifespan: { min: 250, max: 500 },
      gravityY: 40,
      alpha: { start: 0.9, end: 0 },
      quantity: 1,
      emitting: false,
    });
    this.dust.setDepth(DEPTH.fx);
    this.thrust = scene.add.particles(0, 0, "px_thrust", {
      speed: { min: 20, max: 60 },
      angle: { min: 70, max: 110 },
      lifespan: 300,
      alpha: { start: 1, end: 0 },
      scale: { start: 1, end: 0.5 },
      emitting: false,
    });
    this.thrust.setDepth(DEPTH.fx);
    this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_a: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
      if ((this.anim === "walk" || this.anim === "run") && frame.index % 2 === 1) {
        this.stepToggle = !this.stepToggle;
        this.onSound?.("step", { pitch: this.stepToggle ? 1 : 0.85, volume: this.anim === "run" ? 1 : 0.7 });
        if (this.anim === "run" && Math.random() < 0.5) this.puff(1);
      }
    });
  }

  get x(): number {
    return this.sprite.x;
  }
  /** Y of Laika's feet. */
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
    return this.action !== null;
  }

  setBoots(on: boolean): void {
    this.boots = on;
    this.tex = on ? "laika_boots" : "laika";
    this.anim = "";
  }

  placeAt(x: number, groundY: number): void {
    // Frame centre is 11 px below the top; the body's bottom is 21 px below the top.
    this.sprite.body.reset(x, groundY - (BODY_OY + BODY_H - 11));
    this.move = initialMoveState();
    this.move.facing = this.sprite.flipX ? -1 : 1;
    this.action = null;
  }

  sleep(on: boolean): void {
    this.sleeping = on;
    this.anim = "";
  }

  /** Plays a short action animation and locks movement while it runs. */
  doAction(a: ActionAnim, now: number): void {
    this.action = a;
    this.actionUntil = now + ACTION_MS[a];
    this.play(a, true);
    if (a === "celebrate") this.wagUntil = now + ACTION_MS.celebrate + 1500;
  }

  wag(now: number, ms = 1500): void {
    this.wagUntil = now + ms;
  }

  /** Curious head tilt (used near unfamiliar objects). */
  tilt(now: number): void {
    if (this.tiltUntil < now) this.tiltUntil = now + 1100;
  }

  private play(name: string, restart = false): void {
    if (this.anim === name && !restart) return;
    this.anim = name;
    this.sprite.anims.play(`${this.tex}_${name}`, true);
    if (restart) this.sprite.anims.restart();
  }

  private puff(n: number): void {
    this.dust.emitParticleAt(this.sprite.x, this.feetY - 1, n);
  }

  update(input: InputFrame, dtMs: number, now: number, locked: boolean, carrying: boolean): MoveEvent[] {
    const body = this.sprite.body;
    if (this.action && now >= this.actionUntil) this.action = null;
    const grounded = body.blocked.down || body.touching.down;
    const { state, events } = stepMovement(this.move, this.sleeping ? { left: false, right: false, jumpHeld: false, jumpPressed: false, sprint: false } : input, {
      grounded,
      ceiling: body.blocked.up,
      dtMs,
      tuning: this.assist ? ASSIST_TUNING : TUNING,
      airJumps: this.boots ? 1 : 0,
      locked: locked || this.action !== null || this.sleeping,
    });
    // Respect walls: if blocked horizontally, don't keep pushing velocity into them.
    if ((state.vx > 0 && body.blocked.right) || (state.vx < 0 && body.blocked.left)) state.vx = 0;
    this.move = state;
    body.setVelocity(state.vx, state.vy);

    for (const e of events) {
      if (e === "jump") {
        this.onSound?.("jump");
        this.puff(3);
      } else if (e === "airJump") {
        this.onSound?.("airJump");
        this.thrust.emitParticleAt(this.sprite.x, this.feetY, 10);
      } else if (e === "land") {
        this.landUntil = now + 110;
        this.onSound?.("land", { volume: 0.7 });
        this.puff(5);
      }
    }

    this.sprite.setFlipX(state.facing < 0);
    body.setOffset(BODY_OX, BODY_OY);

    // Animation state machine, by priority. Only switches when the state actually changes.
    const speed = Math.abs(state.vx);
    if (this.action) {
      // keep the action animation
    } else if (this.sleeping) {
      this.play("sleep");
    } else if (!grounded && !body.blocked.down) {
      this.play(state.vy < 0 ? "jump" : "fall");
    } else if (now < this.landUntil) {
      this.play("land");
    } else if (speed > TUNING.walkSpeed * 1.12) {
      this.play("run");
    } else if (speed > 6) {
      this.play("walk");
    } else if (now < this.tiltUntil) {
      this.play("tilt");
    } else if (now < this.wagUntil) {
      this.play("wag");
    } else {
      this.play("idle");
    }
    if (speed > 6 || !grounded) this.idleSince = now;

    // Carried item rides on her back and bobs with her steps.
    this.carry.setVisible(carrying && !this.sleeping);
    if (carrying) {
      const bob = this.anim === "walk" || this.anim === "run" ? (Math.floor(now / 110) % 2) : 0;
      this.carry.setPosition(Math.round(this.sprite.x - state.facing * 5), Math.round(this.sprite.y - 12 - bob));
    }
    return events;
  }

  idleFor(now: number): number {
    return now - this.idleSince;
  }
}
