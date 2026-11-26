/**
 * Phase 4: the outpost visibly changes as Laika restores it. This draws the decor that is not an
 * interactable: room signs and lights on the lower level, ceiling pipes and power cables that
 * show flow, the greenhouse dome on the surface (with the crop growing inside), the life-support
 * vent, the beacon mast, and the dust-haze tint during LIGHTS OUT. Only the surface map has a base.
 */
import Phaser from "phaser";
import { TILE } from "../config/constants";
import type { PowerStatus } from "../systems/engineering";
import type { GameState } from "../systems/state";
import { ROOMS, roomDarkness, surfaceLook, type Room } from "./facilityLook";
import { DEPTH } from "./WorldView";

const CEIL_Y = 26 * TILE; // top of the lower level's open space
const FLOOR_Y = 31 * TILE;

interface Segment {
  sprite: Phaser.GameObjects.TileSprite;
  on: (s: GameState, p: PowerStatus) => boolean;
  flow: number;
  onKey: string;
  offKey: string;
}

export class BaseView {
  private dims = new Map<Room["id"], Phaser.GameObjects.Rectangle>();
  private dimTarget = new Map<Room["id"], number>();
  private dimTween = new Map<Room["id"], Phaser.Tweens.Tween>();
  private lights = new Map<Room["id"], Phaser.GameObjects.Image>();
  private lamps = new Map<Room["id"], Phaser.GameObjects.Image>();
  private segments: Segment[] = [];
  private growLamp: Phaser.GameObjects.Image;
  private growGlow: Phaser.GameObjects.Image;
  private pot: Phaser.GameObjects.Image;
  private dome: Phaser.GameObjects.Image;
  private domePlants: Phaser.GameObjects.Image;
  private domeGlow: Phaser.GameObjects.Image;
  private vent: Phaser.GameObjects.Image;
  private mastLight: Phaser.GameObjects.Image;
  private haze: Phaser.GameObjects.Rectangle;
  private steamTimer: Phaser.Time.TimerEvent;
  private steamOn = false;
  private mastTween: Phaser.Tweens.Tween | null = null;
  private hazeTarget = 0;

