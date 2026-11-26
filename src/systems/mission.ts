/**
 * Mission 01: A Signal in the Silence.
 *
 * The current objective is DERIVED from the state, never stored. That makes it impossible for
 * the objective text to get out of sync with what the player has actually done, and old or
 * edited saves always show a sensible next step.
 */
import { RECIPES } from "../data/items";
import { ALL_OBJECTS } from "../data/regions/registry";
import { OBJECTS } from "../data/world";
import { AIM_WORDS, networkReady, relayAligned } from "./puzzles";
import { chapterOfStage } from "./chapters";
import { count } from "./inventory";
import { allPanelsClean, SOLAR_PANELS, type GameState } from "./state";

export const MISSION_TITLE = "Mission 01: A Signal in the Silence";

export interface ObjectiveStep {
  text: string;
  done: boolean;
}

export interface Objective {
  /** Stable id of the stage (used for hints and tests). */
  stage: string;
  title: string;
  /** ONE actionable instruction: what to do and where. Shown in the collapsed HUD. */
  primary: string;
  /** The action used to do it (its key / button is shown next to the instruction). */
  action?: "interact" | "sniff" | "jump" | "move" | "bark";
  /** World object (or area marker) the primary instruction refers to, for hints and guidance. */
  target?: string;
  /** Full checklist, shown only when the mission panel is expanded. */
  steps: ObjectiveStep[];
  /** Optional goals, always presented separately from the main objective. */
  optional: ObjectiveStep[];
  /** Hint text (hint level 2). */
  hint: string;
  /** Phase 5: story chapter (0 prologue .. 5), or null during free exploration. Derived from the stage. */
  chapter?: number | null;
}

/** Optional goals: samples, the secret treat, Thruster Boots. Never required. */
export function optionalGoals(s: GameState): ObjectiveStep[] {
  const samples = OBJECTS.filter((o) => o.item === "sample").length;
  return [
    { text: `Geological samples (${Math.min(count(s, "sample"), samples)}/${samples})`, done: count(s, "sample") >= samples },
    { text: "Find the secret Golden Treat", done: s.collected.includes("treat") },
    { text: "Build Thruster Boots at the workstation", done: s.abilities.thrusters },
  ];
}

export function getObjective(s: GameState): Objective {
  const o = rawObjective(s);
  return { ...o, chapter: chapterOfStage(o.stage) };
}

