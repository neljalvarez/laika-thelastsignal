import Phaser from "phaser";
import "./ui/ui.css";
import { setServices, svc } from "./app";
import { AudioManager } from "./audio/AudioManager";
import { VIEW_H, VIEW_W } from "./config/constants";
import { InputManager } from "./input/InputManager";
import { BootScene } from "./scenes/BootScene";
import { GameScene } from "./scenes/GameScene";
import { TitleScene } from "./scenes/TitleScene";
import { browserStore } from "./systems/save";
import { loadSettings } from "./systems/settings";
import { UI } from "./ui/UI";

const store = browserStore();
const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const settings = loadSettings(store, prefersReduced);
const audio = new AudioManager(settings);
const input = new InputManager(settings);
const uiRoot = document.getElementById("ui")!;
const ui = new UI(uiRoot, settings, input, {
  click: () => audio.sfx("click"),
  hover: () => audio.sfx("hover"),
  blip: () => audio.sfx("blip", { pitch: 0.85 + Math.random() * 0.4 }),
});
setServices({ store, settings, audio, input, ui, settingsListeners: new Set() });

// Audio may only start after the player interacts with the page.
const unlock = () => svc().audio.unlock();
for (const ev of ["pointerdown", "keydown", "touchstart"]) window.addEventListener(ev, unlock, { capture: true, passive: true });

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: VIEW_W,
  height: VIEW_H,
  backgroundColor: "#120a14",
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 }, debug: false, tileBias: 16 } },
  input: { keyboard: false, gamepad: false, touch: true, mouse: true },
  audio: { noAudio: true },
  fps: { target: 60, smoothStep: true },
  scene: [BootScene, TitleScene, GameScene],
});

/** Keeps the HTML overlay exactly on top of the letterboxed canvas and scales its text to fit. */
function fitUi(): void {
  const canvas = game.canvas;
  if (!canvas) return;
  const r = canvas.getBoundingClientRect();
  Object.assign(uiRoot.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  uiRoot.style.setProperty("--lb", `${Math.max(0, r.left)}px`);
  const fit = Math.max(0.72, Math.min(1.25, r.height / 540));
  ui.setFit(fit);
}
game.scale.on(Phaser.Scale.Events.RESIZE, fitUi);
window.addEventListener("resize", () => window.setTimeout(fitUi, 50));
game.events.once(Phaser.Core.Events.READY, fitUi);
window.setTimeout(fitUi, 200);

document.getElementById("rotate-hint")?.classList.add("enabled");

// No accidental browser zooming or scrolling during play (iOS pinch / double-tap).
document.addEventListener("gesturestart", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault(), { passive: false });
document.addEventListener("touchmove", (e) => {
  if (!(e.target as HTMLElement)?.closest?.("[data-menu]")) e.preventDefault();
}, { passive: false });