  constructor(private scene: Phaser.Scene, private reducedMotion: () => boolean) {
    const s = scene;
    // ---- lower level: signs, lamps, status lights, dimming per room ----
    for (const r of ROOMS) {
      const x = r.signCol * TILE + 8;
      const sign = s.add.image(x, CEIL_Y + 10, r.sign).setOrigin(0.5, 0).setDepth(DEPTH.propsBack - 1);
      this.lamps.set(r.id, s.add.image((r.col0 + r.col1 + 1) * (TILE / 2), CEIL_Y + 1, "wall_lamp_off").setOrigin(0.5, 0).setDepth(DEPTH.propsBack));
      // The room's status light sits just right of its sign (a tick or a bar, not only a colour).
      this.lights.set(r.id, s.add.image(x + sign.width / 2 + 7, CEIL_Y + 13, "status_light_off").setOrigin(0.5, 0).setDepth(DEPTH.propsBack));
      const w = (r.col1 - r.col0 + 1) * TILE;
      this.dims.set(r.id, s.add.rectangle(r.col0 * TILE, CEIL_Y, w, FLOOR_Y - CEIL_Y, 0x05060d, 0.6).setOrigin(0, 0).setDepth(DEPTH.player - 1));
    }
    // Ceiling services: a power cable from the console, and a water pipe from the processor.
    const seg = (col0: number, col1: number, y: number, kind: "wire" | "pipe", on: Segment["on"], flow: number) => {
      const sprite = s.add.tileSprite(col0 * TILE, y, (col1 - col0 + 1) * TILE, kind === "pipe" ? 4 : 2, `${kind}_off`).setOrigin(0, 0).setDepth(DEPTH.propsBack - 1);
      this.segments.push({ sprite, on, flow, onKey: `${kind}_on`, offKey: `${kind}_off` });
    };
    seg(42, 49, CEIL_Y + 6, "wire", (st) => st.flags.batteryRestored && st.flags.shelterRestored, -1);
    seg(50, 65, CEIL_Y + 6, "wire", (st) => st.flags.batteryRestored, 1);
    seg(66, 72, CEIL_Y + 6, "wire", (st, p) => st.flags.recyclerPowered && p.powered.lifeSupport, 1);
    seg(73, 81, CEIL_Y + 6, "wire", (st, p) => st.flags.growPowered && p.powered.greenhouse, 1);
    seg(66, 87, CEIL_Y + 2, "pipe", (st, p) => st.flags.waterRestored && p.powered.water, -1);
    // Grow room lamp above the planter, and a water tank beside the processor.
    this.growLamp = s.add.image(77 * TILE + 8, CEIL_Y + 22, "grow_lamp_off").setOrigin(0.5, 0).setDepth(DEPTH.propsBack);
    this.growGlow = s.add.image(77 * TILE + 8, FLOOR_Y - 14, "glow").setDepth(DEPTH.fx).setTint(0xff8ad8).setScale(1.6, 0.8).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    s.add.image(87 * TILE + 6, FLOOR_Y, "water_tank").setOrigin(0.5, 1).setDepth(DEPTH.propsBack - 1);
    this.pot = s.add.image(62 * TILE + 10, FLOOR_Y, "pot_plant").setOrigin(0.5, 1).setDepth(DEPTH.propsBack).setVisible(false);

    // ---- surface: greenhouse dome over the grow room, vent and mast on the habitat roof ----
    const domeX = 73 * TILE + 8;
    // In front of the yard lamp that stands behind it, behind Laika.
    this.dome = s.add.image(domeX, 24 * TILE, "greenhouse_dome").setOrigin(0.5, 1).setDepth(DEPTH.props + 1).setVisible(false);
    this.domePlants = s.add.image(domeX, 24 * TILE, "dome_plants_1").setOrigin(0.5, 1).setDepth(DEPTH.props + 2).setVisible(false);
    this.domeGlow = s.add.image(domeX, 24 * TILE, "dome_glow").setOrigin(0.5, 1).setDepth(DEPTH.props + 3).setVisible(false);
    this.vent = s.add.image(61 * TILE + 34, 24 * TILE - 52, "vent_stack_off").setOrigin(0.5, 1).setDepth(DEPTH.propsBack - 2).setVisible(false);
    s.add.image(61 * TILE - 22, 24 * TILE - 56, "beacon_mast").setOrigin(0.5, 1).setDepth(DEPTH.propsBack - 2);
    this.mastLight = s.add.image(61 * TILE - 22, 24 * TILE - 93, "glow").setDepth(DEPTH.fx).setTint(0x7dffb0).setScale(0.45).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    // ---- the LIGHTS OUT dust haze: a warm tint over the whole view ----
    this.haze = s.add.rectangle(0, 0, s.scale.width, s.scale.height, 0xc8662e, 0).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.ui - 1);
    this.steamTimer = s.time.addEvent({ delay: 700, loop: true, callback: () => this.puff() });
  }

  /** Called every engine step and after any base change. */
  sync(st: GameState, p: PowerStatus): void {
    for (const r of ROOMS) {
      const d = roomDarkness(r.id, st, p);
      const dim = this.dims.get(r.id)!;
      const target = d * 0.62;
      if (this.dimTarget.get(r.id) !== target) {
        const first = !this.dimTarget.has(r.id);
        this.dimTarget.set(r.id, target);
        this.dimTween.get(r.id)?.stop();
        if (first || this.reducedMotion()) dim.setFillStyle(0x05060d, target);
        else this.dimTween.set(r.id, this.scene.tweens.addCounter({ from: dim.fillAlpha, to: target, duration: 700, onUpdate: (tw) => dim.setFillStyle(0x05060d, tw.getValue() ?? target) }));
      }
      const lit = d === 0;
      this.lamps.get(r.id)!.setTexture(lit ? "wall_lamp_on" : "wall_lamp_off");
      this.lights.get(r.id)!.setTexture(lit ? "status_light_on" : "status_light_off");
    }
    for (const sg of this.segments) {
      const on = sg.on(st, p);
      const key = on ? sg.onKey : sg.offKey;
      if (sg.sprite.texture.key !== key) sg.sprite.setTexture(key);
      sg.sprite.setData("flow", on && !this.reducedMotion() ? sg.flow : 0);
    }
    const look = surfaceLook(st, p);
    const growOn = look.domeGlow;
    this.growLamp.setTexture(growOn ? "grow_lamp_on" : "grow_lamp_off");
    this.growGlow.setAlpha(growOn ? 0.35 : 0);
    this.pot.setVisible(st.flags.cropHarvested);
    this.dome.setVisible(st.flags.growPowered || st.flags.seedsPlanted);
    this.domePlants.setVisible(this.dome.visible && look.domeStage > 0);
    if (look.domeStage > 0) this.domePlants.setTexture(`dome_plants_${look.domeStage}`);
    this.domeGlow.setVisible(this.dome.visible && growOn);
    this.vent.setVisible(look.vent).setTexture(look.ventSteam ? "vent_stack_on" : "vent_stack_off");
    this.steamOn = look.ventSteam;
    if (look.mastBlink && !this.mastTween) {
      this.mastLight.setAlpha(0.9);
      if (!this.reducedMotion()) this.mastTween = this.scene.tweens.add({ targets: this.mastLight, alpha: 0.15, duration: 900, yoyo: true, repeat: -1 });
      else this.mastTween = this.scene.tweens.add({ targets: this.mastLight, alpha: 0.9, duration: 1 });
    }
    this.hazeTarget = look.haze ? 1 : 0;
  }

  /** Per-frame: flowing pipes and the haze strength (stronger outside than below ground). */
  update(delta: number, underground: boolean): void {
    for (const sg of this.segments) {
      const flow = (sg.sprite.getData("flow") as number | undefined) ?? 0;
      if (flow) sg.sprite.tilePositionX -= (flow * delta) / 60;
    }
    const target = this.hazeTarget * (underground ? 0.08 : 0.2);
    const a = this.haze.fillAlpha;
    const next = this.reducedMotion() ? target : a + (target - a) * Math.min(1, delta / 400);
    if (Math.abs(next - a) > 0.001) this.haze.setFillStyle(0xc8662e, next);
  }

  private puff(): void {
    if (!this.steamOn || this.reducedMotion() || !this.vent.visible) return;
    const p = this.scene.add.image(this.vent.x, this.vent.y - 32, "glow").setDepth(DEPTH.propsBack - 3).setTint(0xe8eef5).setScale(0.25).setAlpha(0.5);
    this.scene.tweens.add({ targets: p, y: p.y - 22, x: p.x + 6, scale: 0.6, alpha: 0, duration: 1600, onComplete: () => p.destroy() });
  }

  destroy(): void {
    this.steamTimer.remove();
  }
}
