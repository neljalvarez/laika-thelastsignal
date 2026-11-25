/**
 * The adventure. Owns the simulation state and wires the pieces together:
 * input -> Player (movement) -> interactions (pure rules) -> effects (presentation) -> HUD.
 *
 * Phase 2: Mission 00 (an isolated TutorialState on the ship's upper deck), the scanner's
 * tracking mode, adaptive hints, Bark, the custom camera and Laika's personality context.
 */
import Phaser from "phaser";
import { SNIFF_COOLDOWN_MS, SNIFF_RADIUS, SNIFF_REVEAL_RADIUS, TILE } from "../config/constants";
import { svc, updateSettings } from "../app";
import { ITEMS } from "../data/items";
import { TIPS, TRANSMISSIONS } from "../data/story";
import { stageDef, type PromptContext, type TutorialStageId } from "../data/tutorial";
import {
  BRIDGE_TILES,
  HATCH_TILES,
  OBJECTS,
  OPTIONAL_ZONES,
  objectById,
  objectPos,
  PRACTICE_IDS,
  REGIONS,
  SPAWN,
  STATION_DOOR_TILES,
  T,
  TUTORIAL_EXIT_ROW,
  TUTORIAL_SPAWN,
  type WorldObject,
} from "../data/world";
import { CameraController } from "../game/CameraController";
import { ObjectsView } from "../game/ObjectsView";
import { Player } from "../game/Player";
import { SniffFx } from "../game/SniffFx";
import { DEPTH, WorldView } from "../game/WorldView";
import { createHints, createStruggle, recordJump, requestHint, updateHints, type HintState, type StruggleState } from "../systems/hints";
import { barkEffects, costText, getInteraction, performInteraction, type Effect, type Interaction, type WorldEvent } from "../systems/interactions";
import { completionStats, getObjective } from "../systems/mission";
import { deleteSave, saveGame } from "../systems/save";
import { keyLabel, REMAPPABLE, type Action, type Settings } from "../systems/settings";
import { detect, signalLevel, sniffTargets, trend, type SignalLevel } from "../systems/sniff";
import { createNewState, isPowered, type GameState } from "../systems/state";
import { createTutorial, getPracticeInteraction, performPracticeInteraction, tutorialEvent, type TutorialState } from "../systems/tutorial";
import { buildWorld } from "../systems/worldBuilder";
import { TutorialUI } from "../ui/TutorialUI";

type MenuMode = "none" | "pause" | "settings" | "confirm" | "complete" | "controls";

export interface GameSceneData {
  state: GameState;
  isNew: boolean;
  /** Start a Mission 00 replay right away (from the title screen). */
  replayTutorial?: boolean;
}

let tutUI: TutorialUI | null = null;
function tutorialUI(): TutorialUI {
  if (!tutUI) tutUI = new TutorialUI(svc().ui.root);
  return tutUI;
}

const CRATE_LEFT_X = 11 * TILE;
const UPPER_DECK_FLOOR_Y = 14 * TILE;

