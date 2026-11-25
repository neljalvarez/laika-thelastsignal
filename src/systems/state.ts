/**
 * The simulation state of the adventure. Plain data only: no Phaser, no DOM.
 * Everything the player has achieved lives here, and this is exactly what is saved.
 */
import type { ItemId } from "../data/items";

export const STATE_VERSION = 1;

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

export type AbilityId = "sniff" | "sweep" | "thrusters";

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
}

export function createNewState(): GameState {
  const flags = {} as Record<FlagId, boolean>;
  for (const f of ALL_FLAGS) flags[f] = false;
  return {
    version: STATE_VERSION,
    flags,
    inventory: { metal: 0, electronics: 0, commsModule: 0, sample: 0, treat: 0 },
    collected: [],
    abilities: { sniff: false, sweep: true, thrusters: false },
    sweptPanels: [],
    seen: [],
    checkpoint: "cp_ship",
    visitedCheckpoints: ["cp_ship"],
    playTimeMs: 0,
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
