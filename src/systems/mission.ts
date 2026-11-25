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
  /** Stable id of the stage (used for idle hints and tests). */
  stage: string;
  title: string;
  steps: ObjectiveStep[];
  /** Optional hint shown on request or after the player has been idle a while. */
  hint: string;
}

export function getObjective(s: GameState): Objective {
  const f = s.flags;
  if (!f.hatchOpen && !f.checkedShipRadio) {
    return {
      stage: "radio",
      title: "Wake up, Laika",
      steps: [{ text: "Check the ship's radio", done: false }],
      hint: "Walk with A / D or the arrow keys. Stand by the blinking radio and press Interact.",
    };
  }
  if (!f.hatchOpen) {
    return {
      stage: "hatch",
      title: "Get out of the ship",
      steps: [{ text: "Jump over the crate and open the hatch", done: false }],
      hint: "Press Jump to hop over the crate. The hatch is at the right end of the ship.",
    };
  }
  if (!f.inspectedReceiver) {
    return {
      stage: "receiver",
      title: "Find a working radio",
      steps: [{ text: "Find the outpost's comms receiver", done: false }],
      hint: "Head right. The receiver is the big dish past the habitat dome.",
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
    return { stage: "restore", title: "Restore the outpost radio", steps, hint };
  }
  if (!f.bridgeExtended) {
    return {
      stage: "bridge",
      title: "Follow the signal east",
      steps: [{ text: "Extend the canyon bridge", done: false }],
      hint: "Cross Crimson Canyon past the rover. The bridge control is on the east rim.",
    };
  }
  if (!f.reachedStation) {
    return {
      stage: "station",
      title: "Follow the signal east",
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
      steps: [{ text: "Trace the signal at the station console", done: false }],
      hint: "The signal console is at the far end of the station.",
    };
  }
  const samples = OBJECTS.filter((o) => o.item === "sample").length;
  return {
    stage: "complete",
    title: "Mission 01 complete!",
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
