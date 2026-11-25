/**
 * The adventure. Owns the simulation state and wires the pieces together:
 * input -> Player (movement) -> interactions (pure rules) -> effects (presentation) -> HUD.
 */
import Phaser from "phaser";
import { SNIFF_COOLDOWN_MS, TILE } from "../config/constants";
import { svc, updateSettings } from "../app";
import { ITEMS } from "../data/items";
import { TIPS, TRANSMISSIONS } from "../data/story";
import { BRIDGE_TILES, HATCH_TILES, OBJECTS, objectById, objectPos, REGIONS, SPAWN, STATION_DOOR_TILES, T, type WorldObject } from "../data/world";
import { ObjectsView } from "../game/ObjectsView";
import { Player } from "../game/Player";
import { SniffFx } from "../game/SniffFx";
import { WorldView } from "../game/WorldView";
import { costText, performInteraction, type Effect, type Interaction, type WorldEvent } from "../systems/interactions";
import { completionStats, getObjective } from "../systems/mission";
import { deleteSave, saveGame } from "../systems/save";
import { keyLabel, type Settings } from "../systems/settings";
import { sniff } from "../systems/sniff";
import { createNewState, isPowered, type GameState } from "../systems/state";
import { buildWorld } from "../systems/worldBuilder";

type MenuMode = "none" | "pause" | "settings" | "confirm" | "complete";

export interface GameSceneData {
  state: GameState;
  isNew: boolean;
}

export class GameScene extends Phaser.Scene {
  state!: GameState;
  private isNew = false;
  private world!: WorldView;
  private objects!: ObjectsView;
  player!: Player;
  private sniffFx!: SniffFx;
  private target: { o: WorldObject; i: Interaction } | null = null;
  private promptKey = "";
  private regionId = "";
  private regionsShown = new Set<string>();
  private ambienceKey = "";
  private objectiveKey = "";
  private objectiveStage = "";
  private stageSince = 0;
  private hintShownFor = "";
  private menu: MenuMode = "none";
  private lockedUntil = 0;
  private focusing = false;
  private pendingComplete = false;
  private lookX = 0;
  private lastSave = 0;
  private lastSniff = -9999;
  private stuckFrames = 0;
  private readFrom: { x: number; y: number } | null = null;
  private lastTiltAt = 0;
  private sniffOfflineToastAt = -99999;
  private settingsListener = (s: Settings) => this.onSettings(s);
  private visibilityListener = () => {
    if (document.hidden && this.menu === "none" && !svc().ui.transmissionOpen) this.openPause();
    if (document.hidden) this.save();
  };

  constructor() {
    super("game");
  }

  init(data: GameSceneData): void {
    this.state = data.state;
    this.isNew = data.isNew;
    this.menu = "none";
    this.pendingComplete = false;
    this.regionsShown.clear();
    this.regionId = "";
    this.ambienceKey = "";
    this.objectiveKey = "";
    this.target = null;
    this.promptKey = "#refresh";
  }

  create(): void {
    const { ui, audio, input, settings } = svc();
    const grid = buildWorld();
    this.world = new WorldView(this, grid);
    this.world.create({
      hatchOpen: this.state.flags.hatchOpen,
      bridge: this.state.flags.bridgeExtended,
      stationDoorOpen: this.state.flags.stationDoorOpen,
      reducedMotion: settings.reducedMotion,
    });
    this.world.onSecretEntered = (id) => this.onSecret(id);
    this.physics.world.setBounds(0, 0, this.world.widthPx, this.world.heightPx + 200);
    this.objects = new ObjectsView(this);
    this.objects.syncFromState(this.state);

    const spawn = this.spawnPoint();
    this.player = new Player(this, spawn.x, spawn.y);
    this.player.setBoots(this.state.abilities.thrusters);
    this.player.assist = settings.assistJumps;
    this.player.onSound = (name, opts) => audio.sfx(name, opts);
    this.physics.add.collider(this.player.sprite, this.world.fg);
    this.sniffFx = new SniffFx(this);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.world.widthPx, this.world.heightPx);
    cam.setRoundPixels(true);
    cam.startFollow(this.player.sprite, true, 0.12, 0.12);
    cam.setDeadzone(24, 36);
    cam.setFollowOffset(0, 34);
    cam.centerOn(spawn.x, spawn.y - 34);
    this.world.updateParallax(cam);