export class GameScene extends Phaser.Scene {
  state!: GameState;
  private isNew = false;
  private replayOnStart = false;
  private world!: WorldView;
  private objects!: ObjectsView;
  player!: Player;
  private sniffFx!: SniffFx;
  private camCtl!: CameraController;
  private guide!: Phaser.GameObjects.Image;
  /** Mission 00 state (isolated from the campaign). null = playing the campaign. */
  tutorial: TutorialState | null = null;
  private tutorialReturn: { x: number; y: number } | null = null;
  private tutStageMs = 0;
  private tutHintShown = false;
  private jumpFromX: number | null = null;
  private wakeTimers: Phaser.Time.TimerEvent[] = [];
  private lastX = 0;
  private hints: HintState = createHints();
  private struggle: StruggleState = createStruggle();
  private tracking: { until: number; lastDist: number | null; lastTrendAt: number; trend: "warmer" | "colder" | "steady"; nextPing: number; found: boolean } | null = null;
  private target: { o: WorldObject; i: Interaction } | null = null;
  private promptKey = "";
  private regionId = "";
  private regionsShown = new Set<string>();
  private ambienceKey = "";
  private objectiveKey = "";
  private menu: MenuMode = "none";
  private lockedUntil = 0;
  private pendingComplete = false;
  private lastSave = 0;
  private lastSniff = -9999;
  private lastInputAt = 0;
  private stuckFrames = 0;
  private readFrom: { x: number; y: number } | null = null;
  private used = new Set<string>();
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
    this.replayOnStart = !!data.replayTutorial;
    this.menu = "none";
    this.pendingComplete = false;
    this.regionsShown.clear();
    this.regionId = "";
    this.ambienceKey = "";
    this.objectiveKey = "";
    this.target = null;
    this.promptKey = "";
    this.tutorial = null;
    this.tutorialReturn = null;
    this.tracking = null;
    this.hints = createHints();
    this.struggle = createStruggle();
    this.used.clear();
  }

  create(): void {
    const { ui, audio, input, settings } = svc();
    this.tutorial = this.state.tutorial.status === "active" ? createTutorial("first", this.state.tutorial.stage) : null;
    const grid = buildWorld();
    this.world = new WorldView(this, grid);
    this.world.create({
      hatchOpen: this.state.flags.hatchOpen,
      bridge: this.state.flags.bridgeExtended,
      stationDoorOpen: this.state.flags.stationDoorOpen,
      floorHatchOpen: !this.tutorial || this.tutorial.facts.repaired,
      reducedMotion: settings.reducedMotion,
    });
    this.world.onSecretEntered = (id) => this.onSecret(id);
    this.world.setUpperDeckLit(!this.tutorial || this.tutorial.facts.repaired, false);
    this.physics.world.setBounds(0, 0, this.world.widthPx, this.world.heightPx + 200);
    this.objects = new ObjectsView(this);
    this.objects.syncFromState(this.state);
    this.objects.syncPractice(this.tutorial);

    const spawn = this.spawnPoint();
    this.player = new Player(this, spawn.x, spawn.y);
    this.player.setBoots(this.state.abilities.thrusters);
    this.player.assist = settings.assistJumps;
    this.player.reducedMotion = settings.reducedMotion;
    this.player.onSound = (name, opts) => audio.sfx(name, opts);
    this.player.onStep = (x, y) => this.world.addFootprint(x, y);
    this.physics.add.collider(this.player.sprite, this.world.fg);
    this.sniffFx = new SniffFx(this);
    this.sniffFx.reducedMotion = settings.reducedMotion;
    this.lastX = spawn.x;

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.world.widthPx, this.world.heightPx);
    cam.setRoundPixels(true);
    this.camCtl = new CameraController(cam);
    this.camCtl.reducedMotion = settings.reducedMotion;
    this.camCtl.snapTo(spawn.x, spawn.y);
    this.world.updateParallax(cam);
    this.guide = this.add.image(0, 0, "arrow").setScrollFactor(0).setDepth(DEPTH.ui).setVisible(false).setScale(2);

    ui.showHud(true);
    ui.showObjective(!this.tutorial);
    ui.setSniffAvailable(this.state.abilities.sniff || !!this.tutorial);
    ui.onPauseButton = () => this.togglePause();
    ui.onHintButton = () => this.hintButton();
    ui.onSettingsApplied = () => this.renderTutorialCard();
    input.onPause = () => this.togglePause();
    input.onDeviceChange = () => {
      this.promptKey = "#refresh";
      this.renderTutorialCard();
      if (this.objectiveKey) this.refreshHud(true);
    };
    input.flush();
    tutorialUI().onSkip = () => (this.tutorial?.mode === "replay" ? this.endReplay() : this.confirmSkip());
    svc().settingsListeners.add(this.settingsListener);
    document.addEventListener("visibilitychange", this.visibilityListener);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      svc().settingsListeners.delete(this.settingsListener);
      document.removeEventListener("visibilitychange", this.visibilityListener);
      ui.closeTransmission(false);
      ui.setPrompt(null);
      ui.hideRead();
      ui.setSignal(null);
      tutorialUI().hide();
      input.onDeviceChange = null;
    });
    audio.playMusic("game");
    this.refreshHud(true);

    if (this.tutorial) {
      this.regionsShown.add("ship");
      if (this.tutorial.stage === "wake") this.wakeUp();
      else {
        cam.fadeIn(400, 0, 0, 0);
        this.renderTutorialCard();
        ui.toast("Welcome back! Let's finish your training.", "good");
      }
      this.save();
    } else if (this.isNew) {
      cam.fadeIn(600, 0, 0, 0);
      this.save();
    } else {
      cam.fadeIn(400, 0, 0, 0);
      ui.toast("Welcome back, Laika!", "good");
    }
    if (this.replayOnStart) this.time.delayedCall(60, () => this.startReplay());

    // Debug / automated play-testing hooks (only with ?debug in the URL). Read helpers + teleport.
    if (new URLSearchParams(location.search).has("debug")) {
      (window as unknown as { __laika: unknown }).__laika = {
        scene: this,
        state: () => this.state,
        tutorial: () => (this.tutorial ? { mode: this.tutorial.mode, stage: this.tutorial.stage, facts: this.tutorial.facts, holding: this.tutorial.holding } : null),
        player: () => ({
          x: this.player.x,
          y: this.player.feetY,
          vx: this.player.move.vx,
          vy: this.player.move.vy,
          grounded: this.player.move.grounded,
          col: Math.floor(this.player.x / TILE),
          row: Math.floor((this.player.feetY - 1) / TILE),
          anim: this.player.currentAnim,
          facing: this.player.facing,
        }),
        objective: () => getObjective(this.state),
        target: () => (this.target ? { id: this.target.o.id, verb: this.target.i.verb } : null),
        hints: () => ({ level: this.hints.level, activeMs: this.hints.activeMs }),
        tracking: () => !!this.tracking,
        teleport: (col: number, row: number) => this.player.placeAt(col * TILE + 8, row * TILE),
        audio: () => ({ unlocked: svc().audio.unlocked, settings: svc().settings }),
      };
    }
  }

  private spawnPoint(): { x: number; y: number } {
    if (this.tutorial) {
      const col = this.tutorial.stage === "wake" ? TUTORIAL_SPAWN.col : (stageDef(this.tutorial.stage)?.respawnCol ?? TUTORIAL_SPAWN.col);
      return { x: col * TILE + 8, y: TUTORIAL_SPAWN.row * TILE };
    }
    if (this.isNew) return { x: SPAWN.col * TILE + 8, y: SPAWN.row * TILE };
    const cp = objectById(this.state.checkpoint) ?? objectById("cp_ship")!;
    return objectPos(cp);
  }

  private onSettings(s: Settings): void {
    this.player.assist = s.assistJumps;
    this.player.reducedMotion = s.reducedMotion;
    this.sniffFx.reducedMotion = s.reducedMotion;
    this.camCtl.reducedMotion = s.reducedMotion;
    this.renderTutorialCard();
  }

  // ------------------------------------------------------------------
  // Main loop
  // ------------------------------------------------------------------

  update(time: number, delta: number): void {
    const { ui, input, settings } = svc();
    if (this.menu !== "none") return;
    const frame = input.poll();
    if (frame.any) this.lastInputAt = time;
    if (this.player.inScript && frame.any && this.tutorial?.stage === "wake") this.finishWake();
    const blocking = ui.transmissionBlocking;
    if (blocking && (frame.interactPressed || frame.jumpPressed)) {
      ui.advanceTransmission();
      frame.interactPressed = false;
      frame.jumpPressed = false;
    }
    const locked = blocking || this.camCtl.focusing || time < this.lockedUntil;
    this.state.playTimeMs += delta;

    const t = this.tutorial;
    const carryingModule = this.state.inventory.commsModule > 0 && !this.state.flags.moduleInstalled && !t;
    this.player.setCarry(t?.holding ? "icon_electronics" : carryingModule ? "icon_commsModule" : null);
    const events = this.player.update(frame, delta, time, locked, {
      isSolid: (x, y) => this.world.isSolidPx(x, y),
      idle: {
        nearUnfamiliar: !!this.target && !this.used.has(this.target.o.id) && !this.state.seen.includes(this.target.o.id),
        nearTreasure: this.objects.nearTreasure(this.player.x, this.player.feetY),
        safe: !ui.transmissionOpen && !locked,
      },
    });
    this.safety();
    this.trackJumps(events, time);
    if (t) this.tutorialTick(delta, time);

    if (!t) {
      for (const o of this.objects.touchingPickups(this.player.x, this.player.centerY, this.state)) {
        this.applyEffects(performInteraction(o, this.state, { revealed: this.objects.revealed }), o);
      }
    }

    const target = locked ? null : this.objects.findTarget(this.player.x, this.player.feetY, this.player.facing, (o) => this.interactionFor(o));
    this.target = target;
    const key = target ? `${target.o.id}|${target.i.verb}|${target.i.detail ?? ""}` : "";
    if (key !== this.promptKey) {
      this.promptKey = key;
      ui.setPrompt(target ? target.i : null);
      this.objects.setMarker(target?.o.id ?? null);
    }
    if (frame.interactPressed && !locked && !this.player.busy) {
      if (target) this.interact(target.o);
      else if (ui.readOpen) ui.hideRead();
    }
    if (frame.sniffPressed && !locked && !this.player.busy) this.doSniff(time);
    if (frame.barkPressed && !locked && !this.player.busy) this.doBark();
    this.trackSignal(time);

    if (!t) this.checkpoints();
    this.regions();
    this.world.updateFades(this.player.x, this.player.feetY, settings.reducedMotion);
    this.camCtl.update(
      delta,
      time,
      { x: this.player.x, feetY: this.player.feetY, vx: this.player.move.vx, facing: this.player.facing, grounded: this.player.move.grounded },
      { underground: this.world.isUnderground(this.player.x, this.player.feetY - 8), interestX: target ? objectPos(target.o).x : null },
    );
    this.world.updateParallax(this.cameras.main);

    if (this.readFrom && ui.readOpen && Math.abs(this.player.x - this.readFrom.x) > 70) {
      ui.hideRead();
      this.readFrom = null;
    }
    this.updateHintsTick(delta, time);
    if (time - this.lastSave > 20000) this.save();
  }

  private interactionFor(o: WorldObject): Interaction | null {
    if (PRACTICE_IDS.has(o.id)) return this.tutorial ? getPracticeInteraction(o, this.tutorial) : null;
    if (this.tutorial) return null; // the campaign is untouched while training
    return getInteraction(o, this.state, { revealed: this.objects.revealed });
  }

  private interact(o: WorldObject): void {
    this.used.add(o.id);
    if (PRACTICE_IDS.has(o.id) && this.tutorial) {
      const { effects, completed } = performPracticeInteraction(o, this.tutorial);
      this.applyEffects(effects, o);
      this.onTutorialAdvance(completed);
    } else {
      this.applyEffects(performInteraction(o, this.state, { revealed: this.objects.revealed }), o);
    }
    this.promptKey = "#refresh";
  }

  /** Never let Laika get stuck in terrain or fall out of the world. */
  private safety(): void {
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

  /** Jump bookkeeping: tutorial crate failures and the general "struggling here" detector. */
  private trackJumps(events: string[], time: number): void {
    const { settings } = svc();
    for (const e of events) {
      if (e === "jump") {
        this.jumpFromX = this.player.x;
        if (!settings.assistJumps && !this.tutorial && recordJump(this.struggle, this.player.x, time, this.player.facing)) {
          this.offerEasyJumps("That jump looks tricky.");
        }
      } else if (e === "land" && this.tutorial?.stage === "jump" && this.jumpFromX !== null) {
        if (this.jumpFromX < CRATE_LEFT_X && this.player.x < CRATE_LEFT_X + 4) {
          tutorialEvent(this.tutorial, { type: "jumpFailed" });
          if (this.tutorial.facts.jumpFails === 3) {
            this.renderTutorialCard("Try holding Jump a little longer.");
            if (!settings.assistJumps) this.offerEasyJumps("Try holding Jump a little longer.");
          }
        }
        this.jumpFromX = null;
      }
    }
  }

  private offerEasyJumps(lead: string): void {
    tutorialUI().offerAssist(`${lead} Want Easy Jumps? You'll jump higher and can glide. (Change it any time in Settings.)`, "Turn on Easy Jumps", () => {
      updateSettings({ ...svc().settings, assistJumps: true });
      svc().ui.toast("Easy Jumps on.", "good");
    });
  }

  // ------------------------------------------------------------------
  // Mission 00
  // ------------------------------------------------------------------

  private promptContext(): PromptContext {
    const { settings, input } = svc();
    const keys = {} as Record<Action, string>;
    for (const a of [...REMAPPABLE, "pause" as Action]) keys[a] = keyLabel(settings.bindings[a]);
    return { device: input.lastDevice, keys };
  }

  private renderTutorialCard(hint?: string): void {
    const t = this.tutorial;
    if (!t) return;
    const def = stageDef(t.stage);
    if (!def || def.id === "wake") return;
    tutorialUI().show(def, this.promptContext(), { hint: hint ?? (this.tutHintShown ? def.hint : undefined), replay: t.mode === "replay" });
    this.objects.highlight(def.target && def.target !== "crate" && def.target !== "floor_hatch" ? def.target : null);
  }

  /** Opening: Laika naps, a soft beep wakes her, she stretches and wags. Any input skips it. */
  private wakeUp(): void {
    const { audio, ui } = svc();
    this.cameras.main.fadeIn(900, 0, 0, 0);
    this.player.face(1);
    this.player.playScripted("sleep", 6000, this.time.now);
    this.wakeTimers = [
      this.time.delayedCall(900, () => {
        audio.sfx("track", { pitch: 1.2 });
        this.time.delayedCall(180, () => audio.sfx("track", { pitch: 1.4 }));
        ui.caption("Beep beep!");
      }),
      this.time.delayedCall(1200, () => {
        this.player.playScripted("stretch", 1000, this.time.now);
        audio.sfx("yawn");
      }),
      this.time.delayedCall(2200, () => this.finishWake()),
    ];
  }

  private finishWake(): void {
    if (!this.tutorial || this.tutorial.stage !== "wake") return;
    for (const tm of this.wakeTimers) tm.remove();
    this.wakeTimers = [];
    this.player.clearScripted();
    this.player.wag(this.time.now, 900);
    this.onTutorialAdvance(tutorialEvent(this.tutorial, { type: "woke" }));
  }

  private tutorialTick(delta: number, time: number): void {
    const t = this.tutorial!;
    const onUpperDeck = this.player.feetY <= UPPER_DECK_FLOOR_Y + 2;
    if (onUpperDeck && this.player.move.grounded) {
      const dx = this.player.x - this.lastX;
      if (Math.abs(dx) > 0.05) this.onTutorialAdvance(tutorialEvent(t, { type: "moved", dx, x: this.player.x }));
    }
    this.lastX = this.player.x;
    if (t.facts.repaired && this.player.feetY > TUTORIAL_EXIT_ROW * TILE) this.onTutorialAdvance(tutorialEvent(t, { type: "exited" }));
    // Tutorial hints come sooner than campaign hints, and only while the player is trying things.
    if (time - this.lastInputAt < 2000) this.tutStageMs += delta;
    if (!this.tutHintShown && this.tutStageMs > 12000 && svc().settings.hints) {
      this.tutHintShown = true;
      this.renderTutorialCard();
    }
  }

  private onTutorialAdvance(completed: TutorialStageId[]): void {
    const t = this.tutorial;
    if (!t || completed.length === 0) return;
    const { audio } = svc();
    if (completed.some((c) => c !== "wake")) {
      audio.sfx("stageDone");
      tutorialUI().success(completed.includes("exit") ? "Hello, Mars!" : "Nice!");
    }
    this.tutStageMs = 0;
    this.tutHintShown = false;
    if (t.mode === "first") {
      this.state.tutorial.stage = t.stage;
      this.save();
    }
    if (t.stage === "done") {
      this.completeTutorial();
      return;
    }
    this.time.delayedCall(completed.includes("wake") ? 0 : 650, () => this.renderTutorialCard());
  }

  private completeTutorial(): void {
    const t = this.tutorial!;
    const { ui, audio } = svc();
    tutorialUI().hide();
    this.objects.highlight(null);
    this.player.doAction("celebrate", this.time.now);
    this.time.delayedCall(150, () => audio.sfx("woof"));
    if (t.mode === "replay") {
      tutorialUI().missionCards([{ small: "PRACTICE", big: "MISSION 00 COMPLETE" }], 1500, () => this.endReplay());
      return;
    }
    this.tutorial = null;
    this.state.tutorial = { status: "done", stage: "done" };
    // Laika learned to use her scanner during training.
    this.state.abilities.sniff = true;
    ui.setSniffAvailable(true);
    this.save();
    audio.sfx("complete");
    tutorialUI().missionCards(
      [
        { small: "", big: "MISSION 00 COMPLETE" },
        { small: "MISSION 01", big: "A SIGNAL IN THE SILENCE" },
      ],
      1500,
      () => this.beginMission01(),
    );
  }

  private beginMission01(): void {
    svc().ui.showObjective(true);
    this.refreshHud(true);
    this.hints = createHints();
    this.openTransmission("wake", false);
  }

  private confirmSkip(): void {
    const { ui } = svc();
    if (this.menu === "none") {
      this.scene.pause();
      this.physics.pause();
    }
    this.menu = "confirm";
    ui.confirm(
      "Skip the training? You can replay it any time from the Pause menu.",
      "Skip tutorial",
      () => {
        this.resume();
        this.skipTutorial();
      },
      () => this.resume(),
    );
  }

  skipTutorial(): void {
    if (!this.tutorial) return;
    if (this.tutorial.mode === "replay") {
      this.endReplay();
      return;
    }
    const { ui } = svc();
    for (const tm of this.wakeTimers) tm.remove();
    this.player.clearScripted();
    this.tutorial = null;
    this.state.tutorial = { status: "skipped", stage: "done" };
    tutorialUI().hide();
    this.objects.highlight(null);
    this.world.setFloorHatch(true);
    this.world.setUpperDeckLit(true, false);
    this.objects.syncPractice(null);
    ui.setSniffAvailable(this.state.abilities.sniff);
    this.teleport(SPAWN.col * TILE + 8, SPAWN.row * TILE);
    this.save();
    tutorialUI().missionCards([{ small: "MISSION 01", big: "A SIGNAL IN THE SILENCE" }], 1500, () => this.beginMission01());
  }

  /** Replays Mission 00 with an isolated practice state; the campaign is untouched. */
  startReplay(): void {
    if (this.tutorial) return;
    const { ui } = svc();
    this.tutorialReturn = this.player.move.grounded ? { x: this.player.x, y: this.player.feetY } : objectPos(objectById(this.state.checkpoint) ?? objectById("cp_ship")!);
    this.tutorial = createTutorial("replay");
    tutorialEvent(this.tutorial, { type: "woke" });
    this.resetTrainingBay();
    ui.showObjective(false);
    ui.setSniffAvailable(true);
    this.renderTutorialCard();
  }

  restartTutorial(): void {
    if (!this.tutorial) return;
    const mode = this.tutorial.mode;
    this.tutorial = createTutorial(mode);
    tutorialEvent(this.tutorial, { type: "woke" });
    if (mode === "first") {
      this.state.tutorial = { status: "active", stage: this.tutorial.stage };
      this.save();
    }
    this.resetTrainingBay();
    this.renderTutorialCard();
  }

  private resetTrainingBay(): void {
    this.world.setFloorHatch(false);
    this.world.setUpperDeckLit(false, false);
    this.objects.revealed.delete("practice_buried");
    this.objects.syncPractice(this.tutorial);
    this.tutStageMs = 0;
    this.tutHintShown = false;
    this.teleport(TUTORIAL_SPAWN.col * TILE + 8, TUTORIAL_SPAWN.row * TILE);
  }

  endReplay(): void {
    const { ui } = svc();
    const back = this.tutorialReturn ?? objectPos(objectById(this.state.checkpoint) ?? objectById("cp_ship")!);
    this.tutorial = null;
    this.tutorialReturn = null;
    tutorialUI().hide();
    this.objects.highlight(null);
    this.world.setFloorHatch(true);
    this.world.setUpperDeckLit(true, false);
    this.objects.syncPractice(null);
    ui.setSniffAvailable(this.state.abilities.sniff);
    this.teleport(back.x, back.y);
    ui.showObjective(true);
    this.refreshHud(true);
    ui.toast("Back to your mission!", "good");
  }

  private teleport(x: number, y: number): void {
    this.player.placeAt(x, y);
    this.lastX = x;
    this.camCtl.snapTo(x, y);
    this.sniffFx.clear();
    this.tracking = null;
    svc().ui.setSignal(null);
  }

  // ------------------------------------------------------------------
  // Sniff (with tracking) and Bark
  // ------------------------------------------------------------------

  private doSniff(now: number): void {
    const { audio, ui } = svc();
    if (!this.tutorial && !this.state.abilities.sniff) {
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
    audio.sfx("sniff", { pitch: 0.95 + Math.random() * 0.1 });
    this.time.delayedCall(200, () => audio.sfx("pulse"));
    this.sniffFx.burst(this.player.x, this.player.feetY - 6, now);
    // Keep tracking the nearest signal for a while: no need to keep pressing the button.
    this.tracking = { until: now + 6000, lastDist: null, lastTrendAt: now, trend: "steady", nextPing: now + 250, found: false };
  }

  private currentTargets() {
    const t = this.tutorial;
    const all = sniffTargets(OBJECTS, this.state, { id: "practice_buried", active: !!t && !t.facts.collected });
    // While training only the practice component matters; in the campaign it never shows up.
    return t ? all.filter((x) => x.kind === "practice") : all;
  }

  private trackSignal(now: number): void {
    const { ui, audio } = svc();
    const tr = this.tracking;
    const px = this.player.x;
    const py = this.player.feetY - 6;
    if (!tr) {
      this.sniffFx.update(px, py, now, false, "none", null);
      return;
    }
    const boost = this.hints.level >= 2 ? 1.6 : 1;
    const dets = detect(px, py, this.currentTargets(), SNIFF_RADIUS, SNIFF_REVEAL_RADIUS, boost);
    const near = dets[0] ?? null;
    const level: SignalLevel = near ? signalLevel(near.dist, SNIFF_REVEAL_RADIUS, SNIFF_RADIUS * boost) : "none";
    if (now - tr.lastTrendAt > 300) {
      tr.trend = trend(tr.lastDist, near?.dist ?? null);
      if (tr.trend === "warmer") tr.until = Math.max(tr.until, now + 3000);
      tr.lastDist = near?.dist ?? null;
      tr.lastTrendAt = now;
    }
    if (near?.revealed) this.revealDetection(near.id, near.kind);
    if (near && now >= tr.nextPing) {
      const gap = level === "located" ? 260 : level === "strong" ? 480 : 900;
      tr.nextPing = now + gap;
      audio.sfx("track", { pitch: 0.7 + near.strength * 0.9, volume: 0.5 + near.strength * 0.5 });
      if (level === "strong") ui.caption("Ping... ping (strong signal)");
      if (level === "located") ui.caption("Ping-ping-ping! (found it)");
    }
    ui.setSignal(level, tr.trend);
    const tpos = near ? this.objects.positionOf(near.id) : null;
    this.sniffFx.update(px, py, now, true, level, tpos);
    if (near) tr.found = true;
    // Stop when time runs out, or as soon as the signal we were following is gone (dug up).
    if (now > tr.until || (tr.found && !near)) {
      if (!tr.found) ui.toast("Sniff... nothing nearby. Try somewhere else!");
      this.tracking = null;
      ui.setSignal(null);
      this.sniffFx.update(px, py, now, false, "none", null);
    }
  }

  private revealDetection(id: string, kind: string): void {
    const { ui, audio, settings } = svc();
    if (kind === "secret") {
      if (this.state.seen.includes(`sniffed:${id}`)) return;
      this.state.seen.push(`sniffed:${id}`);
      const p = this.objects.positionOf(id);
      this.objects.sparkleAt(p.x - 8, p.y - 16, 10);
      ui.toast("The rock here smells... hollow?", "info");
      return;
    }
    if (!this.objects.reveal(id)) return;
    audio.sfx("reveal");
    this.player.wag(this.time.now);
    if (kind === "practice" && this.tutorial) {
      this.onTutorialAdvance(tutorialEvent(this.tutorial, { type: "revealed" }));
    } else if (!this.state.seen.includes("tip:firstReveal")) {
      this.state.seen.push("tip:firstReveal");
      ui.toast(`Something's buried here! Press ${keyLabel(settings.bindings.interact)} to dig.`, "good");
    }
    this.promptKey = "#refresh";
  }

  private doBark(): void {
    let near: WorldObject | null = null;
    for (const o of OBJECTS) {
      if (o.kind !== "echoSensor" && o.kind !== "rover") continue;
      const p = objectPos(o);
      if (Math.abs(p.x - this.player.x) < 52 && Math.abs(p.y - this.player.feetY) < 30) near = o;
    }
    this.applyEffects(barkEffects(near, this.state), near ?? OBJECTS[0]);
  }

  // ------------------------------------------------------------------
  // Hints
  // ------------------------------------------------------------------

  private progressKey(): string {
    if (this.tutorial) return `t:${this.tutorial.stage}`;
    const o = getObjective(this.state);
    const inv = Object.values(this.state.inventory).reduce((a, b) => a + b, 0);
    return `${o.stage}|${o.primary}|${inv}|${this.regionId}`;
  }

  private inOptionalZone(): boolean {
    const c = Math.floor(this.player.x / TILE);
    const r = Math.floor((this.player.feetY - 1) / TILE);
    return OPTIONAL_ZONES.some((z) => c >= z.x0 && c <= z.x1 && r >= z.y0 && r <= z.y1);
  }

  private updateHintsTick(delta: number, time: number): void {
    const { ui, settings } = svc();
    if (this.tutorial) {
      this.guide.setVisible(false);
      return;
    }
    const level = updateHints(this.hints, delta, {
      enabled: settings.hints,
      blocked: ui.transmissionOpen || document.hidden || this.player.inScript || this.camCtl.focusing,
      active: time - this.lastInputAt < 2000,
      exploringOptional: this.inOptionalZone(),
      progressKey: this.progressKey(),
    });
    const o = getObjective(this.state);
    this.objects.highlight(level >= 1 && o.target ? o.target : null);
    ui.setHintLevel(level);
    this.updateGuideArrow(level >= 3 ? o.target : undefined);
  }

  /** Hint level 3: an arrow at the edge of the screen pointing towards the objective. */
  private updateGuideArrow(targetId: string | undefined): void {
    if (!targetId || !objectById(targetId)) {
      this.guide.setVisible(false);
      return;
    }
    const cam = this.cameras.main;
    const p = this.objects.positionOf(targetId);
    const sx = p.x - cam.scrollX;
    const sy = p.y - 20 - cam.scrollY;
    if (sx > 16 && sx < cam.width - 16 && sy > 16 && sy < cam.height - 16) {
      this.guide.setVisible(false);
      return;
    }
    const cx = cam.width / 2;
    const cy = cam.height / 2;
    const ang = Math.atan2(sy - cy, sx - cx);
    const bob = Math.sin(this.time.now / 200) * 2;
    const x = Phaser.Math.Clamp(cx + Math.cos(ang) * (cx - 18 + bob), 14, cam.width - 14);
    const y = Phaser.Math.Clamp(cy + Math.sin(ang) * (cy - 18 + bob), 14, cam.height - 14);
    this.guide.setVisible(true).setRotation(ang).setPosition(Math.round(x), Math.round(y));
  }

  private hintButton(): void {
    const { ui } = svc();
    if (this.tutorial) {
      this.tutHintShown = true;
      this.renderTutorialCard();
      return;
    }
    const level = requestHint(this.hints);
    ui.setHintLevel(level);
    ui.toast(level >= 3 ? "Follow the arrow at the edge of the screen." : level === 2 ? "Hint added to your objective." : "The thing you need is glowing.", "info");
  }

  // ------------------------------------------------------------------
  // Effects
  // ------------------------------------------------------------------

  private applyEffects(fx: Effect[], o: WorldObject): void {
    const { ui, audio, settings } = svc();
    const now = this.time.now;
    const digging = fx.some((e) => e.type === "anim" && e.name === "dig");
    for (const e of fx) {
      switch (e.type) {
        case "toast":
          ui.toast(e.text, e.tone);
          break;
        case "item": {
          const delay = digging ? 470 : 0;
          this.objects.collect(e.objectId, this.player.x, this.player.centerY - 6, delay);
          this.time.delayedCall(delay + 60, () => {
            audio.sfx(e.item === "commsModule" || e.item === "treat" ? "collectBig" : "collect", { pitch: 0.97 + Math.random() * 0.06 });
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
        case "anim": {
          const ox = objectPos(o).x;
          const toward: 1 | -1 = ox >= this.player.x ? 1 : -1;
          // Face the machine; for a tail sweep, turn the tail towards the panel.
          if (e.name === "sweep") this.player.face(Math.abs(ox - this.player.x) < 2 ? this.player.facing : (-toward as 1 | -1));
          else if (e.name !== "celebrate" && e.name !== "bark") this.player.face(toward);
          this.player.doAction(e.name, now);
          if (e.name === "dig") {
            audio.sfx("dig", { pitch: 0.95 + Math.random() * 0.1 });
            const p = objectPos(o);
            const n = settings.reducedMotion ? 2 : 5;
            for (let i = 0; i < n; i++) this.time.delayedCall(140 + i * 90, () => this.objects.digDirt(p.x - this.player.facing * 6, p.y - 2));
          } else if (e.name === "interact") audio.sfx("mech");
          else if (e.name === "repair") {
            audio.sfx("mech");
            this.time.delayedCall(180, () => audio.sfx("mech", { pitch: 1.2 }));
            this.objects.repairBurst(o.id);
          } else if (e.name === "sweep") audio.sfx("sweep", { pitch: 0.9 + Math.random() * 0.2 });
          else if (e.name === "celebrate") this.time.delayedCall(150, () => audio.sfx("woof", { pitch: 1.1 }));
          else if (e.name === "bark") this.showBark();
          break;
        }
        case "sound":
          if (e.name !== "woof") audio.sfx(e.name);
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

  /** Visual bark for players who can't hear it: sound arcs from Laika's mouth + caption. */
  private showBark(): void {
    const { ui, audio } = svc();
    audio.sfx("woof", { pitch: 0.92 + Math.random() * 0.16 });
    ui.caption("Woof!");
    const w = this.add
      .image(this.player.x + this.player.facing * 16, this.player.feetY - 16, "bark_wave")
      .setDepth(DEPTH.fx)
      .setFlipX(this.player.facing < 0);
    this.tweens.add({ targets: w, x: w.x + this.player.facing * 6, alpha: 0, duration: 450, onComplete: () => w.destroy() });
  }

  private worldEvent(ev: WorldEvent, objectId: string): void {
    const { ui, audio, settings } = svc();
    switch (ev) {
      case "hatchOpen":
        this.world.setTiles(HATCH_TILES, T.Empty);
        audio.sfx("door");
        this.objects.sparkleAt(23 * TILE + 8, 20 * TILE, 6);
        break;
      case "solarRepaired":
        this.objects.setTexture("solarControl", "solar_control_ok");
        this.objects.sparksAt("solarControl", 14);
        break;
      case "panelClean":
        this.objects.panelDust(objectId, this.player.facing === 1 ? -1 : 1, settings.reducedMotion);
        break;
      case "powerOn":
        audio.sfx("power");
        ui.caption("Machines humming to life");
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
      case "practiceConsole":
        this.objects.consoleOn();
        break;
      case "practiceCollected":
        this.objects.collect("practice_buried", this.player.x, this.player.centerY - 6, 470);
        this.time.delayedCall(530, () => {
          audio.sfx("collect");
          this.player.wag(this.time.now);
        });
        break;
      case "practiceRepaired":
        this.objects.setFan(true);
        this.world.setUpperDeckLit(true, !settings.reducedMotion);
        this.time.delayedCall(250, () => audio.sfx("power"));
        ui.caption("Lights on, fan whirring");
        this.time.delayedCall(900, () => {
          this.world.setFloorHatch(true);
          audio.sfx("door");
          this.objects.sparkleAt(22 * TILE, 14 * TILE, 10);
        });
        break;
      case "echoSensor":
        this.objects.echo(objectId);
        this.time.delayedCall(450, () => {
          audio.sfx("beepTune");
          ui.caption("Beep-boop! The sensor answers");
        });
        break;
      case "roverBeep":
        this.objects.roverBeep(objectId);
        this.time.delayedCall(300, () => {
          audio.sfx("roverBeep");
          ui.caption("Bleep! (R-2 perks up)");
        });
        break;
    }
  }

  private syncReceiver(): void {
    if (isPowered(this.state) && this.state.flags.moduleInstalled) this.objects.setTexture("receiver", "receiver_on");
  }

  private extendBridge(): void {
    const { audio, ui } = svc();
    this.lockedUntil = this.time.now + 400 + BRIDGE_TILES.length * 110;
    this.camCtl.focus(206 * TILE, 22 * TILE, 450 + BRIDGE_TILES.length * 110 + 400, this.time.now);
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
  }

  private focusOn(objectId: string): void {
    const p = this.objects.positionOf(objectId);
    if (this.camCtl.focus(p.x, p.y - 50, 1900, this.time.now)) this.lockedUntil = this.time.now + 1900;
  }

  private openTransmission(id: string, blocking: boolean): void {
    const { ui, audio, input } = svc();
    const t = TRANSMISSIONS[id];
    if (!t) return;
    if (blocking) audio.duckMusic(true);
    if (t.lines.some((l) => l.static)) {
      audio.sfx("static");
      ui.caption("Radio static");
    }
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
      if (!this.regionsShown.has(region.id) && !(region.id === "station" && !inStation) && !this.tutorial) {
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
    const key = JSON.stringify(o.steps) + o.title + o.primary + JSON.stringify(o.optional);
    if (force || key !== this.objectiveKey) {
      this.objectiveKey = key;
      ui.setObjective(o, this.hints.level);
    }
    ui.setInventory(this.state.inventory);
  }

  save(): void {
    this.lastSave = this.time.now;
    saveGame(svc().store, this.state);
  }

  private respawn(msg: string): void {
    if (this.tutorial) {
      this.teleport((stageDef(this.tutorial.stage)?.respawnCol ?? TUTORIAL_SPAWN.col) * TILE + 8, TUTORIAL_SPAWN.row * TILE);
      return;
    }
    const cp = objectById(this.state.checkpoint) ?? objectById("cp_ship")!;
    const p = objectPos(cp);
    this.teleport(p.x, p.y);
    svc().ui.toast(msg);
  }

  togglePause(): void {
    const { ui } = svc();
    if (!this.scene.isActive() && !this.scene.isPaused()) return;
    if (this.menu === "none") this.openPause();
    else if (this.menu === "pause" || this.menu === "confirm") this.resume();
    else if (this.menu === "settings" || this.menu === "controls") this.openPause();
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
    ui.clearTouch();
    const t = this.tutorial;
    ui.showPause({
      tutorial: t ? t.mode : null,
      onResume: () => this.resume(),
      onSettings: () => {
        this.menu = "settings";
        ui.showSettings(svc().settings, (s) => updateSettings(s), () => this.openPause());
      },
      onControls: () => {
        this.menu = "controls";
        ui.showControls(() => this.openPause());
      },
      onCheckpoint: () => {
        this.resume();
        this.respawn("Back at the last checkpoint.");
      },
      onSkipTutorial: () => {
        this.resume();
        this.skipTutorial();
      },
      onRestartTutorial: () => {
        this.resume();
        this.restartTutorial();
      },
      onEndReplay: () => {
        this.resume();
        this.endReplay();
      },
      onReplayTutorial:
        this.state.tutorial.status !== "active" && !t
          ? () => {
              this.resume();
              this.startReplay();
            }
          : undefined,
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
    const { ui } = svc();
    ui.closeScreen();
    this.menu = "none";
    ui.clearTouch();
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
