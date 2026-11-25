/** Title screen: a slowly scrolling Martian panorama with Laika trotting along, plus the DOM menu. */
import Phaser from "phaser";
import { svc, updateSettings } from "../app";
import { DEDICATION } from "../data/story";
import { hasSave, loadGame } from "../systems/save";
import { createNewState } from "../systems/state";
import type { GameSceneData } from "./GameScene";

export class TitleScene extends Phaser.Scene {
  private layers: Array<{ s: Phaser.GameObjects.TileSprite; f: number }> = [];
  private notice = "";

  constructor() {
    super("title");
  }

  create(): void {
    const { width, height } = this.scale;
    this.layers = [];
    const add = (key: string, f: number, y = 0) => {
      const s = this.add.tileSprite(0, y, width, height, key).setOrigin(0, 0);
      this.layers.push({ s, f });
    };
    add("bg_sky", 0.02);
    add("bg_far", 0.08, 8);
    add("bg_mid", 0.2, 18);
    add("bg_near", 0.45, 22);
    const groundY = height - 34;
    const surface = this.add.tileSprite(0, groundY, width, 16, "tiles", "surface").setOrigin(0, 0);
    const soil = this.add.tileSprite(0, groundY + 16, width, height - groundY - 16, "tiles", "soil").setOrigin(0, 0);
    this.layers.push({ s: surface, f: 1 }, { s: soil, f: 1 });
    const laika = this.add.sprite(Math.round(width * 0.68), groundY - 10, "laika", "idle0");
    laika.play("laika_walk");
    this.add.image(Math.round(width * 0.86), groundY + 1, "rock_l").setOrigin(0.5, 1);
    this.cameras.main.fadeIn(600, 0, 0, 0);

    const { audio, ui, input } = svc();
    audio.playMusic("title");
    audio.setAmbience("outside");
    ui.showHud(false);
    input.onPause = () => {
      if (ui.screenOpen) this.showMenu();
    };
    const load = loadGame(svc().store);
    if (load.status === "corrupt") this.notice = `${load.reason} A fresh start is ready.`;
    this.showMenu();
  }

  update(time: number): void {
    const t = time * 0.03;
    for (const l of this.layers) l.s.tilePositionX = Math.round(t * l.f);
  }

  private showMenu(): void {
    const { ui, store } = svc();
    ui.showTitle({
      canContinue: hasSave(store),
      notice: this.notice,
      onContinue: () => this.continueGame(),
      onNew: () => {
        if (hasSave(store)) {
          ui.confirm("Start a new game? Your saved progress will be replaced.", "New game", () => this.newGame(), () => this.showMenu());
        } else this.newGame();
      },
      onSettings: () => ui.showSettings(svc().settings, (s) => updateSettings(s), () => this.showMenu()),
      onReplayTutorial: this.replayAvailable() ? () => this.replayTutorial() : undefined,
      onCredits: () =>
        ui.showInfo(
          "About & Credits",
          [
            ...DEDICATION,
            "Design, code and pixel art: made for this project (art is generated in code from the original LAIKA palette and character design).",
            "Music: 'Against the Crimson Sky', 'Below the Red Horizon', 'Last Light On The Ridge' and 'Across the Crimson Sands', from the original LAIKA: Mission Red Planet project. Sound effects are synthesized in the browser.",
            "Font: Pixelify Sans (SIL Open Font License). Engine: Phaser 3 (MIT).",
            "Science notes are simplified. This project is not affiliated with or endorsed by NASA.",
          ],
          () => this.showMenu(),
        ),
      dedication: DEDICATION[DEDICATION.length - 1],
    });
  }

  private start(data: GameSceneData): void {
    const { ui } = svc();
    ui.closeScreen();
    this.notice = "";
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start("game", data));
  }

  /** Replay Mission 00 from an existing campaign (isolated practice; the campaign is untouched). */
  private replayAvailable(): boolean {
    const load = loadGame(svc().store);
    return load.status === "ok" && load.state.tutorial.status !== "active";
  }

  private replayTutorial(): void {
    const load = loadGame(svc().store);
    if (load.status === "ok") this.start({ state: load.state, isNew: false, replayTutorial: true });
  }

  private newGame(): void {
    this.start({ state: createNewState(), isNew: true });
  }

  private continueGame(): void {
    const load = loadGame(svc().store);
    if (load.status === "ok") this.start({ state: load.state, isNew: false });
    else {
      this.notice = load.status === "corrupt" ? `${load.reason} Starting fresh.` : "No save found.";
      this.showMenu();
    }
  }
}
