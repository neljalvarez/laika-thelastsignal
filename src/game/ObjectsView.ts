/**
 * Visual representation of every world object (machines, pickups, buried spots, signs...).
 * syncFromState() makes the visuals match the simulation; event methods add the satisfying
 * one-off animations (power flowing down the cables, a module clicking into place...).
 */
import Phaser from "phaser";
import { INTERACT_RANGE, TILE } from "../config/constants";
import { connectionFor } from "../data/regions/registry";
import type { MapDef } from "../data/regions/types";
import { objectPos, type WorldObject } from "../data/world";
import type { Interaction } from "../systems/interactions";
import { relayOnline } from "../systems/puzzles";
import type { TutorialState } from "../systems/tutorial";
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
  transit: 26,
  sampler: 24,
  junction: 22,
  commsJunction: 24,
  relay: 24,
  towerConsole: 22,
  powerSource: 24,
};

/** Texture family for each transit object (+ "_on" / "_off"). */
const TRANSIT_TEX: Record<string, string> = {
  outpost_lift: "lift_top",
  depths_lift: "lift_car",
  station_lift: "freight_lift",
  depths_freight: "freight_lift",
  depths_north: "gate_panel",
  ridge_hatch: "ridge_hatch",
  ridge_cable: "cable_car",
  station_cable: "cable_dock",
};

