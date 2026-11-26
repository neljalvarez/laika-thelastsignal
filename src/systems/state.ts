/**
 * The simulation state of the adventure. Plain data only: no Phaser, no DOM.
 * Everything the player has achieved lives here, and this is exactly what is saved.
 */
import type { ItemId } from "../data/items";
import type { TutorialStageId } from "../data/tutorial";
import type { CosmeticId, EquipmentId } from "../data/equipment";

/**
 * v1: Phase 1. v2: Phase 2 adds the Mission 00 tutorial record and the Bark ability.
 * v3: Phase 3 adds Missions 02-03 flags, the Headlamp, new items, map discovery and puzzle state.
 * v4: Phase 4 adds Mission 04 and the outpost's engineering: restoration flags (permanent), the
 *     `eng` operating conditions (temporary: battery charge, power allocation, greenhouse growth,
 *     suit energy, Lights Out dust) and the science journal.
 * v5: Phase 5 adds Chapter 5 (Mission 05) flags, the workbench `gear` (built equipment, known
 *     blueprints, chosen cosmetics) and the Nav Beacon item.
 */
export const STATE_VERSION = 5;

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
  | "ridgeBridgeOut"
  // Phase 4 - Mission 04: A Place to Call Home (permanent restoration milestones)
  | "m4Briefed"
  | "baseReturned"
  | "baseSurveyed"
  | "batteryRestored"
  | "recyclerInspected"
  | "recyclerFixed"
  | "recyclerPowered"
  | "recyclerOn"
  | "waterRestored"
  | "growPowered"
  | "growValveOpen"
  | "seedsPlanted"
  | "growLightsOn"
  | "cropHarvested"
  | "shelterInspected"
  | "probeOutRead"
  | "probeInRead"
  | "shelterRestored"
  | "lightsOutStarted"
  | "lightsOutBalanced"
  | "lightsOutDone"
  | "m4Complete"
  | "canyonPostFixed"
  | "seismometerRead"
  | "fissureSurveyed"
  | "observatoryReached"
  // Phase 5 - Mission 05: Built to Explore
  | "m5Briefed"
  | "m5Blueprint"
  | "beaconFound"
  | "m5Complete";

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
  "m4Briefed",
  "baseReturned",
  "baseSurveyed",
  "batteryRestored",
  "recyclerInspected",
  "recyclerFixed",
  "recyclerPowered",
  "recyclerOn",
  "waterRestored",
  "growPowered",
  "growValveOpen",
  "seedsPlanted",
  "growLightsOn",
  "cropHarvested",
  "shelterInspected",
  "probeOutRead",
  "probeInRead",
  "shelterRestored",
  "lightsOutStarted",
  "lightsOutBalanced",
  "lightsOutDone",
  "m4Complete",
  "canyonPostFixed",
  "seismometerRead",
  "fissureSurveyed",
  "observatoryReached",
  "m5Briefed",
  "m5Blueprint",
  "beaconFound",
  "m5Complete",
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
  /**
   * Phase 4 operating conditions. These change while playing and are NOT achievements: a flat
   * battery or a dusty panel never undoes a restoration flag or a mission.
   */
  eng: EngState;
  /** Phase 4 science journal: ids of unlocked entries (data/science.ts). */
  science: string[];
  /** Phase 5 workbench: equipment built, blueprints known, cosmetics worn. */
  gear: GearState;
}

export interface GearState {
  /** Built equipment (Thruster Boots stay in `abilities.thrusters` as in Phases 1-4). */
  built: EquipmentId[];
  /** Blueprints shown at the workbench. */
  blueprints: EquipmentId[];
  /** Cosmetics Laika is wearing (only unlocked ones count). */
  wear: CosmeticId[];
}

export function createGearState(): GearState {
  return { built: [], blueprints: ["boots"], wear: [] };
}

export interface EngState {
  /** Stored energy in BU (0 .. capacity). */
  battery: number;
  /** Optional systems switched on at the distribution console. */
  alloc: { water: boolean; greenhouse: boolean; research: boolean };
  /** Greenhouse: active-play ms of growth so far. */
  growMs: number;
  /** Suit energy (0 .. 100). */
  suit: number;
  /** Panels covered by the Lights Out dust (separate from Phase 1's swept panels). */
  dusty: string[];
}

export function createEngState(): EngState {
  return { battery: 0, alloc: { water: true, greenhouse: true, research: true }, growMs: 0, suit: 100, dusty: [] };
}

/** Starting directions of the turnable relay dishes (Relay A is pre-aimed; it only needs sweeping). */
export const RELAY_START_AIM: Record<string, number> = { relay_a: 3, relay_b: 0, relay_c: 1 };

export function createNewState(): GameState {
  const flags = {} as Record<FlagId, boolean>;
  for (const f of ALL_FLAGS) flags[f] = false;
  return {
    version: STATE_VERSION,
    flags,
    inventory: { metal: 0, electronics: 0, commsModule: 0, sample: 0, treat: 0, coupling: 0, relayCell: 0, recording: 0, roverPart: 0, regulator: 0, recyclerPart: 0, waterCoupling: 0, seeds: 0, powerCell: 0, navBeacon: 0 },
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
    eng: createEngState(),
    science: [],
    gear: createGearState(),
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

/** Phase 5: an object marked `needs: <equipment>` only exists for Laika once that gear is built. */
export function gearReady(s: GameState, needs: string | undefined): boolean {
  if (!needs) return true;
  if (needs === "boots") return s.abilities.thrusters;
  return !!s.gear?.built.includes(needs as EquipmentId);
}
