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
  action?: "interact" | "sniff" | "jump" | "move";
  /** World object (or area marker) the primary instruction refers to, for hints and guidance. */
  target?: string;
  /** Full checklist, shown only when the mission panel is expanded. */
  steps: ObjectiveStep[];
  /** Optional goals, always presented separately from the main objective. */
  optional: ObjectiveStep[];
  /** Hint text (hint level 2). */
  hint: string;
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
  const f = s.flags;
  if (!f.hatchOpen && !f.checkedShipRadio) {
    return {
      stage: "radio",
      title: "Mission 01: A Signal in the Silence",
      primary: "Check the ship's radio, on the left of the lower deck.",
      action: "interact",
      target: "shipRadio",
      steps: [{ text: "Check the ship's radio", done: false }],
      optional: [],
      hint: "Walk left to the blinking radio and press Interact.",
    };
  }
  if (!f.hatchOpen) {
    return {
      stage: "hatch",
      title: "Mission 01: A Signal in the Silence",
      primary: "Open the hatch at the right end of the ship.",
      action: "interact",
      target: "hatch",
      steps: [
        { text: "Check the ship's radio", done: true },
        { text: "Open the hatch", done: false },
      ],
      optional: [],
      hint: "Hop over the cargo crate and walk to the striped door on the right.",
    };
  }
  if (!f.inspectedReceiver) {
    return {
      stage: "receiver",
      title: "Mission 01: A Signal in the Silence",
      primary: "Head east to the outpost and inspect the big radio dish.",
      action: "interact",
      target: "receiver",
      steps: [{ text: "Find the outpost's comms receiver", done: false }],
      optional: [],
      hint: "Walk right, past the solar panels and the dome. The dish is on a tall mast.",
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
    let hint = "Stand by the receiver and press Interact to tune in.";
    if (!f.solarRepaired && (metal < needM || elec < needE)) {
      hint = "Parts are buried in Crimson Canyon, east of the outpost. Press Sniff and follow the arrows.";
    } else if (!f.solarRepaired) {
      hint = "You have the parts! Go to the solar array's control box, left of the panels.";
    } else if (!allPanelsClean(s)) {
      hint = "Stand on each dusty panel and press Interact to sweep it with your tail.";
    } else if (!f.moduleInstalled && !hasModule) {
      hint = "Rover R-2 was carrying the module. Follow the canyon east and sniff near the rover.";
    } else if (!f.moduleInstalled) {
      hint = "Take the module back to the comms receiver dish at the outpost.";
    }
    // Recommend ONE logical next step, without blocking other orders.
    let primary: string;
    let target: string;
    let action: Objective["action"] = "interact";
    if (ready) {
      primary = "Everything is fixed! Tune the radio dish.";
      target = "receiver";
    } else if (!f.solarRepaired && metal >= needM && elec >= needE) {
      primary = "You have the parts! Repair the solar array's control box.";
      target = "solarControl";
    } else if (!f.solarRepaired) {
      primary = `Find spare parts (Metal ${Math.min(metal, needM)}/${needM}, Electronics ${Math.min(elec, needE)}/${needE}): sniff east of the outpost.`;
      // Point at the first part still lying in the world that is actually needed.
      target =
        OBJECTS.find(
          (o) => !s.collected.includes(o.id) && ((o.item === "metal" && metal < needM) || (o.item === "electronics" && elec < needE)),
        )?.id ?? "receiver";
      action = "sniff";
    } else if (!allPanelsClean(s)) {
      primary = `Sweep the dusty solar panels with your tail (${SOLAR_PANELS.length - swept} left).`;
      target = SOLAR_PANELS.find((p) => !s.sweptPanels.includes(p)) ?? "panel_1";
    } else if (hasModule) {
      primary = "Carry the comms module back to the radio dish.";
      target = "receiver";
    } else {
      primary = "Find the missing comms module near the rover wreck in Crimson Canyon.";
      target = "comms_module";
      action = "sniff";
    }
    return { stage: "restore", title: "Restore the outpost radio", primary, action, target, steps, optional: optionalGoals(s), hint };
  }
  if (!f.bridgeExtended) {
    return {
      stage: "bridge",
      title: "Follow the signal east",
      primary: "Cross Crimson Canyon to the east rim and extend the bridge.",
      action: "interact",
      target: "bridgeControl",
      steps: [{ text: "Extend the canyon bridge", done: false }],
      optional: optionalGoals(s),
      hint: "Go past the rover wreck and climb the steps. The yellow bridge control is at the edge of the chasm.",
    };
  }
  if (!f.reachedStation) {
    return {
      stage: "station",
      title: "Follow the signal east",
      primary: f.stationDoorOpen ? "Go inside the research station." : "Cross the bridge and open the research station door.",
      action: "interact",
      target: "stationDoor",
      optional: optionalGoals(s),
      steps: [
        { text: "Extend the canyon bridge", done: true },
        { text: f.stationDoorOpen ? "Enter the research station" : "Open the research station door", done: false },
      ],
      hint: "Cross the bridge. The station door opens now that the radio has the handshake code.",
    };
  }
  if (!f.demoComplete) {
    return {
      stage: "beacon",
      title: "Find the source of the signal",
      primary: "Trace the signal at the console at the back of the station.",
      action: "interact",
      target: "beacon",
      steps: [{ text: "Trace the signal at the station console", done: false }],
      optional: optionalGoals(s),
      hint: "Walk to the far right end of the station. The console has a ring antenna on top.",
    };
  }
  const m23 = phase3Objective(s);
  if (m23) return m23;
  const samples = OBJECTS.filter((o) => o.item === "sample").length;
  return {
    stage: "complete",
    title: "Mission 01 complete!",
    primary: "Explore freely: there are still secrets on this hill.",
    optional: optionalGoals(s),
    steps: [
      { text: `Geological samples (${Math.min(count(s, "sample"), samples)}/${samples})`, done: count(s, "sample") >= samples },
      { text: "Find the secret Golden Treat", done: s.collected.includes("treat") },
    ],
    hint: "Explore freely! Thruster Boots from the workstation reach a high ledge on the mesa.",
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
    { label: "Geological samples", have: count(s, "sample"), total: total((o) => o.item === "sample") + 1 },
    { label: "Golden Treats", have: count(s, "treat"), total: total((o) => o.item === "treat") },
    { label: "Research recordings", have: count(s, "recording"), total: total((o) => o.item === "recording") },
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

  if (!f.m2Briefed) return m2("m2_brief", "Ares Station: check the relay logs at the signal console.", "beacon", "The ring-antenna console at the back of the station has more to say.");
  if (!f.depthsReached) return m2("m2_descend", "Ares Station: ride the freight lift down to the survey caves.", "station_lift", "The freight lift is under the catwalk inside the station.");
  if (!s.abilities.headlamp) return m2("m2_lamp", "Frozen Depths: fix the survey lamp by the entrance.", "headlamp_kit", "The lamp sits on a crate right next to where the freight lift stops.");
  if (!f.passageOpen) {
    return m2(
      "m2_light",
      "Frozen Depths: follow the shining markers to the light sensor in the dark chamber.",
      "light_sensor",
      "In the dark chamber, take the lower walkway west. Your headlamp makes the arrows shine; shine it on the sensor by the shutter.",
    );
  }
  if (!f.circuitRestored) {
    if (s.inventory.coupling > 0) return m2("m2_install", "Frozen Depths: install the power coupling in the junction below the equipment room.", "depths_junction", "Drop down the shelves at the west end of the equipment room.");
    if (!f.junctionInspected) return m2("m2_junction", "Frozen Depths: find the power junction below the equipment room.", "depths_junction", "Past the shutter, go west through the equipment room and climb down the ice shelves.");
    return m2("m2_coupling", "Frozen Depths: sniff out the spare power coupling in the equipment room.", "coupling_cache", "The crew note says it's in the frost by the door. Sniff near the warm lamp.", "sniff");
  }
  if (!s.collected.includes("sampler")) {
    return m2("m2_drill", "Frozen Depths: run the core drill in the water-ice chamber.", "sampler", "The door at the west end of the junction hall has power now.");
  }
  if (!f.depthsLiftOpen) return m2("m2_lift", "Frozen Depths: start the survey lift in the lift hall, west of the ice chamber.", "depths_lift", "Keep going west past the core drill.");
  if (!f.relayAnalyzed) {
    return m2("m2_analyse", "Landing Outpost: analyse the relay cell at the comms receiver.", "receiver", "Ride the survey lift up: it comes out right next to the outpost workstation.");
  }

  // ---------------- Mission 03 ----------------
  if (!f.ridgeReached) {
    return m3("m3_gate", "Frozen Depths: take the service tunnel east to the North Access.", "depths_north", "Ride the survey lift down. The service hatch in the lift hall floor drops into the tunnel.");
  }
  if (!f.relayASwept) return m3("m3_relayA", "Echo Ridge: sweep the dust off Relay A △.", "relay_a", "Relay A stands by the path, just past the camp sign. Use your tail!");
  if (!f.cellInstalled) {
    return m3("m3_cell", "Echo Ridge: climb to Ridge Camp and install the relay cell in the junction.", "comms_junction", "Zigzag up the ledges on the cliff. The camp is on top.");
  }
  if (!networkReady(s)) {
    if (!relayAligned(s, "relay_b")) {
      return m3("m3_relayB", `Echo Ridge: turn Relay B ○ until its dish points ${AIM_WORDS[3]}, like its plaque.`, "relay_b", "Relay B is on the metal antenna platform east of Ridge Camp.");
    }
    if (!f.relayCFound) {
      return m3("m3_findC", "Echo Ridge: Relay C □ is hidden. Sniff to follow its faint signal.", "relay_c", "Sniff on the cliff climb: the signal comes from inside the big boulder.", "sniff");
    }
    if (!relayAligned(s, "relay_c")) {
      return m3("m3_relayC", `Echo Ridge: turn Relay C □ until its dish points ${AIM_WORDS[4]}, like its plaque.`, "relay_c", "Relay C is in the niche inside the boulder.");
    }
  }
  if (!f.signalTraced) return m3("m3_trace", "Echo Ridge: climb the relay tower and trace the signal at the top.", "tower_console", "The tower door is open. Zigzag up the stairs inside.");
  if (!f.ridgeCableOpen) return m3("m3_cable", "Echo Ridge: start the cable car at the top of the tower.", "ridge_cable", "The cable car station is at the east end of the tower's top deck.");
  return {
    stage: "m3_complete",
    title: "Missions complete!",
    primary: "Explore freely. The signal waits in the north...",
    steps: [...m2Steps(s), ...m3Steps(s)],
    optional: opt,
    hint: "Use the map (M) to find areas you have not explored yet. Shortcuts: survey lift and cable car.",
  };
}
