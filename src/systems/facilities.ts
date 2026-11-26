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
import { recharge, suitActive } from "./survival";

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
      if (f.ridgeCableOpen && !m4) return { verb: "Answer the station call", detail: "Mission 04" };
      return undefined;
    case "habitat":
      if (!m4) return undefined;
      return { verb: "Enter the habitat", detail: "Stairs to the lower level" };
    case "battery":
      if (!m4) return undefined;
      if (!f.batteryRestored) {
        return count(s, "regulator") > 0 ? { verb: "Install the regulator" } : { verb: "Inspect battery station", detail: "Regulator burnt out" };
      }
      return { verb: "Check battery", detail: `${Math.round((s.eng.battery / capacity(mode)) * 100)}% stored` };
    case "solarPanel":
      if (s.eng.dusty.includes(o.id)) return { verb: "Sweep the dust", detail: "Tail sweep!" };
      return undefined;
    case "sampler":
      if (m4 && s.collected.includes("sampler") && !took(s, "drill_coupling") && !f.waterRestored) return { verb: "Take the spare melt-line coupling" };
      return undefined;
    case "stairs":
      return { verb: "Climb the stairs", detail: "Up to the habitat dome" };
    case "recharge":
      if (o.broken && !f.canyonPostFixed) {
        return count(s, "powerCell") > 0 ? { verb: "Install the power cell" } : { verb: "Inspect recharge post", detail: "Dead: no power cell" };
      }
      return { verb: "Recharge suit", detail: suitActive(s) ? `Suit ${Math.round(s.eng.suit)}%` : "Suit full" };
    case "facility":
      return facilityInteraction(o, s);
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
      if (!m4) return { verb: "Check cargo locker" };
      return took(s, "cargo_locker") ? { verb: "Check cargo locker", detail: "Empty" } : { verb: "Open cargo locker" };
    case "baseTerminal":
      return m4 ? { verb: "Check base status" } : { verb: "Read base terminal", detail: "Waiting for a base override" };
    case "probeOut":
    case "probeIn": {
      const read = o.part === "probeOut" ? f.probeOutRead : f.probeInRead;
      if (!f.shelterInspected) return { verb: "Inspect probe", detail: "Wake the shelter monitor first" };
      return { verb: "Bark", detail: read ? "Reading taken" : "Take a reading" };
    }
    case "shelterTerminal":
      if (!bus) return { verb: "Inspect shelter monitor", detail: "No power: restore the battery" };
      if (!f.shelterInspected) return { verb: "Wake the shelter monitor" };
      if (!f.shelterRestored) {
        return f.probeOutRead && f.probeInRead ? { verb: "Log the readings" } : { verb: "Check shelter monitor", detail: "Bark at both probes" };
      }
      return { verb: "Check shelter monitor" };
    case "distConsole":
      if (!bus) return { verb: "Inspect power console", detail: "No battery: nothing to share out yet" };
      return { verb: "Open the power console", detail: hazeActive(s) ? "Balance the power!" : undefined };
    case "bed":
      return m4 ? { verb: "Rest", detail: "Recharges suit energy" } : null;
    case "storage":
      if (!m4) return null;
      return took(s, "habitat_storage") ? { verb: "Check storage", detail: "Spare blankets" } : { verb: "Open storage locker" };
    case "recycler":
      if (!f.recyclerInspected) return { verb: "Inspect recycler" };
      if (!f.recyclerFixed) return count(s, "recyclerPart") > 0 ? { verb: "Install the pump cartridge" } : { verb: "Inspect recycler", detail: "Pump cartridge missing" };
      if (!f.recyclerOn) return f.recyclerPowered ? { verb: "Start the recycler" } : { verb: "Start the recycler", detail: "Needs power: use the power box" };
      return { verb: "Check recycler", detail: "Recycling" };
    case "recyclerPower":
      if (!bus) return { verb: "Inspect power box", detail: "No power on the bus: restore the battery" };
      return f.recyclerPowered ? { verb: "Check power box", detail: "Connected" } : { verb: "Connect power" };
    case "growPower":
      if (!bus) return { verb: "Inspect grow-room power", detail: "No power on the bus: restore the battery" };
      return f.growPowered ? { verb: "Check grow-room power", detail: "Connected" } : { verb: "Connect grow-room power" };
    case "growValve":
      if (!f.waterRestored) return { verb: "Inspect water valve", detail: "No water in the pipes yet" };
      return f.growValveOpen ? { verb: "Check valve", detail: "Water flowing" } : { verb: "Open the water valve" };
    case "planter": {
      if (!f.seedsPlanted) {
        if (!f.growValveOpen) return { verb: "Inspect planter", detail: "Dry: needs water" };
        if (count(s, "seeds") <= 0) return { verb: "Inspect planter", detail: "Needs seeds" };
        return { verb: "Plant the seeds" };
      }
      if (!f.growLightsOn) return f.growPowered ? { verb: "Switch on the grow lights" } : { verb: "Switch on the grow lights", detail: "Needs grow-room power" };
      const st = plantStage(s);
      if (st >= 4 && !f.cropHarvested) return { verb: "Harvest the lettuce" };
      return { verb: "Check plants", detail: STAGE_NAMES[st] };
    }
    case "waterProcessor":
      if (f.waterRestored) return { verb: "Check water processor", detail: "Melting ice" };
      if (count(s, "waterCoupling") > 0) return bus ? { verb: "Install the melt-line coupling" } : { verb: "Install the melt-line coupling", detail: "Needs power: restore the battery" };
      return { verb: "Inspect water processor", detail: "Melt-line coupling missing" };
    case "seismometer":
      if (!f.canyonPostFixed) return { verb: "Inspect seismometer", detail: "No power: the recharge post is dead" };
      return f.seismometerRead ? { verb: "Check seismometer" } : { verb: "Read the seismometer" };
    case "deepProbe":
      return f.fissureSurveyed ? { verb: "Check survey probe" } : { verb: "Download the deep survey" };
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
      f.m4Briefed = true;
      recharge(s);
      fx.push({ type: "anim", name: "interact" }, { type: "transmission", id: "m4Brief" }, { type: "world", event: "m4Brief" });
      save();
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
        s.eng.battery = Math.min(ENGINEERING.batteryStart, capacity(mode));
        fx.push({ type: "world", event: "batteryRestored", objectId: o.id }, { type: "toast", text: "Battery station online! Spare solar power now charges it.", tone: "good" });
        tipOnce(s, "storage", fx);
        save();
      } else if (!f.batteryRestored) {
        fx.push({ type: "read", title: "BATTERY STATION", lines: ["Regulator: BURNT OUT. The battery cannot store power.", "A spare regulator should be in the ship's cargo locker."] });
        s.seen.includes("battery_inspected") || s.seen.push("battery_inspected");
      } else {
        fx.push({ type: "toast", text: `Battery ${Math.round((s.eng.battery / capacity(mode)) * 100)}%. Extra sunlight tops it up.` });
      }
      return fx;
    case "solarPanel":
      s.eng.dusty = s.eng.dusty.filter((p) => p !== o.id);
      fx.push({ type: "anim", name: "sweep" }, { type: "world", event: "panelClean", objectId: o.id });
      if (s.eng.dusty.length === 0 && f.lightsOutBalanced && !f.lightsOutDone) {
        f.lightsOutDone = true;
        s.eng.alloc = { water: true, greenhouse: true, research: true };
        fx.push({ type: "world", event: "lightsOutDone" }, { type: "toast", text: "Full power! Everything is back on.", tone: "good" });
        save();
      }
      return fx;
    case "sampler":
      fx.push({ type: "anim", name: "interact" });
      s.seen.push("took:drill_coupling");
      give(s, "waterCoupling", o.id, fx);
      fx.push({ type: "toast", text: "Spare melt-line coupling! The outpost's water processor needs it.", tone: "good" });
      save();
      return fx;
    case "recharge":
      if (o.broken && !f.canyonPostFixed) {
        fx.push({ type: "anim", name: "repair" });
        if (use(s, "powerCell")) {
          f.canyonPostFixed = true;
          fx.push({ type: "world", event: "postFixed", objectId: o.id }, { type: "toast", text: "The old post hums awake. The seismometer next to it lights up!", tone: "good" });
          save();
        } else {
          fx.push({ type: "toast", text: "The post's power cell is gone. Maybe the scanner can find a spare nearby.", tone: "info" });
        }
        return fx;
      }
      recharge(s);
      fx.push({ type: "anim", name: "interact" }, { type: "world", event: "recharge", objectId: o.id });
      tipOnce(s, "recharge", fx);
      return fx;
    case "facility":
      return performFacility(o, s, fx, save);
    default:
      return fx;
  }
}

