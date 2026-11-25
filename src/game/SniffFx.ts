/**
 * Scanner visuals. A sniff starts a pulse; while TRACKING, the pulse pattern, a single direction
 * arrow and the HUD meter all describe the nearest hidden signal:
 *
 *   none    - one faint ring, no arrow
 *   weak    - one slow ring, one chevron arrow, slow blink
 *   strong  - double rings, a double chevron, fast blink
 *   located - quick triple rings and a sparkle column on the spot
 *
 * Shape, count and rhythm carry the meaning, never colour alone. Only the nearest signal gets an
 * arrow, so the screen is never flooded with indicators for far-away things.
 */
import Phaser from "phaser";
import { SNIFF_RADIUS } from "../config/constants";
import type { SignalLevel } from "../systems/sniff";
import { DEPTH } from "./WorldView";

const PERIOD: Record<SignalLevel, number> = { none: 99999, weak: 1200, strong: 700, located: 380 };
const RINGS: Record<SignalLevel, number> = { none: 1, weak: 1, strong: 2, located: 3 };

export class SniffFx {
  private ring: Phaser.GameObjects.Graphics;
  private arrows: Phaser.GameObjects.Image[];
  private pulses: Array<{ x: number; y: number; start: number; rings: number; dur: number }> = [];
  private lastPulse = 0;
  private sparkle: Phaser.GameObjects.Particles.ParticleEmitter;
  reducedMotion = false;

  constructor(scene: Phaser.Scene) {
    this.ring = scene.add.graphics().setDepth(DEPTH.fx);
    this.arrows = [0, 1].map(() => scene.add.image(0, 0, "arrow").setDepth(DEPTH.ui).setVisible(false));
    this.sparkle = scene.add.particles(0, 0, "px_white", {
      speedY: { min: -40, max: -15 },
      speedX: { min: -6, max: 6 },
      lifespan: 600,
      alpha: { start: 1, end: 0 },
      emitting: false,
    });
    this.sparkle.setDepth(DEPTH.fx);
  }

  /** The big pulse at the moment of sniffing. */
  burst(x: number, y: number, now: number): void {
    this.pulses.push({ x, y, start: now, rings: 2, dur: 650 });
    this.lastPulse = now;
  }

  /**
   * Draws tracking feedback for one frame.
   * `target` is the nearest hidden signal (world position) or null.
   */
  update(px: number, py: number, now: number, tracking: boolean, level: SignalLevel, target: { x: number; y: number } | null): void {
    this.ring.clear();
    if (tracking && level !== "none" && now - this.lastPulse > PERIOD[level]) {
      this.lastPulse = now;
      this.pulses.push({ x: px, y: py, start: now, rings: RINGS[level], dur: level === "located" ? 380 : 650 });
      if (level === "located" && target && !this.reducedMotion) this.sparkle.emitParticleAt(target.x + Phaser.Math.Between(-4, 4), target.y - 2, 3);
    }
    const maxR = this.reducedMotion ? SNIFF_RADIUS * 0.5 : SNIFF_RADIUS;
    this.pulses = this.pulses.filter((p) => {
      const t = (now - p.start) / p.dur;
      if (t > 1) return false;
      for (let i = 0; i < p.rings; i++) {
        const r = Math.round(maxR * Math.max(0, t - i * 0.12) * (p.rings > 1 ? 0.6 : 1));
        if (r <= 0) continue;
        this.ring.lineStyle(1, i === 0 ? 0xcfe0f7 : 0x5fb7f0, 0.8 * (1 - t));
        this.ring.strokeCircle(Math.round(p.x), Math.round(p.y), r);
      }
      return true;
    });
    // Direction arrow(s): one chevron for weak, two for strong, none once located (the spot sparkles).
    const show = tracking && target && (level === "weak" || level === "strong");
    const n = show ? (level === "strong" ? 2 : 1) : 0;
    const ang = target ? Math.atan2(target.y - 6 - py, target.x - px) : 0;
    const blink = level === "strong" ? 160 : 380;
    const visible = Math.floor(now / blink) % 2 === 0 || this.reducedMotion;
    this.arrows.forEach((a, i) => {
      if (i >= n) {
        a.setVisible(false);
        return;
      }
      const d = 20 + i * 6;
      a.setVisible(visible)
        .setPosition(Math.round(px + Math.cos(ang) * d), Math.round(py + Math.sin(ang) * d))
        .setRotation(ang);
    });
  }

  clear(): void {
    this.ring.clear();
    this.pulses = [];
    for (const a of this.arrows) a.setVisible(false);
  }
}
