/**
 * Phase 4 interactions: the outpost's engineering, suit recharging, the lower level's stairs, the
 * Mission 04 story beats, the Lights Out event and the three optional expedition challenges.
 *
 * Same contract as interactions.ts / puzzles.ts: phase4Interaction() answers "what would E do?"
 * (or `undefined` when Phase 4 does not handle the object), performPhase4() mutates the state and
 * returns Effects. Every repair is a one-time, idempotent milestone: repeating an action never pays
 * out twice and never consumes a second item. Mission items are unique (never bought with metal or
 * electronics), so spending on optional gear can never block the story.
 */
import { ENGINEERING, OPTIONAL_SYSTEMS, type OptionalSystem, type SurvivalMode } from "../data/engineering";
import { SCIENCE } from "../data/science";
import type { TIPS } from "../data/story";
import type { WorldObject } from "../data/world";
import type { Effect, Interaction, InteractionContext } from "./effects";
import { allFacilitiesRestored, allocationFits, capacity, hazeActive, plantStage, STAGE_NAMES } from "./engineering";
import { count } from "./inventory";
import { isPowered, type GameState } from "./state";
import { recharge } from "./survival";

export interface Phase4Context extends InteractionContext {
  mode?: SurvivalMode;
}

const modeOf = (ctx: Phase4Context): SurvivalMode => ctx.mode ?? "adventure";
const took = (s: GameState, id: string) => s.seen.includes(`took:${id}`);

function tipOnce(s: GameState, key: keyof typeof TIPS, fx: Effect[]): void {
  const id = `tip:${key}`;
  if (s.seen.includes(id)) return;
  s.seen.push(id);
  fx.push({ type: "tip", key });
}

function give(s: GameState, item: Parameters<typeof count>[1], objectId: string, fx: Effect[]): void {
  s.inventory[item] = Math.min(99, s.inventory[item] + 1);
  fx.push({ type: "item", item, objectId, amount: 1 });
}

function use(s: GameState, item: Parameters<typeof count>[1]): boolean {
  if (s.inventory[item] <= 0) return false;
  s.inventory[item] -= 1;
  return true;
}

// ---------------------------------------------------------------------------
// Science journal: entries unlock from what has been achieved (derived, so old saves back-fill).
// ---------------------------------------------------------------------------

const SCIENCE_WHEN: Record<string, (s: GameState) => boolean> = {
  hematite: (s) => s.collected.includes("sample_hematite"),
  marsquakes: (s) => s.flags.seismometerRead,
  water_ice: (s) => s.collected.includes("sampler"),
  water_loop: (s) => s.flags.waterRestored,
  solar_dust: (s) => isPowered(s),
  battery: (s) => s.flags.batteryRestored,
  priority: (s) => s.flags.lightsOutBalanced,
  water_recovery: (s) => s.flags.recyclerOn,
  plants: (s) => s.flags.seedsPlanted,
  radiation: (s) => s.flags.shelterRestored,
  relays: (s) => s.flags.relayNetworkOnline,
  delay: (s) => s.flags.demoComplete,
};

/** Unlocks every journal entry whose condition now holds. Returns the newly unlocked ids. */
export function syncScience(s: GameState): string[] {
  const added: string[] = [];
  for (const e of SCIENCE) {
    if (!s.science.includes(e.id) && SCIENCE_WHEN[e.id]?.(s)) {
      s.science.push(e.id);
      added.push(e.id);
    }
  }
  return added;
}

// ---------------------------------------------------------------------------
// What E would do
// ---------------------------------------------------------------------------

