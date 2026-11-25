/**
 * Visual representation of every world object (machines, pickups, buried spots, signs...).
 * syncFromState() makes the visuals match the simulation; event methods add the satisfying
 * one-off animations (power flowing down the cables, a module clicking into place...).
 */
import Phaser from "phaser";
import { INTERACT_RANGE, TILE } from "../config/constants";
import { OBJECTS, objectPos, type WorldObject } from "../data/world";
import { getInteraction, type Interaction, type InteractionContext } from "../systems/interactions";
import { isPowered, type GameState } from "../systems/state";
import { DEPTH } from "./WorldView";

interface View {
  o: WorldObject;
  sprite?: Phaser.GameObjects.Image;
  extra: Phaser.GameObjects.GameObject[];
  bob?: Phaser.Tweens.Tween;
}

/** Interaction reach per kind: big machines can be used from further away. */
const REACH: Partial<Record<WorldObject["kind"], number>> = {
  habitat: 44,
  receiver: 26,
  workstation: 26,
  solarPanel: 18,
  rover: 36,
  beacon: 22,
  stationDoor: 30,
  hatch: 22,
};

const LAMPS = [35, 57, 74, 82];
const CABLE_FROM = 37 * TILE + 8;
const CABLE_TO = 77 * TILE + 8;

export class ObjectsView {
  private views = new Map<string, View>();
  private marker: Phaser.GameObjects.Image;
  private markerTarget: string | null = null;
  private cableOn: Phaser.GameObjects.TileSprite;
  private lamps: Array<{ post: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image }> = [];
  private glows: Phaser.GameObjects.Image[] = [];
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private moundDust: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparkle: Phaser.GameObjects.Particles.ParticleEmitter;
  private dirt: Phaser.GameObjects.Particles.ParticleEmitter;
  private poweredShown = false;
  revealed = new Set<string>();

