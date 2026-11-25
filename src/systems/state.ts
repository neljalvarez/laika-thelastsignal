/**
 * The simulation state of the adventure. Plain data only: no Phaser, no DOM.
 * Everything the player has achieved lives here, and this is exactly what is saved.
 */
import type { ItemId } from "../data/items";
import type { TutorialStageId } from "../data/tutorial";

/**
 * v1: Phase 1. v2: Phase 2 adds the Mission 00 tutorial record and the Bark ability.
 * v3: Phase 3 adds Missions 02-03 flags, the Headlamp, new items, map discovery and puzzle state.
 */
export const STATE_VERSION = 3;

export type FlagId =
  | "checkedShipRadio"
  | "hatchOpen"
  | "reachedOutpost"
  | "inspectedReceiver"
  | "solarRepaired"
  | "moduleInstalled"
  | "commsOnline"
  | "bridgeExtended"
  | "stationDoorOpen"
  | "reachedStation"
  | "demoComplete"
  // Phase 3 - Mission 02: Beneath the Red
  | "m2Briefed"
  | "depthsReached"
  | "passageOpen"
  | "junctionInspected"
  | "circuitRestored"
  | "iceChamberReached"
  | "depthsLiftOpen"
  | "relayAnalyzed"
  | "lockerOpened"
  // Phase 3 - Mission 03: Echoes Above
  | "ridgeReached"
  | "relayASwept"
  | "cellInstalled"
  | "relayCFound"
  | "relayNetworkOnline"
  | "towerReached"
  | "signalTraced"
  | "ridgeCableOpen"
  | "ridgeBridgeOut";

export const ALL_FLAGS: FlagId[] = [
  "checkedShipRadio",
  "hatchOpen",
  "reachedOutpost",
  "inspectedReceiver",
  "solarRepaired",
  "moduleInstalled",
  "commsOnline",
  "bridgeExtended",
  "stationDoorOpen",
  "reachedStation",
  "demoComplete",
  "m2Briefed",
  "depthsReached",
  "passageOpen",
  "junctionInspected",
  "circuitRestored",
  "iceChamberReached",
  "depthsLiftOpen",
  "relayAnalyzed",
  "lockerOpened",
  "ridgeReached",
  "relayASwept",
  "cellInstalled",
  "relayCFound",
  "relayNetworkOnline",
  "towerReached",
  "signalTraced",
  "ridgeCableOpen",
  "ridgeBridgeOut",
];

export type AbilityId = "sniff" | "sweep" | "thrusters" | "bark" | "headlamp";

export type TutorialStatus = "active" | "done" | "skipped";

export interface GameState {
  version: number;
  flags: Record<FlagId, boolean>;
  inventory: Record<ItemId, number>;
  /** Ids of world pickups / buried items already collected. They never respawn. */
  collected: string[];
  abilities: Record<AbilityId, boolean>;
  /** Solar panels already swept clean. */
  sweptPanels: string[];
  /** Signs, logs and samples read, and one-time tips already shown. */
  seen: string[];
  checkpoint: string;
  visitedCheckpoints: string[];
  playTimeMs: number;
  /**
   * Mission 00. Only the first play-through is recorded here; replays use an isolated
   * TutorialState that is never saved, so they cannot touch the campaign.
   */
  tutorial: { status: TutorialStatus; stage: TutorialStageId };
  /**
   * Phase 3 world map. Maps visited, map sections explored and landmarks seen. The current map is
   * not stored separately: it is always the map of `checkpoint` (lifts set it on arrival), so a
   * save can never place Laika in one map with a checkpoint in another.
   */
  discovered: { maps: string[]; sections: string[]; landmarks: string[] };
  /** Phase 3 puzzle state that is not a simple flag: relay dish directions (0 left ... 4 right). */
  puzzles: { relayAim: Record<string, number> };
}

/** Starting directions of the turnable relay dishes (Relay A is pre-aimed; it only needs sweeping). */
export const RELAY_START_AIM: Record<string, number> = { relay_a: 3, relay_b: 0, relay_c: 1 };

export function createNewState(): GameState {
  const flags = {} as Record<FlagId, boolean>;
  for (const f of ALL_FLAGS) flags[f] = false;
  return {
    version: STATE_VERSION,
    flags,
    inventory: { metal: 0, electronics: 0, commsModule: 0, sample: 0, treat: 0, coupling: 0, relayCell: 0, recording: 0, roverPart: 0 },
    collected: [],
    abilities: { sniff: false, sweep: true, thrusters: false, bark: true, headlamp: false },
    sweptPanels: [],
    seen: [],
    checkpoint: "cp_ship",
    visitedCheckpoints: ["cp_ship"],
    playTimeMs: 0,
    tutorial: { status: "active", stage: "wake" },
    discovered: { maps: ["surface"], sections: [], landmarks: [] },
    puzzles: { relayAim: { ...RELAY_START_AIM } },
  };
}

export const SOLAR_PANELS = ["panel_1", "panel_2", "panel_3"];

export function allPanelsClean(s: GameState): boolean {
  return SOLAR_PANELS.every((p) => s.sweptPanels.includes(p));
}

/** The outpost has power once the array is repaired and every panel is clean. */
export function isPowered(s: GameState): boolean {
  return s.flags.solarRepaired && allPanelsClean(s);
}

export function cloneState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s)) as GameState;
}
