import Phaser from "phaser";
import { registerAnimations, registerTextures } from "../art/registerTextures";

/** Generates all pixel art (no image downloads) and moves on to the title screen. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  create(): void {
    registerTextures(this);
    registerAnimations(this);
    const tiles = this.textures.get("tiles");
    tiles.add("surface", 0, 16, 0, 16, 16); // regolith, top exposed
    tiles.add("soil", 0, 0, 5 * 16, 16, 16); // regolith interior
    this.scene.start("title");
  }
}
