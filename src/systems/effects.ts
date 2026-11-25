/**
 * Effects: what an interaction did, described as data for the scene to present.
 * Shared by systems/interactions.ts (Phases 1-2) and systems/puzzles.ts (Phase 3).
 */
import type { Cost, ItemId } from "../data/items";
import type { TIPS } from "../data/story";

export type WorldEvent =
  | "hatchOpen"
  | "solarRepaired"
  | "panelClean"
  | "powerOn"
  | "moduleInstalled"
  | "commsOnline"
  | "bridgeExtend"
  | "stationDoorOpen"
  | "thrusters"
  | "demoComplete"
  | "sniffUnlocked"
  | "practiceConsole"
  | "practiceCollected"
  | "practiceRepaired"
  | "echoSensor"
  | "roverBeep"
  // Phase 3
  | "headlamp"
  | "passageOpen"
  | "circuitOn"
  | "drill"
  | "liftStarted"
  | "cableStarted"
  | "relayOn"
  | "relayTurn"
  | "junctionOn"
  | "networkOnline"
  | "towerTrace"
  | "bridgeOut"
  | "freightUnlocked"
  | "locker"
  | "mission02Complete"
  | "mission03Complete";

export type AnimName = "interact" | "dig" | "sweep" | "celebrate" | "repair" | "bark";

export type Effect =
  | { type: "toast"; text: string; tone?: "info" | "good" | "warn" }
  | { type: "item"; item: ItemId; objectId: string; amount: number }
  | { type: "spend"; cost: Cost }
  | { type: "transmission"; id: string }
  | { type: "tip"; key: keyof typeof TIPS }
  | { type: "anim"; name: AnimName }
  | { type: "sound"; name: string }
  | { type: "world"; event: WorldEvent; objectId?: string }
  | { type: "focus"; objectId: string }
  | { type: "read"; title: string; lines: string[] }
  | { type: "save" }
  /** Phase 3: move to another map through a connection (lift, gate, cable car). */
  | { type: "travel"; connection: string; map: string; arrive: string };

export interface Interaction {
  verb: string;
  /** Extra line: a cost or the reason something cannot be done yet. */
  detail?: string;
}

export interface InteractionContext {
  /** Buried spots currently revealed by the scanner (runtime only, not saved). */
  revealed: ReadonlySet<string>;
}

