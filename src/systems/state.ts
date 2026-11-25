/**
 * The simulation state of the adventure. Plain data only: no Phaser, no DOM.
 * Everything the player has achieved lives here, and this is exactly what is saved.
 */
import type { ItemId } from "../data/items";
import type { TutorialStageId } from "../data/tutorial";

/** v1: Phase 1. v2: Phase 2 adds the Mission 00 tutorial record and the Bark ability. */
export const STATE_VERSION = 2;

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
  | "demoComplete";

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
];

export type AbilityId = "sniff" | "sweep" | "thrusters" | "bark";

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
}

export function createNewState(): GameState {
  const flags = {} as Record<FlagId, boolean>;
  for (const f of ALL_FLAGS) flags[f] = false;
  return {
    version: STATE_VERSION,
    flags,
    inventory: { metal: 0, electronics: 0, commsModule: 0, sample: 0, treat: 0 },
    collected: [],
    abilities: { sniff: false, sweep: true, thrusters: false, bark: true },
    sweptPanels: [],
    seen: [],
    checkpoint: "cp_ship",
    visitedCheckpoints: ["cp_ship"],
    playTimeMs: 0,
    tutorial: { status: "active", stage: "wake" },
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