function rawObjective(s: GameState): Objective {
  const f = s.flags;
  if (!f.hatchOpen && !f.checkedShipRadio) {
    return {
      stage: "radio",
      title: "Mission 01: A Signal in the Silence",
      primary: "Check the ship's radio",
      action: "interact",
      target: "shipRadio",
      steps: [{ text: "Check the ship's radio", done: false }],
      optional: [],
      hint: "The radio blinks on the left.",
    };
  }
  if (!f.hatchOpen) {
    return {
      stage: "hatch",
      title: "Mission 01: A Signal in the Silence",
      primary: "Open the hatch",
      action: "interact",
      target: "hatch",
      steps: [
        { text: "Check the ship's radio", done: true },
        { text: "Open the hatch", done: false },
      ],
      optional: [],
      hint: "Hop the crate. The door is on the right.",
    };
  }
  if (!f.inspectedReceiver) {
    return {
      stage: "receiver",
      title: "Mission 01: A Signal in the Silence",
      primary: "Find the radio dish",
      action: "interact",
      target: "receiver",
      steps: [{ text: "Find the outpost's comms receiver", done: false }],
      optional: [],
      hint: "Walk right, past the dome.",
    };
  }
  if (!f.commsOnline) {
    const metal = count(s, "metal");
    const elec = count(s, "electronics");
    const needM = RECIPES.solarRepair.metal ?? 0;
    const needE = RECIPES.solarRepair.electronics ?? 0;
    const swept = SOLAR_PANELS.filter((p) => s.sweptPanels.includes(p)).length;
    const hasModule = count(s, "commsModule") > 0;
    const steps: ObjectiveStep[] = [
      {
        text: f.solarRepaired
          ? "Repair the solar array"
          : `Repair the solar array (Metal ${Math.min(metal, needM)}/${needM}, Electronics ${Math.min(elec, needE)}/${needE})`,
        done: f.solarRepaired,
      },
      { text: `Sweep the dusty panels (${swept}/${SOLAR_PANELS.length})`, done: allPanelsClean(s) },
      {
        text: f.moduleInstalled ? "Install the comms module" : hasModule ? "Bring the comms module to the receiver" : "Find the missing comms module",
        done: f.moduleInstalled,
      },
    ];
    const ready = steps.every((st) => st.done);
    if (ready) steps.push({ text: "Tune the receiver", done: false });
    let hint = "Stand by the dish.";
    if (!f.solarRepaired && (metal < needM || elec < needE)) {
      hint = "Parts are buried east. Sniff!";
    } else if (!f.solarRepaired) {
      hint = "The solar box is left of the panels.";
    } else if (!allPanelsClean(s)) {
      hint = "Stand on a dusty panel.";
    } else if (!f.moduleInstalled && !hasModule) {
      hint = "Sniff near the rover wreck.";
    } else if (!f.moduleInstalled) {
      hint = "The dish is at the outpost.";
    }
    // Recommend ONE logical next step, without blocking other orders.
    let primary: string;
    let target: string;
    let action: Objective["action"] = "interact";
    if (ready) {
      primary = "Tune the radio";
      target = "receiver";
    } else if (!f.solarRepaired && metal >= needM && elec >= needE) {
      primary = "Fix the solar box";
      target = "solarControl";
    } else if (!f.solarRepaired) {
      primary = `Find spare parts: Metal ${Math.min(metal, needM)}/${needM} · Circuit ${Math.min(elec, needE)}/${needE}`;
      // Point at the first part still lying in the world that is actually needed.
      target =
        OBJECTS.find(
          (o) => !s.collected.includes(o.id) && ((o.item === "metal" && metal < needM) || (o.item === "electronics" && elec < needE)),
        )?.id ?? "receiver";
      action = "sniff";
    } else if (!allPanelsClean(s)) {
      primary = `Sweep the solar panels (${SOLAR_PANELS.length - swept} left)`;
      target = SOLAR_PANELS.find((p) => !s.sweptPanels.includes(p)) ?? "panel_1";
    } else if (hasModule) {
      primary = "Take the radio part to the dish";
      target = "receiver";
    } else {
      primary = "Find the radio part";
      target = "comms_module";
      action = "sniff";
    }
    return { stage: "restore", title: "Fix the radio", primary, action, target, steps, optional: optionalGoals(s), hint };
  }
  if (!f.bridgeExtended) {
    return {
      stage: "bridge",
      title: "Follow the signal east",
      primary: "Extend the canyon bridge",
      action: "interact",
      target: "bridgeControl",
      steps: [{ text: "Extend the canyon bridge", done: false }],
      optional: optionalGoals(s),
      hint: "East, past the rover. Climb the steps.",
    };
  }
  if (!f.reachedStation) {
    return {
      stage: "station",
      title: "Follow the signal east",
      primary: f.stationDoorOpen ? "Enter the station" : "Open the station door",
      action: "interact",
      target: "stationDoor",
      optional: optionalGoals(s),
      steps: [
        { text: "Extend the canyon bridge", done: true },
        { text: f.stationDoorOpen ? "Enter the research station" : "Open the research station door", done: false },
      ],
      hint: "Cross the bridge.",
    };
  }
  if (!f.demoComplete) {
    return {
      stage: "beacon",
      title: "Find the source of the signal",
      primary: "Trace the signal",
      action: "interact",
      target: "beacon",
      steps: [{ text: "Trace the signal at the station console", done: false }],
      optional: optionalGoals(s),
      hint: "The console is at the back.",
    };
  }
  const m23 = phase3Objective(s);
  if (m23) return m23;
  const samples = OBJECTS.filter((o) => o.item === "sample").length;
  return {
    stage: "complete",
    title: "Mission 01 complete!",
    primary: "Explore",
    optional: optionalGoals(s),
    steps: [
      { text: `Geological samples (${Math.min(count(s, "sample"), samples)}/${samples})`, done: count(s, "sample") >= samples },
      { text: "Find the secret Golden Treat", done: s.collected.includes("treat") },
    ],
    hint: "Boots reach high ledges.",
  };
}