export function phase4Interaction(o: WorldObject, s: GameState, ctx: Phase4Context): Interaction | null | undefined {
  const f = s.flags;
  const m4 = f.m4Briefed;
  const mode = modeOf(ctx);
  switch (o.kind) {
    case "beacon":
      if (f.ridgeCableOpen && !m4) return { verb: "Answer the call" };
      return undefined;
    case "habitat":
      if (!m4) return undefined;
      return { verb: "Go down" };
    case "battery":
      if (!m4) return undefined;
      if (!f.batteryRestored) return count(s, "regulator") > 0 ? { verb: "Fix battery" } : { verb: "Check battery", detail: "Broken" };
      return { verb: "Battery", detail: `${Math.round((s.eng.battery / capacity(mode)) * 100)}%` };
    case "solarPanel":
      if (s.eng.dusty.includes(o.id)) return { verb: "Clean panel" };
      return undefined;
    case "sampler":
      if (m4 && s.collected.includes("sampler") && !took(s, "drill_coupling") && !f.waterRestored) return { verb: "Take pipe connector" };
      return undefined;
    case "stairs":
      return { verb: "Go up" };
    case "recharge":
      if (o.broken && !f.canyonPostFixed) return count(s, "powerCell") > 0 ? { verb: "Fix post" } : { verb: "Check post", detail: "No power cell" };
      return { verb: "Recharge" };
    case "facility":
      return facilityInteraction(o, s);
    // ---- Phase 5 ----
    case "workstation":
      return isPowered(s) ? { verb: "Workbench" } : undefined;
    case "receiver":
      if (count(s, "navBeacon") > 0 && !f.m5Complete) return { verb: "Link beacon" };
      return undefined;
    default:
      return undefined;
  }
}