function performFacility(o: WorldObject, s: GameState, fx: Effect[], save: () => void): Effect[] {
  const f = s.flags;
  const anim = (name: "interact" | "repair" | "celebrate" | "bark" | "sweep") => fx.push({ type: "anim", name });
  switch (o.part) {
    case "cargoLocker":
      anim("interact");
      if (!f.m4Briefed) {
        fx.push({ type: "toast", text: "Sealed spare parts for the outpost. Nothing needed right now." });
      } else if (!took(s, "cargo_locker")) {
        s.seen.push("took:cargo_locker");
        give(s, "regulator", o.id, fx);
        fx.push({ type: "toast", text: "A spare battery regulator! Back to the outpost's battery station.", tone: "good" });
        save();
      } else {
        fx.push({ type: "toast", text: "Empty now." });
      }
      return fx;
    case "baseTerminal":
      anim("interact");
      if (f.m4Briefed && !f.baseSurveyed) {
        f.baseSurveyed = true;
        save();
      }
      fx.push(f.m4Briefed ? { type: "ui", panel: "baseStatus" } : { type: "toast", text: "BASE TERMINAL: waiting for an override from the Ares Station." });
      return fx;
    case "probeOut":
    case "probeIn": {
      anim("bark");
      fx.push({ type: "sound", name: "woof" });
      if (!f.shelterInspected) {
        fx.push({ type: "toast", text: "The probe is asleep. The shelter monitor wakes it up." });
        return fx;
      }
      const outside = o.part === "probeOut";
      if (outside) f.probeOutRead = true;
      else f.probeInRead = true;
      fx.push(
        { type: "world", event: "probeRead", objectId: o.id },
        {
          type: "read",
          title: outside ? "SURFACE PROBE (outside)" : "SHELTER PROBE (inside)",
          lines: outside
            ? ["Bark received through the suit radio. Reading taken.", "Radiation level: 7 (fictional game units)", "Open sky above: nothing blocks the radiation."]
            : ["Bark received through the suit radio. Reading taken.", "Radiation level: 2 (fictional game units)", "Soil and thick walls above: much less gets through."],
        },
      );
      if (f.probeOutRead && f.probeInRead && !f.shelterRestored) fx.push({ type: "toast", text: "Both readings taken. Log them at the shelter monitor.", tone: "good" });
      save();
      return fx;
    }
    case "shelterTerminal":
      anim("interact");
      if (!f.batteryRestored) {
        fx.push({ type: "toast", text: "The monitor is dark. The battery station must be restored first.", tone: "warn" });
      } else if (!f.shelterInspected) {
        f.shelterInspected = true;
        fx.push(
          { type: "world", event: "shelterAwake", objectId: o.id },
          { type: "read", title: "SHELTER MONITOR", lines: ["Monitor online. Calibration needed:", "1. A reading OUTSIDE: the surface probe by the battery.", "2. A reading INSIDE: the probe in this shelter.", "The probes answer to your suit radio. Bark at them!"] },
        );
        save();
      } else if (!f.shelterRestored && f.probeOutRead && f.probeInRead) {
        f.shelterRestored = true;
        fx.push(
          { type: "world", event: "shelterOn", objectId: o.id },
          { type: "read", title: "SHELTER MONITOR // CALIBRATED", lines: ["Outside: 7. Inside: 2. (fictional game units)", "Soil and thick walls block much of the radiation.", "Shelter status: READY."] },
          { type: "toast", text: "Radiation shelter restored!", tone: "good" },
        );
        save();
      } else if (!f.shelterRestored) {
        fx.push({ type: "toast", text: `Readings: outside ${f.probeOutRead ? "done" : "needed"}, inside ${f.probeInRead ? "done" : "needed"}. Bark at the probes.` });
      } else {
        fx.push({ type: "read", title: "SHELTER MONITOR", lines: ["Outside: 7. Inside: 2. (fictional game units)", "Shelter status: READY. Rest here whenever you like."] });
      }
      return fx;
    case "distConsole":
      anim("interact");
      fx.push(f.batteryRestored ? { type: "ui", panel: "distribution" } : { type: "toast", text: "No battery yet, so there is no power to share out.", tone: "warn" });
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
        fx.push({ type: "toast", text: "A sealed seed container! Lettuce for the greenhouse.", tone: "good" });
        save();
      } else fx.push({ type: "toast", text: "Spare blankets and a squeaky toy. Very important." });
      return fx;
    case "recycler":
      if (!f.recyclerInspected) {
        anim("interact");
        f.recyclerInspected = true;
        fx.push({ type: "read", title: "LIFE SUPPORT RECYCLER", lines: ["Status: OFFLINE. Pump cartridge MISSING.", "Maintenance note: spare cartridges were buried in the maintenance bay when the dust storm hit.", "(Use your nose!)"] });
        save();
      } else if (!f.recyclerFixed) {
        anim("repair");
        if (use(s, "recyclerPart")) {
          f.recyclerFixed = true;
          fx.push({ type: "world", event: "recyclerFixed", objectId: o.id }, { type: "toast", text: "Cartridge in! Now the recycler needs power.", tone: "good" });
          save();
        } else fx.push({ type: "toast", text: "The pump cartridge is missing.", tone: "warn" });
      } else if (!f.recyclerOn) {
        anim("interact");
        if (!f.recyclerPowered) {
          fx.push({ type: "toast", text: "No power. Connect the power box next to it.", tone: "warn" });
        } else {
          f.recyclerOn = true;
          fx.push({ type: "world", event: "recyclerOn", objectId: o.id }, { type: "toast", text: "Life support online! The habitat lights warm up.", tone: "good" });
          tipOnce(s, "recycler", fx);
          save();
        }
      } else {
        anim("interact");
        fx.push({ type: "toast", text: f.waterRestored ? "Recycling air and water. The water loop is closed." : "Recycling air. It will share water once the water system runs." });
      }
      return fx;
    case "recyclerPower":
    case "growPower": {
      anim("repair");
      const key = o.part === "recyclerPower" ? "recyclerPowered" : "growPowered";
      if (!f.batteryRestored) {
        fx.push({ type: "toast", text: "No power on the bus. Restore the battery station first.", tone: "warn" });
      } else if (!f[key]) {
        f[key] = true;
        fx.push({ type: "world", event: o.part === "recyclerPower" ? "recyclerPowered" : "growPowered", objectId: o.id }, { type: "toast", text: "Connected! Power flows down the cable.", tone: "good" });
        save();
      } else fx.push({ type: "toast", text: "Connected." });
      return fx;
    }
    case "growValve":
      anim("interact");
      if (f.waterRestored && !f.growValveOpen) {
        f.growValveOpen = true;
        fx.push({ type: "world", event: "valveOpen", objectId: o.id }, { type: "toast", text: "Water trickles into the planter.", tone: "good" });
        save();
      } else if (!f.waterRestored) fx.push({ type: "toast", text: "The pipes are dry. Fix the water processor first.", tone: "warn" });
      else fx.push({ type: "toast", text: "Water flowing." });
      return fx;
    case "planter": {
      if (!f.seedsPlanted) {
        anim("interact");
        if (f.growValveOpen && use(s, "seeds")) {
          f.seedsPlanted = true;
          s.eng.growMs = 0;
          fx.push({ type: "world", event: "planted", objectId: o.id }, { type: "toast", text: "Seeds planted!", tone: "good" });
          tipOnce(s, "plants", fx);
          save();
        } else fx.push({ type: "toast", text: f.growValveOpen ? "Seeds needed: try the habitat's storage locker." : "The planter is dry. Open the water valve.", tone: "warn" });
        return fx;
      }
      if (!f.growLightsOn) {
        anim("interact");
        if (f.growPowered) {
          f.growLightsOn = true;
          fx.push({ type: "world", event: "growLights", objectId: o.id }, { type: "toast", text: "Grow lights on! Now the plants can grow.", tone: "good" });
          save();
        } else fx.push({ type: "toast", text: "No power. Connect the grow-room power box.", tone: "warn" });
        return fx;
      }
      if (plantStage(s) >= 4 && !f.cropHarvested) {
        f.cropHarvested = true;
        s.eng.growMs = ENGINEERING.growStageMs[0];
        anim("celebrate");
        fx.push({ type: "world", event: "harvest", objectId: o.id }, { type: "toast", text: "First harvest! Fresh lettuce grown on Mars. A new crop starts growing.", tone: "good" });
        save();
        return fx;
      }
      anim("interact");
      fx.push({ type: "toast", text: `${STAGE_NAMES[plantStage(s)]}. Plants need water, light and power to grow.` });
      return fx;
    }
    case "waterProcessor":
      if (f.waterRestored) {
        anim("interact");
        fx.push({ type: "toast", text: "Melting ice and pumping water to the tank, the recycler and the greenhouse." });
      } else if (count(s, "waterCoupling") > 0 && f.batteryRestored) {
        anim("repair");
        use(s, "waterCoupling");
        f.waterRestored = true;
        fx.push({ type: "world", event: "waterOn", objectId: o.id }, { type: "toast", text: "Water circulation restored! Water flows to the tank, the recycler and the greenhouse.", tone: "good" });
        save();
      } else {
        anim("interact");
        if (!s.seen.includes("water_inspected")) s.seen.push("water_inspected");
        fx.push({
          type: "read",
          title: "WATER PROCESSOR",
          lines: count(s, "waterCoupling") > 0
            ? ["Melt-line coupling ready.", "No power on the bus: restore the battery station first."]
            : ["Status: DRY. Melt-line coupling MISSING.", "The ice-chamber core drill in the Frozen Depths keeps a spare.", "Fastest way: the survey lift next to the workstation."],
        });
        save();
      }
      return fx;
    case "seismometer":
      anim("interact");
      if (!f.canyonPostFixed) {
        fx.push({ type: "toast", text: "No power. The recharge post next to it is dead.", tone: "warn" });
      } else if (!f.seismometerRead) {
        f.seismometerRead = true;
        s.inventory.recording = Math.min(99, s.inventory.recording + 1);
        fx.push(
          { type: "item", item: "recording", objectId: o.id, amount: 1 },
          { type: "world", event: "seismometer", objectId: o.id },
          { type: "read", title: "SEISMOMETER // CANYON STATION", lines: ["Recording saved: 214 small marsquakes since the crew left.", "Real science: NASA's InSight lander heard more than 1,300 marsquakes.", "(New journal entry: Marsquakes)"] },
        );
        save();
      } else fx.push({ type: "toast", text: "Listening to Mars. Quiet today." });
      return fx;
    case "deepProbe":
      anim("interact");
      if (!f.fissureSurveyed) {
        f.fissureSurveyed = true;
        s.inventory.sample = Math.min(99, s.inventory.sample + 1);
        fx.push(
          { type: "item", item: "sample", objectId: o.id, amount: 1 },
          { type: "world", event: "deepProbe", objectId: o.id },
          { type: "read", title: "DEEP SURVEY PROBE", lines: ["Deep ice core downloaded and a sample cylinder released.", "Layers of ice and dust, like the rings of a tree: a record of Mars' climate.", "(Simplified: real ice layers take thousands of years to form.)"] },
        );
        save();
      } else fx.push({ type: "toast", text: "The probe's work is done." });
      return fx;
    case "telescopeNorth":
      anim("interact");
      fx.push({ type: "read", title: "SURVEY TELESCOPE", lines: ["Far to the north, beyond the haze...", "a faint line of lights blinks on the horizon.", "Blink. Pause. Blink. As if it is waiting for someone."] });
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