/** Completion summary for the end card. */
export function completionStats(s: GameState): { samples: number; samplesTotal: number; treat: boolean; boots: boolean; minutes: number } {
  return {
    samples: count(s, "sample"),
    samplesTotal: OBJECTS.filter((o) => o.item === "sample").length,
    treat: s.collected.includes("treat"),
    boots: s.abilities.thrusters,
    minutes: Math.max(1, Math.round(s.playTimeMs / 60000)),
  };
}

// ---------------------------------------------------------------------------
// Phase 3: Mission 02 "Beneath the Red" and Mission 03 "Echoes Above"
// ---------------------------------------------------------------------------

export const MISSION_02 = "Mission 02: Beneath the Red";
export const MISSION_03 = "Mission 03: Echoes Above";

/** World-wide optional discoveries (Phase 3 journal). The drill's water-ice core counts as a sample. */
export function journal(s: GameState): Array<{ label: string; have: number; total: number }> {
  const total = (pred: (o: (typeof ALL_OBJECTS)[number]) => boolean) => ALL_OBJECTS.filter(pred).length;
  return [
    // +1 the drill's water-ice core (Phase 3), +1 the Ice Fissure's deep core (Phase 4).
    { label: "Geological samples", have: count(s, "sample"), total: total((o) => o.item === "sample") + 2 },
    { label: "Golden Treats", have: count(s, "treat"), total: total((o) => o.item === "treat") },
    // +1 the canyon seismometer's recording (Phase 4).
    { label: "Research recordings", have: count(s, "recording"), total: total((o) => o.item === "recording") + 1 },
    { label: "Rover R-2 parts", have: count(s, "roverPart"), total: total((o) => o.item === "roverPart") },
  ];
}

function optional23(s: GameState): ObjectiveStep[] {
  const j = journal(s).map((e) => ({ text: `${e.label} (${Math.min(e.have, e.total)}/${e.total})`, done: e.have >= e.total }));
  return [...j, { text: "Build Thruster Boots at the outpost workstation", done: s.abilities.thrusters }];
}

function m2Steps(s: GameState): ObjectiveStep[] {
  const f = s.flags;
  const cell = s.collected.includes("sampler");
  return [
    { text: "Check the relay logs at the station console", done: f.m2Briefed },
    { text: "Ride the freight lift down to the Frozen Depths", done: f.depthsReached },
    { text: "Fix the survey lamp (Headlamp)", done: s.abilities.headlamp },
    { text: "Follow the markers through the dark chamber", done: f.passageOpen },
    { text: "Find the power coupling and restore the circuit", done: f.circuitRestored },
    { text: "Recover the relay cell in the water-ice chamber", done: cell },
    { text: "Start the survey lift (shortcut)", done: f.depthsLiftOpen },
    { text: "Analyse the relay cell at the outpost receiver", done: f.relayAnalyzed },
  ];
}

function m3Steps(s: GameState): ObjectiveStep[] {
  const f = s.flags;
  return [
    { text: "Reach Echo Ridge through the North Access", done: f.ridgeReached },
    { text: "Restore Relay A △", done: f.relayASwept },
    { text: "Install the relay cell at Ridge Camp", done: f.cellInstalled },
    { text: "Align Relay B ○", done: relayAligned(s, "relay_b") },
    { text: "Find and align Relay C □", done: f.relayCFound && relayAligned(s, "relay_c") },
    { text: "Climb the relay tower and trace the signal", done: f.signalTraced },
    { text: "Start the cable car (shortcut)", done: f.ridgeCableOpen },
  ];
}