function facilityInteraction(o: WorldObject, s: GameState): Interaction | null {
  const f = s.flags;
  const m4 = f.m4Briefed;
  const bus = f.batteryRestored;
  switch (o.part) {
    case "cargoLocker":
      if (!m4) return { verb: "Look inside" };
      return took(s, "cargo_locker") ? { verb: "Look inside", detail: "Empty" } : { verb: "Open locker" };
    case "baseTerminal":
      return m4 ? { verb: "Base status" } : { verb: "Read screen" };
    case "probeOut":
    case "probeIn": {
      const read = o.part === "probeOut" ? f.probeOutRead : f.probeInRead;
      if (!f.shelterInspected) return { verb: "Check probe", detail: "Asleep" };
      return { verb: "Bark", detail: read ? "Done" : undefined };
    }
    case "shelterTerminal":
      if (!bus) return { verb: "Check monitor", detail: "No power" };
      if (!f.shelterInspected) return { verb: "Wake monitor" };
      return { verb: "Check monitor" };
    case "distConsole":
      if (!bus) return { verb: "Check console", detail: "No power" };
      return { verb: "Share power" };
    case "bed":
      return m4 ? { verb: "Rest" } : null;
    case "storage":
      if (!m4) return null;
      return took(s, "habitat_storage") ? { verb: "Look inside", detail: "Empty" } : { verb: "Open locker" };
    case "recycler":
      if (f.recyclerOn) return { verb: "Life support", detail: "Working" };
      if (count(s, "recyclerPart") > 0 || f.recyclerFixed) return { verb: "Fix life support", detail: bus ? undefined : "No power" };
      return { verb: "Check life support" };
    case "recyclerPower":
    case "growPower":
      return { verb: "Power box", detail: bus ? "On" : "No power" };
    case "growValve":
      return { verb: "Water valve", detail: f.growValveOpen ? "Open" : "Dry" };
    case "planter": {
      if (!f.seedsPlanted) {
        if (!f.waterRestored && !f.growValveOpen) return { verb: "Planter", detail: "Needs water" };
        if (count(s, "seeds") <= 0) return { verb: "Planter", detail: "Needs seeds" };
        return { verb: "Plant seeds" };
      }
      if (!f.growLightsOn) return { verb: "Lights on" };
      const st = plantStage(s);
      if (st >= 4 && !f.cropHarvested) return { verb: "Harvest" };
      return { verb: "Plants", detail: STAGE_NAMES[st] };
    }
    case "waterProcessor":
      if (f.waterRestored) return { verb: "Water", detail: "Working" };
      if (count(s, "waterCoupling") > 0) return { verb: "Fix water pipe", detail: bus ? undefined : "No power" };
      return { verb: "Check water", detail: "Pipe missing" };
    case "seismometer":
      if (!f.canyonPostFixed) return { verb: "Check sensor", detail: "No power" };
      return { verb: "Read sensor" };
    case "deepProbe":
      return { verb: f.fissureSurveyed ? "Check probe" : "Read probe" };
    case "telescopeNorth":
      return { verb: "Look north" };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Doing it
// ---------------------------------------------------------------------------

export function performPhase4(o: WorldObject, s: GameState, ctx: Phase4Context): Effect[] | undefined {
  const i = phase4Interaction(o, s, ctx);
  if (i === undefined) return undefined;
  const fx: Effect[] = [];
  if (i === null) return fx;
  const f = s.flags;
  const mode = modeOf(ctx);
  const save = () => fx.push({ type: "save" });

  switch (o.kind) {
    case "beacon":
      fx.push({ type: "anim", name: "interact" }, ...answerStationCall(s));
      return fx;
    case "habitat":
      fx.push({ type: "anim", name: "interact" }, { type: "stairs", to: [62, 31] });
      return fx;
    case "stairs":
      fx.push({ type: "stairs", to: o.to ?? [60, 24] });
      return fx;
    case "battery":
      fx.push({ type: "anim", name: "repair" });
      if (!f.batteryRestored && use(s, "regulator")) {
        f.batteryRestored = true;
        // Phase 5: the battery's cables reach every room by themselves (no separate power boxes to press).
        f.recyclerPowered = true;
        f.growPowered = true;
        s.eng.battery = Math.min(ENGINEERING.batteryStart, capacity(mode));
        fx.push({ type: "world", event: "batteryRestored", objectId: o.id }, { type: "toast", text: "Battery fixed!", tone: "good" });
        tipOnce(s, "storage", fx);
        save();
      } else if (!f.batteryRestored) {
        fx.push({ type: "toast", text: "Needs a battery part" });
        s.seen.includes("battery_inspected") || s.seen.push("battery_inspected");
      } else {
        fx.push({ type: "toast", text: `Battery ${Math.round((s.eng.battery / capacity(mode)) * 100)}%` });
      }
      return fx;
    case "solarPanel":
      s.eng.dusty = s.eng.dusty.filter((p) => p !== o.id);
      fx.push({ type: "anim", name: "sweep" }, { type: "world", event: "panelClean", objectId: o.id });
      if (s.eng.dusty.length === 0 && f.lightsOutBalanced && !f.lightsOutDone) {
        f.lightsOutDone = true;
        s.eng.alloc = { water: true, greenhouse: true, research: true };
        fx.push({ type: "world", event: "lightsOutDone" }, { type: "toast", text: "Full power!", tone: "good" });
        save();
      }
      return fx;
    case "sampler":
      fx.push({ type: "anim", name: "interact" });
      s.seen.push("took:drill_coupling");
      give(s, "waterCoupling", o.id, fx);
      save();
      return fx;
    case "recharge":
      if (o.broken && !f.canyonPostFixed) {
        fx.push({ type: "anim", name: "repair" });
        if (use(s, "powerCell")) {
          f.canyonPostFixed = true;
          fx.push({ type: "world", event: "postFixed", objectId: o.id }, { type: "toast", text: "Post fixed!", tone: "good" });
          save();
        } else {
          fx.push({ type: "toast", text: "Needs a power cell" });
        }
        return fx;
      }
      recharge(s);
      fx.push({ type: "anim", name: "interact" }, { type: "world", event: "recharge", objectId: o.id });
      tipOnce(s, "recharge", fx);
      return fx;
    case "facility":
      return performFacility(o, s, fx, save);
    case "workstation":
      fx.push({ type: "anim", name: "interact" });
      // Chapter 5: the first visit after the call reveals the Signal Booster blueprint.
      if (f.m5Briefed && !f.m5Blueprint) {
        f.m5Blueprint = true;
        if (!s.gear.blueprints.includes("booster")) s.gear.blueprints.push("booster");
        fx.push({ type: "world", event: "blueprint", objectId: o.id }, { type: "toast", text: "New blueprint!", tone: "good" });
        save();
      }
      fx.push({ type: "ui", panel: "workbench" });
      return fx;
    case "receiver":
      fx.push({ type: "anim", name: "interact" });
      if (use(s, "navBeacon")) {
        f.m5Complete = true;
        for (const id of ["booster", "efficientBoots", "surveyLamp", "reserveBattery"] as const) if (!s.gear.blueprints.includes(id)) s.gear.blueprints.push(id);
        fx.push({ type: "transmission", id: "m5Final" }, { type: "world", event: "m5Complete", objectId: o.id }, { type: "toast", text: "New blueprints at the workbench" });
        save();
      }
      return fx;
    default:
      return fx;
  }
}

/** Chapter 5 starts by itself after Chapter 4 (a short call, no console trip). */
export function startChapter5(s: GameState): Effect[] {
  if (!s.flags.m4Complete || s.flags.m5Briefed) return [];
  s.flags.m5Briefed = true;
  return [{ type: "transmission", id: "m5Brief" }, { type: "world", event: "m5Brief" }, { type: "save" }];
}

/** The Ares Station's call that starts Chapter 4 (pressed at the console, or sent by the scene). */
export function answerStationCall(s: GameState): Effect[] {
  if (s.flags.m4Briefed || !s.flags.ridgeCableOpen) return [];
  s.flags.m4Briefed = true;
  recharge(s);
  return [{ type: "transmission", id: "m4Brief" }, { type: "world", event: "m4Brief" }, { type: "save" }];
}

function performFacility(o: WorldObject, s: GameState, fx: Effect[], save: () => void): Effect[] {
  const f = s.flags;
  const anim = (name: "interact" | "repair" | "celebrate" | "bark" | "sweep") => fx.push({ type: "anim", name });
  switch (o.part) {
    case "cargoLocker":
      anim("interact");
      if (f.m4Briefed && !took(s, "cargo_locker")) {
        s.seen.push("took:cargo_locker");
        give(s, "regulator", o.id, fx);
        save();
      } else fx.push({ type: "toast", text: "Empty" });
      return fx;
    case "baseTerminal":
      anim("interact");
      if (f.m4Briefed && !f.baseSurveyed) {
        f.baseSurveyed = true;
        save();
      }
      fx.push(f.m4Briefed ? { type: "ui", panel: "baseStatus" } : { type: "toast", text: "Base offline" });
      return fx;
    case "probeOut":
    case "probeIn": {
      anim("bark");
      fx.push({ type: "sound", name: "woof" });
      if (!f.shelterInspected) {
        fx.push({ type: "toast", text: "Wake the shelter monitor first" });
        return fx;
      }
      const outside = o.part === "probeOut";
      if (outside) f.probeOutRead = true;
      else f.probeInRead = true;
      fx.push({ type: "world", event: "probeRead", objectId: o.id });
      // Phase 5: the second reading finishes the shelter by itself (no trip back to the monitor).
      if (f.probeOutRead && f.probeInRead && !f.shelterRestored) {
        f.shelterRestored = true;
        fx.push({ type: "world", event: "shelterOn", objectId: "shelter_terminal" }, { type: "toast", text: "Shelter ready!", tone: "good" });
      } else if (!f.shelterRestored) {
        fx.push({ type: "toast", text: outside ? "Outside: high" : "Inside: low" });
      }
      save();
      return fx;
    }
    case "shelterTerminal":
      anim("interact");
      if (!f.batteryRestored) {
        fx.push({ type: "toast", text: "No power yet", tone: "warn" });
      } else if (!f.shelterInspected) {
        f.shelterInspected = true;
        fx.push({ type: "world", event: "shelterAwake", objectId: o.id }, { type: "toast", text: "Bark at both probes" });
        save();
      } else if (f.shelterRestored) {
        fx.push({ type: "read", title: "SHELTER MONITOR", lines: ["Outside 7 · Inside 2 (game units)", "Thick walls block radiation."] });
      } else {
        fx.push({ type: "toast", text: `Probes: ${f.probeInRead ? "✔" : "?"} inside · ${f.probeOutRead ? "✔" : "?"} outside` });
      }
      return fx;
    case "distConsole":
      anim("interact");
      fx.push(f.batteryRestored ? { type: "ui", panel: "distribution" } : { type: "toast", text: "No power yet", tone: "warn" });
      return fx;
    case "bed":
      recharge(s);
      fx.push({ type: "world", event: "rest", objectId: o.id });
      return fx;
    case "storage":
      anim("interact");
      if (!took(s, "habitat_storage")) {
        s.seen.push("took:habitat_storage");
        give(s, "seeds", o.id, fx);
        save();
      } else fx.push({ type: "toast", text: "Just blankets" });
      return fx;
    case "recycler":
      if (f.recyclerOn) {
        anim("interact");
        fx.push({ type: "toast", text: "Working" });
      } else if (!f.recyclerFixed && !use(s, "recyclerPart")) {
        anim("interact");
        f.recyclerInspected = true;
        fx.push({ type: "toast", text: "Pump missing. Sniff nearby!", tone: "info" });
        save();
      } else {
        // Phase 5: one press installs the pump and starts life support (when the battery runs).
        anim("repair");
        const wasFixed = f.recyclerFixed;
        f.recyclerInspected = true;
        f.recyclerFixed = true;
        if (!wasFixed) fx.push({ type: "world", event: "recyclerFixed", objectId: o.id });
        if (f.batteryRestored) {
          f.recyclerPowered = true;
          f.recyclerOn = true;
          fx.push({ type: "world", event: "recyclerOn", objectId: o.id }, { type: "toast", text: "Life support on!", tone: "good" });
          tipOnce(s, "recycler", fx);
        } else fx.push({ type: "toast", text: "Pump in. Needs battery power", tone: "info" });
        save();
      }
      return fx;
    case "recyclerPower":
    case "growPower":
      anim("interact");
      fx.push({ type: "toast", text: f.batteryRestored ? "Power on" : "No power yet" });
      return fx;
    case "growValve":
      anim("interact");
      fx.push({ type: "toast", text: f.growValveOpen ? "Water flowing" : "No water yet" });
      return fx;
    case "planter": {
      if (!f.seedsPlanted) {
        anim("interact");
        const wet = f.growValveOpen || f.waterRestored;
        if (wet && use(s, "seeds")) {
          f.growValveOpen = true;
          f.seedsPlanted = true;
          s.eng.growMs = 0;
          fx.push({ type: "world", event: "planted", objectId: o.id });
          // Phase 5: planting also switches the grow lights on when the room has power.
          if (f.batteryRestored) {
            f.growPowered = true;
            f.growLightsOn = true;
            fx.push({ type: "world", event: "growLights", objectId: o.id }, { type: "toast", text: "Seeds planted!", tone: "good" });
          } else fx.push({ type: "toast", text: "Seeds planted!", tone: "good" });
          tipOnce(s, "plants", fx);
          save();
        } else fx.push({ type: "toast", text: wet ? "Needs seeds" : "Needs water", tone: "warn" });
        return fx;
      }
      if (!f.growLightsOn) {
        anim("interact");
        if (f.batteryRestored) {
          f.growPowered = true;
          f.growLightsOn = true;
          fx.push({ type: "world", event: "growLights", objectId: o.id }, { type: "toast", text: "Lights on!", tone: "good" });
          save();
        } else fx.push({ type: "toast", text: "No power yet", tone: "warn" });
        return fx;
      }
      if (plantStage(s) >= 4 && !f.cropHarvested) {
        f.cropHarvested = true;
        s.eng.growMs = ENGINEERING.growStageMs[0];
        anim("celebrate");
        fx.push({ type: "world", event: "harvest", objectId: o.id }, { type: "toast", text: "First harvest!", tone: "good" });
        save();
        return fx;
      }
      anim("interact");
      fx.push({ type: "toast", text: STAGE_NAMES[plantStage(s)] });
      return fx;
    }
    case "waterProcessor":
      if (f.waterRestored) {
        anim("interact");
        fx.push({ type: "toast", text: "Water flowing" });
      } else if (count(s, "waterCoupling") > 0 && f.batteryRestored) {
        anim("repair");
        use(s, "waterCoupling");
        f.waterRestored = true;
        // Phase 5: the grow-room valve opens with the water (one repair, visible flow everywhere).
        f.growValveOpen = true;
        fx.push({ type: "world", event: "waterOn", objectId: o.id }, { type: "toast", text: "Water flowing!", tone: "good" });
        save();
      } else {
        anim("interact");
        if (!s.seen.includes("water_inspected")) s.seen.push("water_inspected");
        fx.push({ type: "toast", text: count(s, "waterCoupling") > 0 ? "No power yet" : "Pipe connector missing", tone: "info" });
        save();
      }
      return fx;
    case "seismometer":
      anim("interact");
      if (!f.canyonPostFixed) {
        fx.push({ type: "toast", text: "No power. Fix the post", tone: "warn" });
      } else if (!f.seismometerRead) {
        f.seismometerRead = true;
        s.inventory.recording = Math.min(99, s.inventory.recording + 1);
        fx.push(
          { type: "item", item: "recording", objectId: o.id, amount: 1 },
          { type: "world", event: "seismometer", objectId: o.id },
          { type: "read", title: "QUAKE SENSOR", lines: ["214 small marsquakes recorded."] },
        );
        save();
      } else fx.push({ type: "toast", text: "Quiet today" });
      return fx;
    case "deepProbe":
      anim("interact");
      if (!f.fissureSurveyed) {
        f.fissureSurveyed = true;
        s.inventory.sample = Math.min(99, s.inventory.sample + 1);
        fx.push(
          { type: "item", item: "sample", objectId: o.id, amount: 1 },
          { type: "world", event: "deepProbe", objectId: o.id },
          { type: "read", title: "DEEP PROBE", lines: ["Ice layers, like tree rings."] },
        );
        save();
      } else fx.push({ type: "toast", text: "Done" });
      return fx;
    case "telescopeNorth":
      anim("interact");
      fx.push({ type: "read", title: "TELESCOPE", lines: ["Far north, a light blinks.", "As if it is waiting."] });
      if (!f.observatoryReached) {
        f.observatoryReached = true;
        fx.push({ type: "world", event: "telescope", objectId: o.id });
        save();
      }
      return fx;
    default:
      return fx;
  }
}

// ---------------------------------------------------------------------------
// Mission 04 beats driven by the scene (not by a button)
// ---------------------------------------------------------------------------

/** Laika walked back into the outpost after the station call. */
export function markReturned(s: GameState): boolean {
  if (!s.flags.m4Briefed || s.flags.baseReturned) return false;
  s.flags.baseReturned = true;
  return true;
}

/** LIGHTS OUT can start once every facility runs (the scene starts it while Laika is at the outpost). */
export function lightsOutReady(s: GameState): boolean {
  return allFacilitiesRestored(s) && !s.flags.lightsOutStarted;
}

export function startLightsOut(s: GameState): Effect[] {
  if (!lightsOutReady(s)) return [];
  s.flags.lightsOutStarted = true;
  return [{ type: "world", event: "lightsOut" }, { type: "save" }];
}

/**
 * The distribution console's choice. Life support (and every critical system) cannot be switched
 * off. During the haze, a choice that fits the available power balances the network.
 */
export function setAllocation(s: GameState, mode: SurvivalMode, alloc: Record<OptionalSystem, boolean>): Effect[] {
  const fx: Effect[] = [];
  for (const id of OPTIONAL_SYSTEMS) s.eng.alloc[id] = !!alloc[id];
  if (hazeActive(s) && allocationFits(s, mode, s.eng.alloc)) {
    s.flags.lightsOutBalanced = true;
    s.eng.dusty = [...ENGINEERING.hazeDustPanels];
    fx.push({ type: "world", event: "lightsOutBalanced" }, { type: "tip", key: "priority" });
    if (!s.seen.includes("tip:priority")) s.seen.push("tip:priority");
  }
  fx.push({ type: "save" });
  return fx;
}

/** The final look at the restored outpost. */
export function completeMission04(s: GameState): Effect[] {
  if (!s.flags.lightsOutDone || s.flags.m4Complete) return [];
  s.flags.m4Complete = true;
  return [{ type: "transmission", id: "m4Final" }, { type: "world", event: "m4Complete" }, { type: "save" }];
}