/** Machines whose lights / glints catch the headlamp beam in dark maps. */
const GLINT_KINDS = new Set<WorldObject["kind"]>(["junction", "powerSource", "sampler", "lightSensor", "locker", "transit", "log", "sign"]);

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
  private highlightGlow: Phaser.GameObjects.Image;
  private highlightId: string | null = null;
  private fanTimer: Phaser.Time.TimerEvent | null = null;
  revealed = new Set<string>();
  /** Phase 3: powered cable runs, by power group. */
  private cables: Array<{ group: string; off: Phaser.GameObjects.TileSprite[]; on: Phaser.GameObjects.TileSprite[]; lengths: number[] }> = [];
  private groupsShown = new Set<string>();
  /** Points where machines catch the headlamp (for Lighting.addGlint). */
  glintPoints: Array<{ x: number; y: number }> = [];

  constructor(
    private scene: Phaser.Scene,
    private mapDef: MapDef,
  ) {
    const s = scene;
    this.marker = s.add.image(0, 0, "marker").setDepth(DEPTH.ui).setVisible(false);
    this.highlightGlow = s.add.image(0, 0, "glow").setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff1a0).setAlpha(0).setScale(1.4);
    s.tweens.add({ targets: this.marker, y: "+=3", duration: 380, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    const surface = mapDef.id === "surface";
    if (surface) s.add.tileSprite(CABLE_FROM, 24 * TILE - 1, CABLE_TO - CABLE_FROM, 4, "cable_off").setOrigin(0, 1).setDepth(DEPTH.propsBack);
    this.cableOn = s.add.tileSprite(CABLE_FROM, 24 * TILE - 1, 0, 4, "cable_on").setOrigin(0, 1).setDepth(DEPTH.propsBack).setVisible(surface);
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
    for (const c of surface ? LAMPS : []) {
      const x = c * TILE + 8;
      const post = s.add.image(x, 24 * TILE, "lamp_off").setOrigin(0.5, 1).setDepth(DEPTH.propsBack);
      const glow = s.add.image(x, 24 * TILE - 29, "glow").setDepth(DEPTH.fx).setTint(0xffd27a).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
      this.lamps.push({ post, glow });
    }
    for (const o of mapDef.objects) this.create(o);
    this.createCables();
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
        if (this.mapDef.id === "depths") v.sprite.setTint(0xa8c8ff); // frost-covered mound
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
        v.sprite = img(o.id === "sign_outpost" ? "sign_outpost" : o.id === "sign_service" ? "sign_service" : o.id === "sign_depths" ? "sign_lab" : o.id === "sign_ridge" ? "sign_relay" : "sign_canyon", DEPTH.propsBack);
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
      case "practiceConsole": {
        v.sprite = img("practice_console_off", DEPTH.propsBack);
        // Blinking indicator: the console asks to be noticed.
        const blinkGlow = s.add.image(x + 6, y - 27, "glow").setDepth(DEPTH.fx).setTint(0xff6a5a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.35);
        v.extra.push(blinkGlow);
        s.tweens.add({ targets: blinkGlow, alpha: 0.1, duration: 420, yoyo: true, repeat: -1 });
        break;
      }
      case "practiceBuried":
        v.sprite = img("mound", DEPTH.propsBack + 1);
        break;
      case "trainingMachine":
        v.sprite = img("training_machine_off", DEPTH.propsBack);
        break;
      case "echoSensor":
      case "acousticSensor":
        v.sprite = img("echo_sensor_idle", DEPTH.propsBack);
        break;
      // ---- Phase 3 ----
      case "transit":
        v.sprite = img(`${TRANSIT_TEX[o.id] ?? "gate_panel"}_off`, DEPTH.propsBack);
        break;
      case "headlampKit":
        v.sprite = img("lamp_kit_full", DEPTH.propsBack);
        break;
      case "lightSensor":
        v.sprite = img("light_sensor_off", DEPTH.propsBack);
        break;
      case "powerSource":
        v.sprite = img("battery_bank", DEPTH.propsBack);
        break;
      case "junction":
        v.sprite = img("junction_broken", DEPTH.propsBack);
        break;
      case "sampler":
        v.sprite = img("core_drill_off", DEPTH.propsBack);
        break;
      case "locker":
        v.sprite = img("locker_closed", DEPTH.propsBack);
        break;
      case "relay":
        v.sprite = img("relay_0", DEPTH.propsBack);
        v.extra.push(s.add.image(x + 9, y - 44, "relay_off").setDepth(DEPTH.props));
        v.extra.push(s.add.tileSprite(x, y - 27, 0, 2, "signal_dot").setOrigin(0, 0.5).setDepth(DEPTH.propsBack - 1).setVisible(false));
        break;
      case "commsJunction":
        v.sprite = img("ridge_junction_off", DEPTH.propsBack);
        break;
      case "towerConsole":
        v.sprite = img("tower_console_off", DEPTH.propsBack);
        break;
      case "hatch":
      case "stationDoor":
      case "secret":
        break;
    }
    if (this.mapDef.theme.dark && GLINT_KINDS.has(o.kind)) this.glintPoints.push({ x: x + 5, y: y - (v.sprite?.height ?? 16) + 4 });
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
          this.syncRegionObject(v, st);
          break;
      }
    }
    this.syncCables(st, false);
    if (powered && !this.poweredShown) this.showPower(false);
    if (st.flags.commsOnline) this.startReceiverBlink();
  }

  // ---------------- targeting ----------------

  /** The best object for E right now, and what E would do. */
  findTarget(px: number, feetY: number, facing: number, interactionFor: (o: WorldObject) => Interaction | null): { o: WorldObject; i: Interaction } | null {
    let best: { o: WorldObject; i: Interaction; score: number } | null = null;
    for (const v of this.views.values()) {
      const { o } = v;
      if (o.kind === "pickup") continue; // pickups are collected by touch
      const p = objectPos(o);
      const reach = REACH[o.kind] ?? INTERACT_RANGE;
      const dx = p.x - px;
      if (Math.abs(dx) > reach || Math.abs(p.y - feetY) > 28) continue;
      const i = interactionFor(o);
      if (!i) continue;
      // Prefer close objects in front of Laika.
      const score = Math.abs(dx) - (Math.sign(dx) === facing ? 6 : 0);
      if (!best || score < best.score) best = { o, i, score };
    }
    return best ? { o: best.o, i: best.i } : null;
  }

  /** Revealed dig spots or visible pickups close to Laika (for her excited wag). */
  nearTreasure(px: number, feetY: number): boolean {
    for (const v of this.views.values()) {
      if (!v.sprite?.visible) continue;
      const isTreasure = v.o.kind === "pickup" || ((v.o.kind === "buried" || v.o.kind === "practiceBuried") && this.revealed.has(v.o.id));
      if (isTreasure && Math.abs(v.sprite.x - px) < 40 && Math.abs(objectPos(v.o).y - feetY) < 30) return true;
    }
    return false;
  }

  /** Hint level 1: a soft pulsing glow (and the marker) on the object that matters right now. */
  highlight(id: string | null): void {
    if (id === this.highlightId) return;
    this.highlightId = id;
    this.scene.tweens.killTweensOf(this.highlightGlow);
    const v = id ? this.views.get(id) : undefined;
    if (!v) {
      this.highlightGlow.setAlpha(0);
      return;
    }
    const p = objectPos(v.o);
    const h = v.sprite ? Math.min(v.sprite.displayHeight, 60) : 20;
    this.highlightGlow.setPosition(p.x, p.y - h / 2).setAlpha(0.15);
    this.scene.tweens.add({ targets: this.highlightGlow, alpha: 0.55, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
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
    const fly = s.add.image(p.x, p.y - 6, `icon_${v.o.item ?? "electronics"}`).setDepth(DEPTH.fx).setVisible(false);
    s.time.delayedCall(delayMs, () => {
      if (v.o.kind === "buried" || v.o.kind === "practiceBuried") {
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
    if (!v?.sprite || (v.o.kind !== "buried" && v.o.kind !== "practiceBuried") || this.revealed.has(id)) return false;
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

  /** Tail sweep: the dust layer is brushed off in the tail's direction, revealing the clean panel. */
  panelDust(id: string, dir: 1 | -1, reduced: boolean): void {
    const v = this.views.get(id);
    if (!v?.sprite) return;
    const s = this.scene;
    const overlay = s.add.image(v.sprite.x, v.sprite.y, "panel_dusty").setOrigin(0.5, 1).setDepth(v.sprite.depth + 1);
    v.sprite.setTexture("panel_clean");
    if (reduced) {
      overlay.destroy();
    } else {
      s.tweens.add({ targets: overlay, alpha: 0, x: overlay.x + dir * 6, duration: 520, ease: "Quad.easeIn", onComplete: () => overlay.destroy() });
      for (let i = 0; i < 4; i++) s.time.delayedCall(i * 110, () => this.moundDust.emitParticleAt(v.sprite!.x + dir * (6 + i * 4), v.sprite!.y - 20 + i * 2, 5));
    }
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

  /** Makes the training-bay objects match the (isolated) tutorial state; null = campaign view. */
  syncPractice(t: TutorialState | null): void {
    const con = this.views.get("practice_console");
    const bur = this.views.get("practice_buried");
    const consoleOn = !t || t.facts.consoleUsed;
    con?.sprite?.setTexture(consoleOn ? "practice_console_on" : "practice_console_off");
    if (con) (con.extra[0] as Phaser.GameObjects.Image).setVisible(!consoleOn);
    if (bur?.sprite) {
      const hidden = !t || t.facts.collected;
      bur.sprite.setVisible(!hidden).setTexture(t?.facts.revealed ? "mound_revealed" : "mound");
      if (t && !t.facts.revealed) this.revealed.delete("practice_buried");
      if (t?.facts.revealed) this.revealed.add("practice_buried");
    }
    this.setFan(!t || t.facts.repaired);
  }

  consoleOn(): void {
    const con = this.views.get("practice_console");
    if (!con?.sprite) return;
    this.setTexture("practice_console", "practice_console_on");
    (con.extra[0] as Phaser.GameObjects.Image).setVisible(false);
    this.sparkle.emitParticleAt(con.sprite.x, con.sprite.y - 20, 6);
  }

  setFan(on: boolean): void {
    const fan = this.views.get("training_machine");
    if (!fan?.sprite) return;
    this.fanTimer?.remove();
    this.fanTimer = null;
    fan.sprite.setTexture(on ? "training_machine_on0" : "training_machine_off");
    if (on) {
      let f = 0;
      this.fanTimer = this.scene.time.addEvent({
        delay: 90,
        loop: true,
        callback: () => fan.sprite?.setTexture((f++ % 2) === 0 ? "training_machine_on1" : "training_machine_on0"),
      });
    }
  }

  repairBurst(id: string): void {
    const v = this.views.get(id);
    if (!v?.sprite) return;
    this.sparks.emitParticleAt(v.sprite.x, v.sprite.y - v.sprite.height / 2, 12);
    this.scene.tweens.add({ targets: v.sprite, scaleX: 1.08, scaleY: 0.93, duration: 90, yoyo: true, repeat: 1 });
  }

  /** The echo sensor answers a bark: cups spin, lights blink, and it "replies". */
  echo(id: string): void {
    const v = this.views.get(id);
    if (!v?.sprite) return;
    let f = 0;
    this.scene.time.addEvent({
      delay: 80,
      repeat: 22,
      callback: () => v.sprite?.setTexture(f++ >= 22 ? "echo_sensor_idle" : f % 2 ? "echo_sensor_on1" : "echo_sensor_on0"),
    });
    this.sparkle.emitParticleAt(v.sprite.x, v.sprite.y - 30, 6);
  }

  /** Barking near rover R-2 makes its camera mast perk up. */
  roverBeep(id: string): void {
    const v = this.views.get(id);
    if (!v?.sprite) return;
    this.scene.tweens.add({ targets: v.sprite, y: v.sprite.y - 2, duration: 80, yoyo: true, repeat: 2 });
    this.sparkle.emitParticleAt(v.sprite.x + 12, v.sprite.y - 34, 4);
  }

  positionOf(id: string): { x: number; y: number } {
    const v = this.views.get(id);
    return v ? objectPos(v.o) : { x: 0, y: 0 };
  }

  // ---------------- Phase 3 ----------------

  sparklesFor(id: string): void {
    const v = this.views.get(id);
    if (v?.sprite) this.sparkleAt(v.sprite.x, v.sprite.y - v.sprite.height + 8, 8);
  }

  /** Visual state of Phase 3 machines, derived from the save (cheap: call after every change). */
  private syncRegionObject(v: View, st: GameState): void {
    const { o } = v;
    const tex = (k: string) => {
      if (v.sprite && v.sprite.texture.key !== k) v.sprite.setTexture(k);
    };
    const circuit = st.flags.circuitRestored;
    switch (o.kind) {
      case "transit": {
        const info = connectionFor(o.id);
        const on = !!info && (info.c.open(st) || (info.c.activate?.side === info.side && info.c.activate.ready(st)));
        tex(`${TRANSIT_TEX[o.id] ?? "gate_panel"}_${on ? "on" : "off"}`);
        break;
      }
      case "headlampKit":
        tex(st.abilities.headlamp ? "lamp_kit_empty" : "lamp_kit_full");
        break;
      case "lightSensor":
        tex(st.flags.passageOpen ? "light_sensor_on" : "light_sensor_off");
        break;
      case "junction":
        tex(circuit ? "junction_fixed" : "junction_broken");
        break;
      case "sampler":
        tex(circuit ? "core_drill_on" : "core_drill_off");
        break;
      case "locker":
        tex(st.flags.lockerOpened ? "locker_open" : "locker_closed");
        break;
      case "relay": {
        const dusty = o.id === "relay_a" && !st.flags.relayASwept;
        const aim = st.puzzles.relayAim[o.id] ?? 0;
        tex(`relay_${dusty ? "dusty_" : ""}${aim}`);
        const ok = relayOnline(st, o.id);
        (v.extra[0] as Phaser.GameObjects.Image).setTexture(ok ? "relay_ok" : "relay_off");
        // Signal beam along the dish's direction once the relay reports in.
        const beam = v.extra[1] as Phaser.GameObjects.TileSprite;
        const angles = [180, 225, 270, 315, 0];
        beam.setVisible(ok && st.flags.cellInstalled).setAngle(angles[aim]).setSize(ok ? 46 : 0, 2);
        break;
      }
      case "commsJunction":
        tex(st.flags.cellInstalled ? "ridge_junction_on" : "ridge_junction_off");
        break;
      case "towerConsole":
        tex(st.flags.relayNetworkOnline ? "tower_console_on" : "tower_console_off");
        break;
      default:
        break;
    }
  }

  private createCables(): void {
    const s = this.scene;
    for (const run of this.mapDef.cables) {
      const entry = { group: run.group, off: [] as Phaser.GameObjects.TileSprite[], on: [] as Phaser.GameObjects.TileSprite[], lengths: [] as number[] };
      for (let i = 0; i < run.points.length - 1; i++) {
        const [c0, r0] = run.points[i];
        const [c1, r1] = run.points[i + 1];
        const x0 = Math.round(c0 * TILE);
        const y0 = Math.round(r0 * TILE);
        const len = Math.round(Math.hypot((c1 - c0) * TILE, (r1 - r0) * TILE));
        const angle = (Math.atan2(r1 - r0, c1 - c0) * 180) / Math.PI;
        const off = s.add.tileSprite(x0, y0, len, 4, "cable_off").setOrigin(0, 0.5).setAngle(angle).setDepth(DEPTH.propsBack - 1);
        const on = s.add.tileSprite(x0, y0, 0, 4, "cable_on").setOrigin(0, 0.5).setAngle(angle).setDepth(DEPTH.propsBack - 1);
        entry.off.push(off);
        entry.on.push(on);
        entry.lengths.push(len);
      }
      this.cables.push(entry);
    }
  }

  /** Power groups currently on, from the state. */
  static poweredGroups(st: GameState): Set<string> {
    const g = new Set<string>();
    if (st.flags.circuitRestored) g.add("circuit");
    if (st.flags.relayNetworkOnline) g.add("network");
    return g;
  }

  /** Shows powered cables; when animated, power visibly runs along each segment in order. */
  syncCables(st: GameState, animated: boolean): void {
    const on = ObjectsView.poweredGroups(st);
    for (const group of on) {
      if (this.groupsShown.has(group)) continue;
      this.groupsShown.add(group);
      let delay = 0;
      for (const run of this.cables.filter((c) => c.group === group)) {
        run.on.forEach((seg, i) => {
          const len = run.lengths[i];
          if (!animated) {
            seg.setSize(len, 4);
            return;
          }
          const dur = Math.max(120, len * 3);
          this.scene.tweens.addCounter({ from: 0, to: len, delay, duration: dur, onUpdate: (tw) => seg.setSize(Math.round(tw.getValue() ?? 0), 4) });
          delay += dur;
        });
      }
    }
  }
}