function phase3Objective(s: GameState): Objective | null {
  const f = s.flags;
  if (!f.demoComplete) return null;
  const opt = optional23(s);
  const m2 = (stage: string, primary: string, target: string | undefined, hint: string, action: Objective["action"] = "interact"): Objective => ({
    stage,
    title: MISSION_02,
    primary,
    action,
    target,
    steps: m2Steps(s),
    optional: opt,
    hint,
  });
  const m3 = (stage: string, primary: string, target: string | undefined, hint: string, action: Objective["action"] = "interact"): Objective => ({
    stage,
    title: MISSION_03,
    primary,
    action,
    target,
    steps: m3Steps(s),
    optional: opt,
    hint,
  });

  // Phase 5: the relay logs arrive by radio a moment after Mission 01 (chapters.autoAdvance); no console trip.
  if (!f.m2Briefed) return m2("m2_brief", "Listen to the radio", undefined, "A message is coming in.");
  if (!f.depthsReached) return m2("m2_descend", "Ride the lift down", "station_lift", "Under the catwalk.");
  if (!s.abilities.headlamp) return m2("m2_lamp", "Fix the lamp", "headlamp_kit", "On a crate by the lift.");
  if (!f.passageOpen) {
    return m2(
      "m2_light",
      "Follow the shining arrows",
      "light_sensor",
      "Your lamp makes them shine.",
    );
  }
  if (!f.circuitRestored) {
    if (s.inventory.coupling > 0) return m2("m2_install", "Fix the power box", "depths_junction", "Drop down the ice shelves.");
    if (!f.junctionInspected) return m2("m2_junction", "Find the power box", "depths_junction", "West, then down the shelves.");
    return m2("m2_coupling", "Sniff out the power part", "coupling_cache", "In the frost by the door.", "sniff");
  }
  if (!s.collected.includes("sampler")) {
    return m2("m2_drill", "Run the ice drill", "sampler", "Through the west door.");
  }
  if (!f.depthsLiftOpen) return m2("m2_lift", "Start the lift home", "depths_lift", "Keep going west.");
  if (!f.relayAnalyzed) {
    return m2("m2_analyse", "Take the cell to the radio", "receiver", "Ride the lift up.");
  }

  // ---------------- Mission 03 ----------------
  if (!f.ridgeReached) {
    return m3("m3_gate", "Go north through the tunnel", "depths_north", "Lift down, then the floor hatch.");
  }
  if (!f.relayASwept) return m3("m3_relayA", "Clean Relay A △", "relay_a", "By the path. Tail sweep!");
  if (!f.cellInstalled) {
    return m3("m3_cell", "Climb to Ridge Camp", "comms_junction", "Zigzag up the cliff.");
  }
  if (!networkReady(s)) {
    if (!relayAligned(s, "relay_b")) {
      return m3("m3_relayB", `Turn Relay B ○ to ${AIM_WORDS[3]}`, "relay_b", "East of the camp. Match the plaque.");
    }
    if (!f.relayCFound) {
      return m3("m3_findC", "Sniff for Relay C □", "relay_c", "Inside the big boulder.", "sniff");
    }
    if (!relayAligned(s, "relay_c")) {
      return m3("m3_relayC", `Turn Relay C □ to ${AIM_WORDS[4]}`, "relay_c", "Match the plaque.");
    }
  }
  if (!f.signalTraced) return m3("m3_trace", "Climb the tower", "tower_console", "Zigzag up the stairs.");
  if (!f.ridgeCableOpen) return m3("m3_cable", "Start the cable car", "ridge_cable", "East end of the top deck.");
  const m4 = mission04Objective(s, opt);
  if (m4) return m4;
  const m5 = mission05Objective(s, opt);
  if (m5) return m5;
  return {
    stage: "m3_complete",
    title: "Explore",
    primary: "Explore. The signal waits north",
    steps: [...m2Steps(s), ...m3Steps(s)],
    optional: opt,
    hint: "The map shows unexplored places.",
  };
}