  constructor(private scene: Phaser.Scene) {
    const s = scene;
    this.marker = s.add.image(0, 0, "marker").setDepth(DEPTH.ui).setVisible(false);
    s.tweens.add({ targets: this.marker, y: "+=3", duration: 380, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    s.add.tileSprite(CABLE_FROM, 24 * TILE - 1, CABLE_TO - CABLE_FROM, 4, "cable_off").setOrigin(0, 1).setDepth(DEPTH.propsBack);
    this.cableOn = s.add.tileSprite(CABLE_FROM, 24 * TILE - 1, 0, 4, "cable_on").setOrigin(0, 1).setDepth(DEPTH.propsBack);
    this.sparks = s.add.particles(0, 0, "px_spark", {
      speed: { min: 20, max: 70 },
      angle: { min: 200, max: 340 },
      gravityY: 160,
      lifespan: 400,
      emitting: false,
    });
    this.sparks.setDepth(DEPTH.fx);
    this.moundDust = s.add.particles(0, 0, "px_dust", {
      speedY: { min: -12, max: -4 },
      speedX: { min: -3, max: 3 },
      lifespan: 1400,
      alpha: { start: 0.7, end: 0 },
      emitting: false,
    });
    this.moundDust.setDepth(DEPTH.fx);
    this.sparkle = s.add.particles(0, 0, "px_white", {
      speed: { min: 8, max: 30 },
      lifespan: 700,
      alpha: { start: 1, end: 0 },
      scale: { start: 1, end: 0 },
      emitting: false,
    });
    this.sparkle.setDepth(DEPTH.fx);
    this.dirt = s.add.particles(0, 0, "px_soil", {
      speed: { min: 40, max: 90 },
      angle: { min: 220, max: 320 },
      gravityY: 260,
      lifespan: 500,
      emitting: false,
    });
    this.dirt.setDepth(DEPTH.fx);
    for (const c of LAMPS) {
      const x = c * TILE + 8;
      const post = s.add.image(x, 24 * TILE, "lamp_off").setOrigin(0.5, 1).setDepth(DEPTH.propsBack);
      const glow = s.add.image(x, 24 * TILE - 29, "glow").setDepth(DEPTH.fx).setTint(0xffd27a).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
      this.lamps.push({ post, glow });
    }
    for (const o of OBJECTS) this.create(o);
    // Ambient: buried spots puff a little dust now and then (a subtle clue).
    s.time.addEvent({
      delay: 900,
      loop: true,
      callback: () => {
        for (const v of this.views.values()) {
          if (v.o.kind !== "buried" || !v.sprite?.visible) continue;
          if (Math.random() < 0.35) this.moundDust.emitParticleAt(v.sprite.x + Phaser.Math.Between(-5, 5), v.sprite.y - 4, 1);
        }
      },
    });
  }

  private create(o: WorldObject): void {
    const s = this.scene;
    const { x, y } = objectPos(o);
    const v: View = { o, extra: [] };
    const img = (key: string, depth = DEPTH.props) => s.add.image(x, y, key).setOrigin(0.5, 1).setDepth(depth);
    switch (o.kind) {
      case "checkpoint":
        v.sprite = img("checkpoint_off");
        // The ship itself is the first checkpoint: no beacon pole on Laika's bed.
        if (o.id === "cp_ship") v.sprite.setVisible(false);
        break;
      case "shipRadio":
        v.sprite = img("radio_on", DEPTH.propsBack);
        break;
      case "pickup":
        v.sprite = s.add.image(x, y - 7, `icon_${o.item}`).setDepth(DEPTH.pickups);
        v.bob = s.tweens.add({ targets: v.sprite, y: y - 10, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        break;
      case "buried":
        v.sprite = img("mound", DEPTH.propsBack);
        break;
      case "solarControl":
        v.sprite = img("solar_control_broken");
        break;
      case "solarPanel":
        v.sprite = img("panel_dusty");
        break;
      case "battery":
        v.sprite = img("battery_off");
        break;
      case "habitat":
        v.sprite = img("habitat_off", DEPTH.propsBack);
        for (const dx of [-33, 37]) {
          const g = s.add.image(x + dx, y - 27, "glow").setDepth(DEPTH.fx).setTint(0xffd27a).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
          this.glows.push(g);
        }
        break;
      case "receiver":
        v.sprite = img("receiver_off");
        v.extra.push(s.add.image(x - 6, y - 26, "receiver_module").setOrigin(0.5, 1).setDepth(DEPTH.props + 1).setVisible(false));
        v.extra.push(s.add.image(x + 8, y - 86, "glow").setDepth(DEPTH.fx).setTint(0xff6a5a).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD));
        break;
      case "workstation":
        v.sprite = img("workstation_off");
        break;
      case "sign":
        v.sprite = img(o.id === "sign_outpost" ? "sign_outpost" : "sign_canyon", DEPTH.propsBack);
        break;
      case "log":
        v.sprite = img("terminal_on", DEPTH.propsBack);
        break;
      case "rover":
        v.sprite = img("rover", DEPTH.propsBack);
        v.sprite.setY(y + 1);
        break;
      case "bridgeControl":
        v.sprite = img("bridge_control_off");
        break;
      case "beacon":
        v.sprite = img("beacon_off", DEPTH.propsBack);
        break;
      case "hatch":
      case "stationDoor":
      case "secret":
        break;
    }
    this.views.set(o.id, v);
  }

  /** Makes every visual match the saved state (used on load and after big changes). */
  syncFromState(st: GameState): void {
    const powered = isPowered(st);
    for (const v of this.views.values()) {
      const { o } = v;
      const tex = (k: string) => v.sprite?.setTexture(k);
      switch (o.kind) {
        case "checkpoint":
          tex(st.visitedCheckpoints.includes(o.id) ? "checkpoint_on" : "checkpoint_off");
          break;
        case "shipRadio":
          if (st.flags.checkedShipRadio) tex("radio_off");
          break;
        case "pickup":
        case "buried":
          if (st.collected.includes(o.id)) {
            v.sprite?.setVisible(false);
            v.bob?.stop();
          }
          break;
        case "solarControl":
          tex(st.flags.solarRepaired ? "solar_control_ok" : "solar_control_broken");
          break;
        case "solarPanel":
          tex(st.sweptPanels.includes(o.id) ? "panel_clean" : "panel_dusty");
          break;
        case "battery":
          tex(powered ? "battery_on" : "battery_off");
          break;
        case "habitat":
          tex(powered ? "habitat_on" : "habitat_off");
          break;
        case "receiver":
          tex(powered && st.flags.moduleInstalled ? "receiver_on" : "receiver_off");
          (v.extra[0] as Phaser.GameObjects.Image).setVisible(st.flags.moduleInstalled);
          break;
        case "workstation":
          tex(powered ? "workstation_on" : "workstation_off");
          break;
        case "bridgeControl":
          tex(st.flags.commsOnline ? "bridge_control_on" : "bridge_control_off");
          break;
        case "beacon":
          tex(st.flags.demoComplete ? "beacon_on" : "beacon_off");
          break;
        default:
          break;
      }
    }
    if (powered && !this.poweredShown) this.showPower(false);
    if (st.flags.commsOnline) this.startReceiverBlink();
  }

  // ---------------- targeting ----------------

  /** The best object for E right now, and what E would do. */
  findTarget(px: number, feetY: number, facing: number, st: GameState, ctx: InteractionContext): { o: WorldObject; i: Interaction } | null {
    let best: { o: WorldObject; i: Interaction; score: number } | null = null;
    for (const v of this.views.values()) {
      const { o } = v;
      if (o.kind === "pickup") continue; // pickups are collected by touch
      const p = objectPos(o);
      const reach = REACH[o.kind] ?? INTERACT_RANGE;
      const dx = p.x - px;
      if (Math.abs(dx) > reach || Math.abs(p.y - feetY) > 28) continue;
      const i = getInteraction(o, st, ctx);
      if (!i) continue;
      // Prefer close objects in front of Laika.
      const score = Math.abs(dx) - (Math.sign(dx) === facing ? 6 : 0);
      if (!best || score < best.score) best = { o, i, score };
    }
    return best ? { o: best.o, i: best.i } : null;
  }

  /** Pickups within touch range. */
  touchingPickups(px: number, cy: number, st: GameState): WorldObject[] {
    const out: WorldObject[] = [];
    for (const v of this.views.values()) {
      if (v.o.kind !== "pickup" || st.collected.includes(v.o.id) || !v.sprite) continue;
      if (Math.abs(v.sprite.x - px) < 13 && Math.abs(v.sprite.y - cy) < 16) out.push(v.o);
    }
    return out;
  }

  setMarker(id: string | null): void {
    if (id === this.markerTarget) return;
    this.markerTarget = id;
    if (!id) {
      this.marker.setVisible(false);
      return;
    }
    const v = this.views.get(id)!;
    const p = objectPos(v.o);
    const h = v.sprite ? v.sprite.displayHeight : 24;
    const top = v.o.kind === "buried" ? p.y - 14 : p.y - Math.min(h, 60) - 6;
    this.marker.setPosition(p.x, top).setVisible(true);
  }

  // ---------------- events ----------------

  /** Pickup / dig: the item pops out and flies to Laika. */
  collect(id: string, toX: number, toY: number, delayMs: number): void {
    const v = this.views.get(id);
    if (!v?.sprite) return;
    v.bob?.stop();
    const s = this.scene;
    const p = objectPos(v.o);
    const fly = s.add.image(p.x, p.y - 6, `icon_${v.o.item}`).setDepth(DEPTH.fx).setVisible(false);
    s.time.delayedCall(delayMs, () => {
      if (v.o.kind === "buried") {
        v.sprite?.setVisible(false);
        this.sparkle.emitParticleAt(p.x, p.y - 4, 8);
      } else {
        v.sprite?.setVisible(false);
      }
      fly.setVisible(true);
      s.tweens.add({
        targets: fly,
        y: p.y - 30,
        duration: 260,
        ease: "Quad.easeOut",
        onComplete: () =>
          s.tweens.add({ targets: fly, x: toX, y: toY, scale: 0.4, alpha: 0.3, duration: 260, ease: "Quad.easeIn", onComplete: () => fly.destroy() }),
      });
    });
  }

  reveal(id: string): boolean {
    const v = this.views.get(id);
    if (!v?.sprite || v.o.kind !== "buried" || this.revealed.has(id)) return false;
    this.revealed.add(id);
    v.sprite.setTexture("mound_revealed");
    this.sparkle.emitParticleAt(v.sprite.x, v.sprite.y - 6, 6);
    this.scene.tweens.add({ targets: v.sprite, scaleY: 1.4, duration: 120, yoyo: true });
    return true;
  }

  sparkleAt(x: number, y: number, n = 6): void {
    this.sparkle.emitParticleAt(x, y, n);
  }

  digDirt(x: number, y: number): void {
    this.dirt.emitParticleAt(x, y, 5);
  }

  setTexture(id: string, key: string, punch = true): void {
    const v = this.views.get(id);
    if (!v?.sprite) return;
    v.sprite.setTexture(key);
    if (punch) this.scene.tweens.add({ targets: v.sprite, scaleX: 1.06, scaleY: 0.94, duration: 90, yoyo: true });
  }

  sparksAt(id: string, n = 10): void {
    const v = this.views.get(id);
    if (!v?.sprite) return;
    this.sparks.emitParticleAt(v.sprite.x, v.sprite.y - v.sprite.height + 8, n);
  }

  panelDust(id: string): void {
    const v = this.views.get(id);
    if (!v?.sprite) return;
    this.moundDust.emitParticleAt(v.sprite.x, v.sprite.y - 18, 14);
    this.setTexture(id, "panel_clean");
    this.sparkle.emitParticleAt(v.sprite.x + 8, v.sprite.y - 22, 4);
  }

  showModule(): void {
    const v = this.views.get("receiver");
    const m = v?.extra[0] as Phaser.GameObjects.Image | undefined;
    if (!m) return;
    m.setVisible(true).setY(m.y - 10);
    this.scene.tweens.add({ targets: m, y: m.y + 10, duration: 220, ease: "Bounce.easeOut" });
  }

  /** Power flows from the solar array down the cable, lighting each machine in turn. */
  showPower(animated: boolean): void {
    this.poweredShown = true;
    const s = this.scene;
    const full = CABLE_TO - CABLE_FROM;
    const order: Array<[string, string, number]> = [
      ["battery", "battery_on", 53],
      ["habitat", "habitat_on", 61],
      ["workstation", "workstation_on", 77],
    ];
    const light = (key: string, tex: string) => this.setTexture(key, tex, animated);
    if (!animated) {
      this.cableOn.width = full;
      for (const [k, t] of order) light(k, t);
      for (const l of this.lamps) (l.post.setTexture("lamp_on"), l.glow.setAlpha(0.5));
      for (const g of this.glows) g.setAlpha(0.45);
      return;
    }
    s.tweens.addCounter({
      from: 0,
      to: full,
      duration: 1400,
      ease: "Sine.easeInOut",
      onUpdate: (tw) => {
        const w = tw.getValue() ?? 0;
        this.cableOn.width = w;
        const xNow = CABLE_FROM + w;
        for (const [k, t, col] of order) {
          const v = this.views.get(k);
          if (v?.sprite && v.sprite.texture.key !== t && xNow >= col * TILE) light(k, t);
        }
        for (const l of this.lamps) {
          if (l.post.texture.key !== "lamp_on" && xNow >= l.post.x) {
            l.post.setTexture("lamp_on");
            s.tweens.add({ targets: l.glow, alpha: 0.5, duration: 300 });
          }
        }
        if (xNow >= 61 * TILE) for (const g of this.glows) if (g.alpha === 0) s.tweens.add({ targets: g, alpha: 0.45, duration: 300 });
      },
    });
  }

  receiverOn(): void {
    this.setTexture("receiver", "receiver_on");
    this.startReceiverBlink();
  }

  private blinking = false;
  private startReceiverBlink(): void {
    if (this.blinking) return;
    this.blinking = true;
    const g = this.views.get("receiver")?.extra[1] as Phaser.GameObjects.Image | undefined;
    if (!g) return;
    g.setAlpha(0.7);
    this.scene.tweens.add({ targets: g, alpha: 0.1, duration: 600, yoyo: true, repeat: -1 });
  }

  positionOf(id: string): { x: number; y: number } {
    const v = this.views.get(id);
    return v ? objectPos(v.o) : { x: 0, y: 0 };
  }
}
