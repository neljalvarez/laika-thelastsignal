/** Generates every texture once at boot and registers it with Phaser. */
import Phaser from "phaser";
import { ITEM_ORDER } from "../data/items";
import { drawFar, drawMid, drawNear, drawSky } from "./backgrounds";
import { drawIcon } from "./icons";
import { LAIKA_ANIMS, LAIKA_H, LAIKA_W, laikaFrames, type LaikaGearLook } from "./laika";
import { LAIKA_PAL } from "./palette";
import { lookKey, type LaikaLook } from "../systems/crafting";
import { makeCanvas, Painter } from "./painter";
import { PROPS } from "./props";
import { drawDepthsBack, drawRidgeBack, REGION_PROPS } from "./regionProps";
import { BASE_PROPS } from "./baseProps";
import { drawTileset } from "./tiles";

function addCanvas(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): Phaser.Textures.CanvasTexture | null {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  return scene.textures.addCanvas(key, canvas);
}

function laikaSheet(scene: Phaser.Scene, key: string, boots: boolean | LaikaGearLook, pal: Record<string, string> = LAIKA_PAL): void {
  const frames = laikaFrames(boots);
  const { canvas, ctx } = makeCanvas(LAIKA_W * frames.length, LAIKA_H);
  const p = new Painter(ctx);
  frames.forEach((f, i) => p.grid(f.grid, pal, i * LAIKA_W, 0, false, (ch) => (ch === "G" ? 0.45 : 1)));
  const tex = addCanvas(scene, key, canvas);
  frames.forEach((f, i) => tex?.add(f.name, 0, i * LAIKA_W, 0, LAIKA_W, LAIKA_H));
}

export function registerTextures(scene: Phaser.Scene): void {
  addCanvas(scene, "tiles", drawTileset());
  addCanvas(scene, "bg_sky", drawSky());
  addCanvas(scene, "bg_far", drawFar());
  addCanvas(scene, "bg_mid", drawMid());
  addCanvas(scene, "bg_near", drawNear());
  laikaSheet(scene, "laika", false);
  laikaSheet(scene, "laika_boots", true);
  for (const layer of ["sky", "far", "mid", "near"] as const) {
    addCanvas(scene, `bgd_${layer}`, drawDepthsBack(layer));
    addCanvas(scene, `bgr_${layer}`, drawRidgeBack(layer));
  }
  for (const [key, def] of Object.entries({ ...PROPS, ...REGION_PROPS, ...BASE_PROPS })) {
    const { canvas, ctx } = makeCanvas(def.w, def.h);
    def.draw(new Painter(ctx));
    addCanvas(scene, key, canvas);
  }
  for (const id of ITEM_ORDER) addCanvas(scene, `icon_${id}`, drawIcon(id, 1));
}

/**
 * Phase 5: Laika's sheet for her current equipment and cosmetics, generated on first use and cached
 * (key from systems/crafting.lookKey). Returns the texture key to play animations from.
 */
export function ensureLaikaLook(scene: Phaser.Scene, look: LaikaLook): string {
  const key = lookKey(look);
  if (key === "laika" || key === "laika_b") return key === "laika" ? "laika" : "laika_boots";
  if (!scene.textures.exists(key)) {
    const pal: Record<string, string> = { ...LAIKA_PAL };
    if (look.wear.includes("stripe")) pal.H = "#f2ca76";
    if (look.wear.includes("trimBlue")) pal.R = "#4f8fe0";
    if (look.wear.includes("packCopper")) pal.Y = "#c87a3e";
    laikaSheet(scene, key, { boots: look.boots, booster: look.booster, reserve: look.reserve, lamp: look.lamp, efficient: look.efficient, patch: look.wear.includes("patch"), collarStar: look.wear.includes("collarStar") }, pal);
    animationsFor(scene, key);
  }
  return key;
}

function animationsFor(scene: Phaser.Scene, tex: string): void {
  for (const [name, a] of Object.entries(LAIKA_ANIMS)) {
    const k = `${tex}_${name}`;
    if (scene.anims.exists(k)) continue;
    scene.anims.create({ key: k, frames: a.frames.map((frame) => ({ key: tex, frame })), frameRate: a.fps, repeat: a.loop ? -1 : 0 });
  }
}

export function registerAnimations(scene: Phaser.Scene): void {
  for (const tex of ["laika", "laika_boots"]) {
    for (const [name, a] of Object.entries(LAIKA_ANIMS)) {
      const key = `${tex}_${name}`;
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: a.frames.map((frame) => ({ key: tex, frame })),
        frameRate: a.fps,
        repeat: a.loop ? -1 : 0,
      });
    }
  }
}