    ui.showHud(true);
    ui.setSniffAvailable(this.state.abilities.sniff);
    ui.onPauseButton = () => this.togglePause();
    ui.onHintButton = () => ui.toggleHint();
    input.onPause = () => this.togglePause();
    input.flush();
    svc().settingsListeners.add(this.settingsListener);
    document.addEventListener("visibilitychange", this.visibilityListener);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      svc().settingsListeners.delete(this.settingsListener);
      document.removeEventListener("visibilitychange", this.visibilityListener);
      ui.closeTransmission(false);
      ui.setPrompt(null);
      ui.hideRead();
    });
    audio.playMusic("game");
    this.refreshHud(true);
    this.stageSince = this.time.now;

    if (this.isNew) {
      this.player.sleep(true);
      cam.fadeIn(900, 0, 0, 0);
      this.lockedUntil = this.time.now + 1500;
      this.time.delayedCall(1300, () => {
        this.player.sleep(false);
        this.player.doAction("celebrate", this.time.now);
        audio.sfx("woof");
        this.openTransmission("wake", false);
      });
      this.save();
    } else {
      cam.fadeIn(400, 0, 0, 0);
      ui.toast("Welcome back, Laika!", "good");
    }

    // Debug / automated play-testing hooks (only with ?debug in the URL).
    if (new URLSearchParams(location.search).has("debug")) {
      (window as unknown as { __laika: unknown }).__laika = {
        scene: this,
        state: () => this.state,
        player: () => ({
          x: this.player.x,
          y: this.player.feetY,
          vx: this.player.move.vx,
          vy: this.player.move.vy,
          grounded: this.player.move.grounded,
          col: Math.floor(this.player.x / TILE),
          row: Math.floor((this.player.feetY - 1) / TILE),
        }),
        objective: () => getObjective(this.state),
        target: () => (this.target ? { id: this.target.o.id, verb: this.target.i.verb } : null),
        teleport: (col: number, row: number) => this.player.placeAt(col * TILE + 8, row * TILE),
        audio: () => ({ unlocked: svc().audio.unlocked, settings: svc().settings }),
      };
    }
  }

  private spawnPoint(): { x: number; y: number } {
    if (this.isNew) return { x: SPAWN.col * TILE + 8, y: SPAWN.row * TILE };
    const cp = objectById(this.state.checkpoint) ?? objectById("cp_ship")!;
    return objectPos(cp);
  }

  private onSettings(s: Settings): void {
    this.player.assist = s.assistJumps;
  }

  // ------------------------------------------------------------------
  // Main loop
  // ------------------------------------------------------------------

  update(time: number, delta: number): void {
    const { ui, input, settings } = svc();
    if (this.menu !== "none") return;
    const frame = input.poll();
    const blocking = ui.transmissionBlocking;
    if (blocking && (frame.interactPressed || frame.jumpPressed)) {
      ui.advanceTransmission();
      frame.interactPressed = false;
      frame.jumpPressed = false;
    }
    const locked = blocking || this.focusing || time < this.lockedUntil;
    this.state.playTimeMs += delta;

    const carrying = this.state.inventory.commsModule > 0 && !this.state.flags.moduleInstalled;
    this.player.update(frame, delta, time, locked, carrying);
    this.safety(time);

    // Pickups are collected by touch.
    for (const o of this.objects.touchingPickups(this.player.x, this.player.centerY, this.state)) {
      this.applyEffects(performInteraction(o, this.state, { revealed: this.objects.revealed }), o);
    }

    // Contextual interaction.
    const target = locked ? null : this.objects.findTarget(this.player.x, this.player.feetY, this.player.facing, this.state, { revealed: this.objects.revealed });
    this.target = target;
    const key = target ? `${target.o.id}|${target.i.verb}|${target.i.detail ?? ""}` : "";
    if (key !== this.promptKey) {
      this.promptKey = key;
      ui.setPrompt(target ? target.i : null);
      this.objects.setMarker(target?.o.id ?? null);
    }
    if (frame.interactPressed && !locked && !this.player.busy) {
      if (target) {
        const fx = performInteraction(target.o, this.state, { revealed: this.objects.revealed });
        this.applyEffects(fx, target.o);
        this.promptKey = "#refresh";
      } else if (ui.readOpen) {
        ui.hideRead();
      }
    }
    if (frame.sniffPressed && !locked && !this.player.busy) this.doSniff(time);

    this.checkpoints();
    this.regions();
    this.world.updateFades(this.player.x, this.player.feetY, settings.reducedMotion);
    this.sniffFx.update(this.player.x, this.player.centerY, time);
    this.cameraLook(delta, settings.reducedMotion);
    this.world.updateParallax(this.cameras.main);

    // Hide a sign / log card once Laika walks away from it.
    if (this.readFrom && ui.readOpen && Math.abs(this.player.x - this.readFrom.x) > 70) {
      ui.hideRead();
      this.readFrom = null;
    }
    // Personality: a curious head tilt near something she has not checked yet.
    if (target && !this.state.seen.includes(target.o.id) && this.player.idleFor(time) > 1200 && time - this.lastTiltAt > 4500) {
      this.lastTiltAt = time;
      this.player.tilt(time);
    }
    // Optional hints after a while on the same objective.
    if (settings.hints && this.hintShownFor !== this.objectiveStage && time - this.stageSince > 50000) {
      this.hintShownFor = this.objectiveStage;
      ui.toggleHint(true);
    }
    if (time - this.lastSave > 20000) this.save();
  }

  /** Never let Laika get stuck in terrain or fall out of the world. */
  private safety(_time: number): void {
    if (this.player.feetY > this.world.heightPx + 24) {
      this.respawn("Whoops! Back to the last checkpoint.");
      return;
    }
    if (this.world.isSolidPx(this.player.x, this.player.centerY)) {
      this.stuckFrames += 1;
      if (this.stuckFrames > 8) {
        this.player.placeAt(this.player.x, Math.floor(this.player.centerY / TILE) * TILE);
        this.stuckFrames = 0;
      }
    } else {
      this.stuckFrames = 0;
    }
  }

  private cameraLook(delta: number, reduced: boolean): void {
    if (this.focusing) return;
    const moving = Math.abs(this.player.move.vx) > 30;
    const target = moving ? -this.player.facing * (reduced ? 18 : 40) : this.lookX;
    this.lookX += (target - this.lookX) * Math.min(1, (delta / 1000) * 2.2);
    this.cameras.main.setFollowOffset(Math.round(this.lookX), 34);
  }

  // ------------------------------------------------------------------
  // Sniff
  // ------------------------------------------------------------------

  private doSniff(now: number): void {
    const { audio, ui, settings } = svc();
    if (!this.state.abilities.sniff) {
      if (now - this.sniffOfflineToastAt > 4000) {
        this.sniffOfflineToastAt = now;
        ui.toast("Scanner offline. Find the outpost's comms receiver first.", "warn");
        audio.sfx("error");
      }
      return;
    }
    if (now - this.lastSniff < SNIFF_COOLDOWN_MS) return;
    this.lastSniff = now;
    this.player.doAction("sniff", now);
    audio.sfx("sniff");
    this.time.delayedCall(200, () => audio.sfx("pulse"));
    const px = this.player.x;
    const py = this.player.feetY - 6;
    const found = sniff(px, py, OBJECTS, this.state);
    const targets = new Map<string, { x: number; y: number }>();
    for (const d of found) targets.set(d.id, objectPos(objectById(d.id)!));
    let revealedAny = false;
    this.sniffFx.start(
      px,
      py,
      found,
      targets,
      (d) => {
        audio.sfx("ping", { pitch: 0.7 + d.strength * 0.9, volume: 0.5 + d.strength * 0.5 });
        if (!d.revealed) return;
        if (d.kind === "buried" && this.objects.reveal(d.id)) {
          revealedAny = true;
          audio.sfx("reveal");
          if (!this.state.seen.includes("tip:firstReveal")) {
            this.state.seen.push("tip:firstReveal");
            ui.toast(`Something's buried here! Press ${keyLabel(settings.bindings.interact)} to dig.`, "good");
          }
        } else if (d.kind === "secret") {
          const p = targets.get(d.id)!;
          this.objects.sparkleAt(p.x - 8, p.y - 16, 10);
          ui.toast("The rock here smells... hollow?", "info");
        }
      },
      now,
    );
    this.time.delayedCall(700, () => {
      if (found.length === 0) ui.toast("Sniff... nothing nearby.");
      else if (!revealedAny && found.every((d) => !d.revealed)) {
        const n = found.length;
        ui.toast(`Sniff! ${n === 1 ? "Something" : `${n} things`} nearby. Follow the arrow${n === 1 ? "" : "s"}.`);
      }
      this.promptKey = "#refresh";
    });
  }

  // ------------------------------------------------------------------
  // Effects
  // ------------------------------------------------------------------

  private applyEffects(fx: Effect[], o: WorldObject): void {
    const { ui, audio } = svc();
    const now = this.time.now;
    const digging = fx.some((e) => e.type === "anim" && e.name === "dig");
    for (const e of fx) {
      switch (e.type) {
        case "toast":
          ui.toast(e.text, e.tone);
          break;
        case "item": {
          const delay = digging ? 430 : 0;
          this.objects.collect(e.objectId, this.player.x, this.player.centerY - 6, delay);
          this.time.delayedCall(delay + 60, () => {
            audio.sfx(e.item === "commsModule" || e.item === "treat" ? "collectBig" : "collect");
            ui.toast(`+${e.amount} ${ITEMS[e.item].name}. ${ITEMS[e.item].blurb}`, "good", e.item);
            this.player.wag(this.time.now);
            this.refreshHud();
          });
          break;
        }
        case "spend":
          ui.toast(`Used ${costText(e.cost)}`, "info");
          break;
        case "transmission":
          this.openTransmission(e.id, true);
          break;
        case "tip":
          ui.showTip(TIPS[e.key]);
          break;
        case "anim":
          this.player.doAction(e.name, now);
          if (e.name === "dig") {
            audio.sfx("dig");
            const p = objectPos(o);
            for (let i = 0; i < 4; i++) this.time.delayedCall(i * 100, () => this.objects.digDirt(p.x, p.y - 2));
          } else if (e.name === "interact") audio.sfx("mech");
          else if (e.name === "sweep") audio.sfx("sweep");
          else if (e.name === "celebrate") this.time.delayedCall(150, () => audio.sfx("woof"));
          break;
        case "sound":
          audio.sfx(e.name);
          break;
        case "world":
          this.worldEvent(e.event, e.objectId ?? o.id);
          break;
        case "focus":
          this.focusOn(e.objectId);
          break;
        case "read":
          ui.showRead(e.title, e.lines);
          this.readFrom = objectPos(o);
          audio.sfx("click");
          break;
        case "save":
          this.save();
          break;
      }
    }
    this.refreshHud();
  }

  private worldEvent(ev: WorldEvent, objectId: string): void {
    const { ui, audio, settings } = svc();
    switch (ev) {
      case "hatchOpen":
        this.world.setTiles(HATCH_TILES, T.Empty);
        audio.sfx("door");
        if (!settings.reducedMotion) this.cameras.main.shake(120, 0.002);
        this.objects.sparkleAt(23 * TILE + 8, 20 * TILE, 6);
        break;
      case "solarRepaired":
        this.objects.setTexture("solarControl", "solar_control_ok");
        this.objects.sparksAt("solarControl", 14);
        break;
      case "panelClean":
        this.objects.panelDust(objectId);
        break;
      case "powerOn":
        audio.sfx("power");
        this.objects.showPower(true);
        this.time.delayedCall(1400, () => this.syncReceiver());
        break;
      case "moduleInstalled":
        this.objects.showModule();
        this.objects.sparksAt("receiver", 10);
        this.syncReceiver();
        break;
      case "commsOnline":
        this.objects.receiverOn();
        this.objects.setTexture("bridgeControl", "bridge_control_on", false);
        break;
      case "bridgeExtend":
        this.extendBridge();
        break;
      case "stationDoorOpen":
        this.world.setTiles(STATION_DOOR_TILES, T.Empty);
        audio.sfx("door");
        break;
      case "thrusters":
        this.player.setBoots(true);
        this.objects.sparkleAt(this.player.x, this.player.feetY - 4, 14);
        break;
      case "demoComplete":
        this.pendingComplete = true;
        this.objects.setTexture("beacon", "beacon_on");
        break;
      case "sniffUnlocked":
        ui.setSniffAvailable(true);
        this.time.delayedCall(300, () => ui.toast(`Scanner unlocked! Press ${keyLabel(settings.bindings.sniff)} to sniff.`, "good"));
        break;
    }
  }

  private syncReceiver(): void {
    if (isPowered(this.state) && this.state.flags.moduleInstalled) this.objects.setTexture("receiver", "receiver_on");
  }

  private extendBridge(): void {
    const { audio, ui, settings } = svc();
    const cam = this.cameras.main;
    this.lockedUntil = this.time.now + 400 + BRIDGE_TILES.length * 110;
    const doTiles = () =>
      BRIDGE_TILES.forEach(([c, r], i) =>
        this.time.delayedCall(250 + i * 110, () => {
          this.world.setTiles([[c, r]], T.Bridge);
          audio.sfx("bridge", { pitch: 1 + i * 0.03 });
          this.objects.sparkleAt(c * TILE + 8, r * TILE, 2);
          if (i === BRIDGE_TILES.length - 1) {
            ui.toast("The bridge is out! The station is just across.", "good");
            audio.sfx("repair");
          }
        }),
      );
    if (settings.reducedMotion) {
      doTiles();
      return;
    }
    this.focusing = true;
    cam.stopFollow();
    cam.pan(206 * TILE, 22 * TILE, 600, "Sine.easeInOut");
    doTiles();
    this.time.delayedCall(450 + BRIDGE_TILES.length * 110 + 500, () => this.endFocus());
  }

  private focusOn(objectId: string): void {
    const { settings } = svc();
    if (settings.reducedMotion || this.focusing) return;
    const p = this.objects.positionOf(objectId);
    const cam = this.cameras.main;
    this.focusing = true;
    cam.stopFollow();
    cam.pan(p.x, p.y - 50, 700, "Sine.easeInOut");
    this.time.delayedCall(2100, () => this.endFocus());
  }

  private endFocus(): void {
    const cam = this.cameras.main;
    cam.pan(this.player.x, this.player.feetY - 34, 450, "Sine.easeInOut", false, (_c, progress) => {
      if (progress >= 1) {
        cam.startFollow(this.player.sprite, true, 0.12, 0.12);
        cam.setFollowOffset(Math.round(this.lookX), 34);
        this.focusing = false;
      }
    });
  }

  private openTransmission(id: string, blocking: boolean): void {
    const { ui, audio, input } = svc();
    const t = TRANSMISSIONS[id];
    if (!t) return;
    if (blocking) audio.duckMusic(true);
    if (t.lines.some((l) => l.static)) audio.sfx("static");
    ui.setPrompt(null);
    this.promptKey = "#refresh";
    ui.showTransmission(
      t,
      () => {
        audio.duckMusic(false);
        input.flush();
        this.lockedUntil = this.time.now + 150;
        if (this.pendingComplete) {
          this.pendingComplete = false;
          this.showCompletion();
        }
      },
      blocking,
    );
  }

  // ------------------------------------------------------------------
  // Checkpoints, regions, secrets
  // ------------------------------------------------------------------

  private checkpoints(): void {
    for (const o of OBJECTS) {
      if (o.kind !== "checkpoint" || this.state.checkpoint === o.id) continue;
      const p = objectPos(o);
      if (Math.abs(p.x - this.player.x) < 14 && Math.abs(p.y - this.player.feetY) < 20) {
        this.state.checkpoint = o.id;
        const first = !this.state.visitedCheckpoints.includes(o.id);
        if (first) this.state.visitedCheckpoints.push(o.id);
        this.objects.setTexture(o.id, "checkpoint_on");
        if (first) {
          svc().audio.sfx("checkpoint");
          svc().ui.toast(`Checkpoint: ${o.label ?? ""}`, "good");
          this.objects.sparkleAt(p.x, p.y - 26, 6);
        }
        this.save();
      }
    }
  }

  private regions(): void {
    const { ui, audio } = svc();
    const col = Math.floor(this.player.x / TILE);
    const region = REGIONS.find((r) => col >= r.x0 && col <= r.x1) ?? REGIONS[0];
    const inShip = this.world.isInside("ship", this.player.x, this.player.feetY);
    const inStation = this.world.isInside("station", this.player.x, this.player.feetY);
    if (region.id !== this.regionId) {
      this.regionId = region.id;
      if (!this.regionsShown.has(region.id) && !(region.id === "station" && !inStation)) {
        this.regionsShown.add(region.id);
        const idx = REGIONS.indexOf(region);
        ui.showRegion(region.name, `MISSION 01 · AREA ${String.fromCharCode(65 + idx)}`);
      }
      if (region.id === "outpost" && !this.state.flags.reachedOutpost) {
        this.state.flags.reachedOutpost = true;
        this.save();
      }
    }
    if (inStation && !this.regionsShown.has("station")) {
      this.regionsShown.add("station");
      ui.showRegion("Ares Research Station", "MISSION 01 · AREA D");
    }
    if (inStation && !this.state.flags.reachedStation) {
      this.state.flags.reachedStation = true;
      this.refreshHud();
      this.save();
    }
    const kind = inShip ? "ship" : inStation ? "station" : "outside";
    const nearOutpost = isPowered(this.state) && col >= 30 && col <= 85 ? 1 : 0;
    const k = `${kind}|${nearOutpost}`;
    if (k !== this.ambienceKey) {
      this.ambienceKey = k;
      audio.setAmbience(kind, nearOutpost);
    }
  }

  private onSecret(id: string): void {
    if (this.state.seen.includes(id)) return;
    this.state.seen.push(id);
    svc().audio.sfx("reveal");
    svc().ui.toast("You found a secret room!", "good");
    this.save();
  }

  // ------------------------------------------------------------------
  // HUD, saving, menus
  // ------------------------------------------------------------------

  private refreshHud(force = false): void {
    const { ui } = svc();
    const o = getObjective(this.state);
    const key = JSON.stringify(o.steps) + o.title;
    if (force || key !== this.objectiveKey) {
      this.objectiveKey = key;
      if (o.stage !== this.objectiveStage) {
        this.objectiveStage = o.stage;
        this.stageSince = this.time.now;
      }
      ui.setObjective(o);
    }
    ui.setInventory(this.state.inventory);
  }

  save(): void {
    this.lastSave = this.time.now;
    saveGame(svc().store, this.state);
  }

  private respawn(msg: string): void {
    const cp = objectById(this.state.checkpoint) ?? objectById("cp_ship")!;
    const p = objectPos(cp);
    this.player.placeAt(p.x, p.y);
    this.cameras.main.centerOn(p.x, p.y - 34);
    this.sniffFx.clear();
    svc().ui.toast(msg);
  }

  togglePause(): void {
    const { ui } = svc();
    if (!this.scene.isActive() && !this.scene.isPaused()) return;
    if (this.menu === "none") this.openPause();
    else if (this.menu === "pause") this.resume();
    else if (this.menu === "settings" || this.menu === "confirm") this.openPause();
    else if (this.menu === "complete") {
      ui.closeScreen();
      this.resume();
    }
  }

  private openPause(): void {
    const { ui } = svc();
    if (this.menu === "none") {
      this.save();
      this.scene.pause();
      this.physics.pause();
    }
    this.menu = "pause";
    svc().input.releaseAll();
    ui.showPause({
      onResume: () => this.resume(),
      onSettings: () => {
        this.menu = "settings";
        ui.showSettings(svc().settings, (s) => updateSettings(s), () => this.openPause());
      },
      onCheckpoint: () => {
        this.resume();
        this.respawn("Back at the last checkpoint.");
      },
      onRestart: () => {
        this.menu = "confirm";
        ui.confirm(
          "Restart the demo from the beginning? Your current progress will be erased.",
          "Restart",
          () => {
            deleteSave(svc().store);
            ui.closeScreen();
            this.menu = "none";
            this.scene.restart({ state: createNewState(), isNew: true } satisfies GameSceneData);
          },
          () => this.openPause(),
        );
      },
      onMenu: () => {
        this.save();
        ui.closeScreen();
        ui.showHud(false);
        this.menu = "none";
        this.scene.start("title");
      },
    });
  }

  private resume(): void {
    const { ui, input } = svc();
    ui.closeScreen();
    this.menu = "none";
    input.releaseAll();
    this.physics.resume();
    this.scene.resume();
  }

  private showCompletion(): void {
    const { ui, audio } = svc();
    audio.playMusic("ending");
    audio.sfx("complete");
    this.player.doAction("celebrate", this.time.now);
    this.save();
    this.time.delayedCall(900, () => {
      this.menu = "complete";
      this.scene.pause();
      this.physics.pause();
      ui.showComplete(
        completionStats(this.state),
        () => {
          ui.closeScreen();
          this.resume();
          ui.toast("Explore as long as you like. Thanks for playing!", "good");
        },
        () => {
          this.save();
          ui.closeScreen();
          ui.showHud(false);
          this.menu = "none";
          this.scene.start("title");
        },
      );
    });
  }
}
