/** Generates every texture once at boot and registers it with Phaser. */
import Phaser from "phaser";
import { ITEM_ORDER } from "../data/items";
import { drawFar, drawMid, drawNear, drawSky } from "./backgrounds";
import { drawIcon } from "./icons";
import { LAIKA_ANIMS, LAIKA_H, LAIKA_W, laikaFrames } from "./laika";
import { LAIKA_PAL } from "./palette";
import { makeCanvas, Painter } from "./painter";
import { PROPS } from "./props";
import { drawDepthsBack, drawRidgeBack, REGION_PROPS } from "./regionProps";
import { drawTileset } from "./tiles";

function addCanvas(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement): Phaser.Textures.CanvasTexture | null {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  return scene.textures.addCanvas(key, canvas);
}

function laikaSheet(scene: Phaser.Scene, key: string, boots: boolean): void {
  const frames = laikaFrames(boots);
  const { canvas, ctx } = makeCanvas(LAIKA_W * frames.length, LAIKA_H);
  const p = new Painter(ctx);
  frames.forEach((f, i) => p.grid(f.grid, LAIKA_PAL, i * LAIKA_W, 0, false, (ch) => (ch === "G" ? 0.45 : 1)));
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
  for (const [key, def] of Object.entries({ ...PROPS, ...REGION_PROPS })) {
    const { canvas, ctx } = makeCanvas(def.w, def.h);
    def.draw(new Painter(ctx));
    addCanvas(scene, key, canvas);
  }
  for (const id of ITEM_ORDER) addCanvas(scene, `icon_${id}`, drawIcon(id, 1));
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
