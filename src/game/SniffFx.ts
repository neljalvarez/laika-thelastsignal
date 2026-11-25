/**
 * Visual and audio feedback for the suit scanner: an expanding pulse ring, then pings and
 * direction arrows for every hidden thing the ring passes. Arrows blink faster when closer
 * (shape and speed, not colour, carry the meaning).
 */
import Phaser from "phaser";
import { SNIFF_RADIUS } from "../config/constants";
import type { Detection } from "../systems/sniff";
import { DEPTH } from "./WorldView";

interface ArrowState {
  img: Phaser.GameObjects.Image;
  tx: number;
  ty: number;
  until: number;
  strength: number;
}

export class SniffFx {
  private ring: Phaser.GameObjects.Graphics;
  private pulse: { x: number; y: number; start: number; pending: Detection[]; onReach: (d: Detection) => void } | null = null;
  private arrows: ArrowState[] = [];
  private readonly duration = 650;

  constructor(private scene: Phaser.Scene) {
    this.ring = scene.add.graphics().setDepth(DEPTH.fx);
  }

  start(x: number, y: number, detections: Detection[], targets: Map<string, { x: number; y: number }>, onReach: (d: Detection) => void, now: number): void {
    this.pulse = { x, y, start: now, pending: [...detections], onReach };
    this.targets = targets;
  }

  private targets = new Map<string, { x: number; y: number }>();

  private addArrow(d: Detection, now: number): void {
    const t = this.targets.get(d.id);
    if (!t) return;
    const img = this.scene.add.image(0, 0, "arrow").setDepth(DEPTH.ui);
    const blink = 140 + (1 - d.strength) * 420;
    this.scene.tweens.add({ targets: img, alpha: 0.25, duration: blink, yoyo: true, repeat: -1 });
    this.arrows.push({ img, tx: t.x, ty: t.y - 6, until: now + 2600, strength: d.strength });
  }

  update(px: number, py: number, now: number): void {
    this.ring.clear();
    const p = this.pulse;
    if (p) {
      const t = (now - p.start) / this.duration;
      const r = Math.round(SNIFF_RADIUS * Math.min(1, t));
      if (t <= 1) {
        const a = 1 - t;
        this.ring.lineStyle(1, 0xcfe0f7, 0.85 * a);
        this.ring.strokeCircle(Math.round(p.x), Math.round(p.y), r);
        this.ring.lineStyle(1, 0x5fb7f0, 0.5 * a);
        this.ring.strokeCircle(Math.round(p.x), Math.round(p.y), Math.max(0, r - 3));
      }
      p.pending = p.pending.filter((d) => {
        if (d.dist > r) return true;
        p.onReach(d);
        if (!d.revealed) this.addArrow(d, now);
        return false;
      });
      if (t > 1 && p.pending.length === 0) this.pulse = null;
    }
    this.arrows = this.arrows.filter((a) => {
      if (now > a.until) {
        a.img.destroy();
        return false;
      }
      const ang = Math.atan2(a.ty - py, a.tx - px);
      const dist = 20 + Math.round(a.strength * 4);
      a.img.setPosition(Math.round(px + Math.cos(ang) * dist), Math.round(py + Math.sin(ang) * dist)).setRotation(ang);
      return true;
    });
  }

  clear(): void {
    this.ring.clear();
    this.pulse = null;
    for (const a of this.arrows) a.img.destroy();
    this.arrows = [];
  }
}