// ---------------------------------------------------------------------------
// Phase 4: Mission 04 "A Place to Call Home"
// ---------------------------------------------------------------------------

export const MISSION_04 = "Mission 04: A Place to Call Home";

function m4Steps(s: GameState): ObjectiveStep[] {
  const f = s.flags;
  return [
    { text: "Answer the call at the Ares Station console", done: f.m4Briefed },
    { text: "Go home to the Landing Outpost", done: f.baseReturned || f.batteryRestored },
    { text: "Check the base status terminal", done: f.baseSurveyed || f.batteryRestored },
    { text: "Restore the Battery Station", done: f.batteryRestored },
    { text: "Restore the Life Support Recycler", done: f.recyclerOn },
    { text: "Restore water circulation", done: f.waterRestored },
    { text: "Wake the greenhouse and plant the first crop", done: f.seedsPlanted && f.growLightsOn },
    { text: "Restore the radiation shelter", done: f.shelterRestored },
    { text: "LIGHTS OUT: balance the power and clean the panels", done: f.lightsOutDone },
    { text: "See the restored outpost", done: f.m4Complete },
  ];
}

function m4Optional(s: GameState, base: ObjectiveStep[]): ObjectiveStep[] {
  const f = s.flags;
  return [
    { text: "Harvest the first lettuce", done: f.cropHarvested },
    { text: "Forgotten instrument: wake the canyon seismometer", done: f.seismometerRead },
    { text: "Deep survey: the Ice Fissure probe (Frozen Depths)", done: f.fissureSurveyed },
    { text: "High observation platform (Echo Ridge)", done: f.observatoryReached },
    ...base,
  ];
}

/**
 * One recommended next step at a time. Restoration tasks can be done in any sensible order: the
 * recommendation follows the first unfinished chain, and every chain's sub-steps are derived from
 * flags and items, so whatever the player did first is respected.
 */
function mission04Objective(s: GameState, baseOptional: ObjectiveStep[]): Objective | null {
  const f = s.flags;
  if (f.m4Complete) return null;
  const has = (item: Parameters<typeof count>[1]) => count(s, item) > 0;
  const m4 = (stage: string, primary: string, target: string | undefined, hint: string, action: Objective["action"] = "interact"): Objective => ({
    stage,
    title: MISSION_04,
    primary,
    action,
    target,
    steps: m4Steps(s),
    optional: m4Optional(s, baseOptional),
    hint,
  });
  // Phase 5: the station's call arrives by itself after Mission 03 (chapters.autoAdvance).
  if (!f.m4Briefed) return m4("m4_call", "Listen to the radio", undefined, "A call is coming in.");
  // Any base work already done means Laika is home.
  const working = f.batteryRestored || f.recyclerInspected || f.shelterInspected || has("regulator") || s.seen.includes("water_inspected");
  if (!f.baseReturned && !working) return m4("m4_home", "Go home to the outpost", "base_terminal", "Lifts are the fastest way.");
  // 1. Battery: everything on the lower level runs from it.
  if (!f.batteryRestored) {
    if (has("regulator")) return m4("m4_battery", "Fix the battery", "battery", "Between the panels and the dome.");
    return m4("m4_regulator", "Get the battery part", "cargo_locker", "In the ship's cargo locker.");
  }
  // 2. Life support (one press installs the pump and starts it).
  if (!f.recyclerOn) {
    if (has("recyclerPart") || f.recyclerFixed) return m4("m4_cartridge_in", "Fix life support", "recycler", "Down the habitat ladder.");
    return m4("m4_cartridge", "Dig up the pump", "buried_cartridge", "Sniff downstairs.", "sniff");
  }
  // 3. Water (installing the pipe connector also opens the grow-room valve).
  if (!f.waterRestored) {
    if (has("waterCoupling")) return m4("m4_water_in", "Fix the water pipe", "water_processor", "East end, downstairs.");
    return m4("m4_coupling", "Get the pipe connector", "sampler", "At the ice drill, down the lift.");
  }
  // 4. Greenhouse (planting also switches the lights on).
  if (!(f.seedsPlanted && f.growLightsOn)) {
    if (!f.seedsPlanted && !has("seeds")) return m4("m4_seeds", "Find seeds", "habitat_storage", "In the locker by the ladder.");
    if (!f.seedsPlanted) return m4("m4_plant", "Plant the seeds", "planter", "In the grow room.");
    return m4("m4_lights", "Turn on the grow lights", "planter", "At the planter.");
  }
  // 5. Shelter (the second probe reading finishes it).
  if (!f.shelterRestored) {
    if (!f.shelterInspected) return m4("m4_shelter", "Wake the shelter", "shelter_terminal", "West end, downstairs.");
    if (!f.probeInRead) return m4("m4_probe_in", "Bark at the inside probe", "probe_shelter", "Next to the monitor.", "bark");
    return m4("m4_probe_out", "Bark at the outside probe", "probe_surface", "Outside, by the battery.", "bark");
  }
  // 6. LIGHTS OUT.
  if (!f.lightsOutStarted) return m4("m4_wait", "Check on the base", "base_terminal", "Everything runs.");
  if (!f.lightsOutBalanced) return m4("m4_balance", "Share out the power", "dist_console", "Switch off the grow lights.");
  if (!f.lightsOutDone) return m4("m4_sweep", "Clean the dusty panels", s.eng.dusty[0] ?? "panel_1", "Tail sweep!", "interact");
  return m4("m4_look", "Step outside", "base_terminal", "Up the ladder.");
}

