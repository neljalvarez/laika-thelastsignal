/**
 * Custom side-scrolling camera (replaces Phaser's startFollow from Phase 1).
 *
 * - Horizontal: smooth, frame-rate-independent follow with a look-ahead that only builds up
 *   after Laika has moved the same way for a moment, so quick turns never snap the view.
 * - Vertical: "platform snapping" - the camera follows the ground Laika stands on, not every
 *   jump, and catches up quickly when she falls below the frame. Underground (tunnels, caves)
 *   it re-centres so low ceilings are not pushed to the edge of the screen.
 * - Framing: drifts gently towards the object Laika is about to use, and can briefly frame an
 *   important event (skipped with Reduced motion).
 * - Always clamped to the world, always on whole pixels.
 */
import type Phaser from "phaser";

export interface CameraSubject {
  x: number;
  feetY: number;
  vx: number;
  facing: 1 | -1;
  grounded: boolean;
}

export class CameraController {
  private cx = 0;
  private cy = 0;
  private lookX = 0;
  private anchorY = 0;
  private sameDirMs = 0;
  private lastFacing: 1 | -1 = 1;
  private focusPoint: { x: number; y: number; until: number } | null = null;
  reducedMotion = false;

  constructor(private cam: Phaser.Cameras.Scene2D.Camera) {}

  snapTo(x: number, feetY: number, offsetY = 36): void {
    this.cx = x;
    this.anchorY = feetY;
    this.cy = feetY - offsetY;
    this.lookX = 0;
    this.focusPoint = null;
    this.apply();
  }

  /** Briefly frames a point of interest (returns false when Reduced motion is on). */
  focus(x: number, y: number, ms: number, now: number): boolean {
    if (this.reducedMotion) return false;
    this.focusPoint = { x, y, until: now + ms };
    return true;
  }

  get focusing(): boolean {
    return this.focusPoint !== null;
  }

  update(dtMs: number, now: number, p: CameraSubject, opts: { underground: boolean; interestX: number | null }): void {
    const dt = Math.min(dtMs, 50) / 1000;
    const follow = (rate: number) => 1 - Math.exp(-rate * dt);
    if (this.focusPoint && now > this.focusPoint.until) this.focusPoint = null;

    // Look-ahead builds up only after moving the same way for 150 ms.
    if (p.facing === this.lastFacing && Math.abs(p.vx) > 40) this.sameDirMs += dtMs;
    else if (p.facing !== this.lastFacing) this.sameDirMs = 0;
    this.lastFacing = p.facing;
    const ahead = this.reducedMotion ? 18 : 44;
    const lookTarget = this.sameDirMs > 150 ? p.facing * ahead : this.lookX * 0.98;
    this.lookX += (lookTarget - this.lookX) * follow(2.4);

    // Vertical anchor: the ground Laika stands on, unless she falls below / climbs far above it.
    if (p.grounded) this.anchorY = p.feetY;
    else if (p.feetY > this.anchorY + 20) this.anchorY = p.feetY - 20;
    else if (p.feetY < this.anchorY - 72) this.anchorY = p.feetY + 72;
    const offsetY = opts.underground ? 12 : 36;

    let tx = p.x + this.lookX;
    let ty = this.anchorY - offsetY;
    if (opts.interestX !== null) tx += Math.max(-32, Math.min(32, (opts.interestX - p.x) * 0.3));
    let rateX = 5;
    let rateY = p.feetY > this.anchorY ? 9 : 4;
    if (this.focusPoint) {
      tx = this.focusPoint.x;
      ty = this.focusPoint.y;
      rateX = rateY = 3;
    }
    this.cx += (tx - this.cx) * follow(rateX);
    this.cy += (ty - this.cy) * follow(rateY);
    this.apply();
  }

  private apply(): void {
    const c = this.cam;
    const b = c.getBounds();
    const w = c.width;
    const h = c.height;
    const sx = Math.max(b.x, Math.min(b.x + b.width - w, this.cx - w / 2));
    const sy = Math.max(b.y, Math.min(b.y + b.height - h, this.cy - h / 2));
    c.setScroll(Math.round(sx), Math.round(sy));
  }
}
