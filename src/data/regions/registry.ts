/**
 * The region registry: every map, every connection between maps, and global object lookups.
 *
 *            [Echo Ridge] ---- cable car (shortcut) ----.
 *                 |                                     |
 *            north access                               v
 *   [Ship][Outpost] ==== [Crimson Canyon] ==== [Ares Station]
 *          ^  survey lift (shortcut)                    | freight lift
 *          '------ [Frozen Depths: lift hall ... entrance] <-'
 *
 * Object ids are unique across all maps (tested), so saves can keep using plain ids.
 */
import type { GameState } from "../../systems/state";
import type { WorldObject } from "../world";
import { ECHO_RIDGE } from "./echoRidge";
import { FROZEN_DEPTHS } from "./frozenDepths";
import { SURFACE } from "./surface";
import type { Connection, ConnectionEnd, MapDef, MapId } from "./types";

export type { Connection, MapDef, MapId } from "./types";

export const MAPS: Record<MapId, MapDef> = { surface: SURFACE, depths: FROZEN_DEPTHS, ridge: ECHO_RIDGE };
export const MAP_IDS: MapId[] = ["surface", "depths", "ridge"];

export const CONNECTIONS: Connection[] = [
  {
    id: "freightLift",
    name: "Freight Lift",
    a: { map: "surface", object: "station_lift", arrive: "cp_station_lift", verb: "Lift down" },
    b: { map: "depths", object: "depths_freight", arrive: "cp_depths_freight", verb: "Lift up" },
    open: (s) => s.flags.m2Briefed,
    locked: { a: "Sealed. The signal console's relay logs hold the access code.", b: "" },
  },
  {
    id: "surveyLift",
    name: "Survey Lift",
    a: { map: "surface", object: "outpost_lift", arrive: "cp_outpost_lift", verb: "Lift down" },
    b: { map: "depths", object: "depths_lift", arrive: "cp_depths_lift", verb: "Lift up" },
    open: (s) => s.flags.depthsLiftOpen,
    locked: { a: "No power from below. Its motor is somewhere underground.", b: "No power. The junction is dead." },
    activate: {
      side: "b",
      ready: (s) => s.flags.circuitRestored,
      flag: "depthsLiftOpen",
      verb: "Start lift",
      notReady: "No power. The junction is dead.",
    },
    shortcut: true,
  },
  {
    id: "northGate",
    name: "North Access",
    a: { map: "depths", object: "depths_north", arrive: "cp_depths_north", verb: "Go north" },
    b: { map: "ridge", object: "ridge_hatch", arrive: "cp_ridge_hatch", verb: "Go down" },
    open: (s) => s.flags.relayAnalyzed,
    locked: { a: "NORTH ACCESS: sealed until the comms network authorises the ridge route.", b: "" },
  },
  {
    id: "skyline",
    name: "Cable Car",
    a: { map: "surface", object: "station_cable", arrive: "cp_station_cable", verb: "Cable car up" },
    b: { map: "ridge", object: "ridge_cable", arrive: "cp_ridge_tower", verb: "Cable car down" },
    open: (s) => s.flags.ridgeCableOpen,
    locked: { a: "Cable car offline. Its top station is somewhere up on the ridge.", b: "No power. The tower is dark." },
    activate: {
      side: "b",
      ready: (s) => s.flags.signalTraced,
      flag: "ridgeCableOpen",
      verb: "Start cable car",
      notReady: "No power. The tower console is still offline.",
    },
    shortcut: true,
  },
];

export const ALL_OBJECTS: WorldObject[] = MAP_IDS.flatMap((m) => MAPS[m].objects);

const OBJECT_MAP = new Map<string, { o: WorldObject; map: MapId }>();
for (const m of MAP_IDS) for (const o of MAPS[m].objects) OBJECT_MAP.set(o.id, { o, map: m });

export function findObject(id: string): WorldObject | undefined {
  return OBJECT_MAP.get(id)?.o;
}

export function mapOfObject(id: string): MapId | undefined {
  return OBJECT_MAP.get(id)?.map;
}

export function connectionById(id: string): Connection | undefined {
  return CONNECTIONS.find((c) => c.id === id);
}

/** For a transit object: its connection, which side it is on, and the far side. */
export function connectionFor(objectId: string): { c: Connection; side: "a" | "b"; here: ConnectionEnd; there: ConnectionEnd } | null {
  for (const c of CONNECTIONS) {
    if (c.a.object === objectId) return { c, side: "a", here: c.a, there: c.b };
    if (c.b.object === objectId) return { c, side: "b", here: c.b, there: c.a };
  }
  return null;
}

/** Map discovery: a map is "known" once Laika has been there. */
export function mapVisited(s: GameState, m: MapId): boolean {
  return s.discovered.maps.includes(m);
}