// ---------------------------------------------------------------------------
// Phase 5: Mission 05 "Built to Explore" (Chapter 5). Short: one blueprint, one build, one use.
// ---------------------------------------------------------------------------

export const MISSION_05 = "Mission 05: Built to Explore";

function mission05Objective(s: GameState, baseOptional: ObjectiveStep[]): Objective | null {
  const f = s.flags;
  if (f.m5Complete || !f.m4Complete) return null;
  const booster = s.gear.built.includes("booster");
  const steps: ObjectiveStep[] = [
    { text: "Check the workbench", done: f.m5Blueprint },
    { text: "Build the Signal Booster", done: booster },
    { text: "Find the lost Nav Beacon", done: f.beaconFound },
    { text: "Link the beacon at the radio", done: f.m5Complete },
  ];
  const m5 = (stage: string, primary: string, target: string | undefined, hint: string, action: Objective["action"] = "interact"): Objective => ({
    stage,
    title: MISSION_05,
    primary,
    action,
    target,
    steps,
    optional: baseOptional,
    hint,
  });
  if (!f.m5Briefed) return m5("m5_call", "Listen to the station", undefined, "A call is coming in.");
  if (!f.m5Blueprint) return m5("m5_bench", "Go to the workbench", "workstation", "At the outpost, by the radio.");
  if (!booster) {
    const cost = { metal: 2, electronics: 1 };
    const metal = count(s, "metal");
    const elec = count(s, "electronics");
    if (metal >= cost.metal && elec >= cost.electronics) return m5("m5_build", "Build the Signal Booster", "workstation", "Open the workbench.");
    const need = ALL_OBJECTS.find(
      (o) => !o.needs && !s.collected.includes(o.id) && ((o.item === "metal" && metal < cost.metal) || (o.item === "electronics" && elec < cost.electronics)) && ["metal_hab", "metal_lower", "elec_lower"].includes(o.id),
    );
    return m5("m5_parts", `Find parts: Metal ${Math.min(metal, cost.metal)}/${cost.metal} · Circuit ${Math.min(elec, cost.electronics)}/${cost.electronics}`, need?.id, "Spare parts are downstairs.");
  }
  if (!f.beaconFound && count(s, "navBeacon") <= 0) return m5("m5_beacon", "Sniff for the lost beacon", "beacon_cache", "Near the canyon entrance.", "sniff");
  return m5("m5_link", "Take the beacon to the radio", "receiver", "The big dish at the outpost.");
}
