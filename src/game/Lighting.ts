/**
 * Darkness and light for dark maps (Frozen Depths).
 *
 * One screen-sized RenderTexture is filled with darkness each frame and light "stamps" are erased
 * out of it: Laika's small aura, her headlamp beam (once she has the Headlamp) and every lamp that
 * is on. Stamps are banded, not smooth, to match the pixel art. Cost: one 480x270 fill plus a dozen
 * erases per frame, independent of map size; lamps off-screen are skipped.
 *
 * Readability rules (Phase 3 brief): the darkness is never total (paths and walls stay visible even
 * without the Headlamp), and "Brighter caves" in Settings lightens it further. Reflective survey
 * markings sit ABOVE the darkness and fade in only where the headlamp beam reaches them.
 */
import Phaser from "phaser";
import { TILE, VIEW_H, VIEW_W } from "../config/constants";
import type { LightSpot } from "../data/regions/types";
import { DEPTH } from "./WorldView";

export interface LightContext {
  x: number;
  y: number;
  facing: 1 | -1;
  headlamp: boolean;
  /** Power groups that are on (e.g. "circuit"). */
  groups: ReadonlySet<string>;
  bright: boolean;
  now: number;
  reducedMotion: boolean;
}

export const DARK_DEPTH = DEPTH.player + 2;

export class Lighting {
  private rt: Phaser.GameObjects.RenderTexture;
  private cone: Phaser.GameObjects.Image;
  private stamps: Record<"s" | "m" | "l", Phaser.GameObjects.Image>;
  private glows: Array<{ spot: LightSpot; img: Phaser.GameObjects.Image }> = [];
  reflective: Phaser.GameObjects.Image[] = [];
  /** Equipment glints: small highlights on machines that catch the headlamp beam. */
  private glints: Phaser.GameObjects.Image[] = [];

  constructor(
    private scene: Phaser.Scene,
    spots: LightSpot[],
  ) {
    const s = scene;
    this.rt = s.add.renderTexture(0, 0, VIEW_W, VIEW_H).setOrigin(0, 0).setScrollFactor(0).setDepth(DARK_DEPTH);
    this.cone = s.make.image({ key: "lamp_cone", add: false }).setOrigin(0, 0.5);
    this.stamps = {
      s: s.make.image({ key: "light_s", add: false }).setOrigin(0.5),
      m: s.make.image({ key: "light_m", add: false }).setOrigin(0.5),
      l: s.make.image({ key: "light_l", add: false }).setOrigin(0.5),
    };
    // Warm/cool glows drawn under the darkness so lit areas get a tint, not just "less dark".
    for (const spot of spots) {
      const img = s.add
        .image(spot.col * TILE + 8, spot.row * TILE + 8, "glow")
        .setDepth(DEPTH.propsBack)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(spot.warm ? 0xffc27a : 0xd8e8ff)
        .setScale(spot.radius / 22)
        .setAlpha(0);
      this.glows.push({ spot, img });
    }
  }

  addGlint(x: number, y: number): void {
    this.glints.push(this.scene.add.image(x, y, "px_white").setDepth(DARK_DEPTH + 1).setAlpha(0));
  }

  update(cam: Phaser.Cameras.Scene2D.Camera, ctx: LightContext): void {
    const rt = this.rt;
    const ambient = ctx.bright ? 0.45 : 0.72;
    rt.clear();
    rt.fill(0x05060f, ambient);
    const sx = (x: number) => Math.round(x - cam.scrollX);
    const sy = (y: number) => Math.round(y - cam.scrollY);

    // Laika's aura (always) and her headlamp.
    const px = sx(ctx.x);
    const py = sy(ctx.y - 10);
    this.erase(ctx.headlamp ? "m" : "s", px, py, 1);
    if (ctx.headlamp) {
      this.cone.setFlipX(ctx.facing < 0).setOrigin(ctx.facing < 0 ? 1 : 0, 0.5);
      rt.erase(this.cone, px + ctx.facing * 4, py - 2);
    }

    for (const g of this.glows) {
      const sp = g.spot;
      const on = !sp.group || ctx.groups.has(sp.group);
      let a = on ? 1 : 0;
      if (on && sp.flicker && !ctx.reducedMotion) a = Math.sin(ctx.now / 90) + Math.sin(ctx.now / 37) > 1.3 ? 0.35 : 1;
      g.img.setAlpha(on ? (sp.warm ? 0.22 : 0.1) * a : 0);
      if (!on) continue;
      const x = sx(sp.col * TILE + 8);
      const y = sy(sp.row * TILE + 8);
      if (x < -120 || x > VIEW_W + 120 || y < -120 || y > VIEW_H + 120) continue;
      this.erase(sp.radius >= 80 ? "l" : sp.radius >= 50 ? "m" : "s", x, y, a * Math.min(1, sp.radius / 60));
    }

    // Reflective markings and equipment glints only show inside the beam.
    for (const img of [...this.reflective, ...this.glints]) {
      img.setAlpha(ctx.headlamp ? this.beamStrength(ctx, img.x, img.y - 6) : 0);
    }
  }

  /** 0..1: how strongly the headlamp beam hits a world point. */
  beamStrength(ctx: LightContext, x: number, y: number): number {
    const dx = (x - ctx.x) * ctx.facing;
    const dy = y - (ctx.y - 12);
    if (dx < -8) return 0;
    const dist = Math.hypot(dx, dy);
    if (dist > 150) return 0;
    if (Math.abs(dy) > 10 + Math.max(0, dx) * 0.35) return 0;
    return dist < 100 ? 1 : 1 - (dist - 100) / 50;
  }

  private erase(size: "s" | "m" | "l", x: number, y: number, alpha: number): void {
    const img = this.stamps[size];
    img.setAlpha(alpha);
    this.rt.erase(img, x, y);
  }

  destroy(): void {
    this.rt.destroy();
    this.cone.destroy();
    for (const s of Object.values(this.stamps)) s.destroy();
  }
}
