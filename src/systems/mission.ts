/**
 * Mission 01: A Signal in the Silence.
 *
 * The current objective is DERIVED from the state, never stored. That makes it impossible for
 * the objective text to get out of sync with what the player has actually done, and old or
 * edited saves always show a sensible next step.
 */
import { RECIPES } from "../data/items";
import { OBJECTS } from "../data/world";
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
