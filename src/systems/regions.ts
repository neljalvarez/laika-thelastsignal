/**
 * Pure rules for the multi-map world: where Laika is (section / region), what she discovers,
 * which connections are open, and how to get from one map to another (used by hints and the map).
 */
import { CONNECTIONS, connectionFor, findObject, MAP_IDS, MAPS, mapOfObject, type MapId } from "../data/regions/registry";
import type { Landmark, Section } from "../data/regions/types";
import type { WorldObject } from "../data/world";
import type { Effect, Interaction } from "./effects";
import type { FlagId, GameState } from "./state";

const inRect = (c: number, r: number, x: { x0: number; x1: number; y0: number; y1: number }) => c >= x.x0 && c <= x.x1 && r >= x.y0 && r <= x.y1;

/** The section containing a standing cell (first match wins: specific sections are listed first). */
export function sectionAt(map: MapId, col: number, row: number): Section | null {
  return MAPS[map].sections.find((s) => inRect(col, row, s.rect)) ?? null;
}

export function sectionById(id: string): { map: MapId; section: Section } | null {
  for (const m of MAP_IDS) {
    const section = MAPS[m].sections.find((s) => s.id === id);
    if (section) return { map: m, section };
  }
  return null;
}

export interface Discovery {
  sections: Section[];
  landmarks: Landmark[];
  /** Flags set because Laika reached a place (e.g. the ice chamber, the tower). */
  flags: FlagId[];
}

/** Flags that are set simply by arriving somewhere. */
const ARRIVAL_FLAGS: Record<string, FlagId> = {
  d_ice: "iceChamberReached",
  r_tower: "towerReached",
  r_niche: "relayCFound",
};

/**
 * Updates discovery for Laika standing at (col,row) of `map`. Mutates `s`. Idempotent: calling it
 * again in the same place returns nothing new.
 */
export function discover(s: GameState, map: MapId, col: number, row: number): Discovery {
  const out: Discovery = { sections: [], landmarks: [], flags: [] };
  if (!s.discovered.maps.includes(map)) s.discovered.maps.push(map);
  const sec = sectionAt(map, col, row);
  if (sec && !s.discovered.sections.includes(sec.id)) {
    s.discovered.sections.push(sec.id);
    out.sections.push(sec);
  }
  for (const lm of MAPS[map].landmarks) {
    if (!s.discovered.landmarks.includes(lm.id) && inRect(col, row, lm.seenFrom)) {
      s.discovered.landmarks.push(lm.id);
      out.landmarks.push(lm);
    }
  }
  const flag = sec ? ARRIVAL_FLAGS[sec.id] : undefined;
  if (flag && !s.flags[flag]) {
    s.flags[flag] = true;
    out.flags.push(flag);
  }
  const mapFlag: FlagId | null = map === "depths" ? "depthsReached" : map === "ridge" ? "ridgeReached" : null;
  if (mapFlag && !s.flags[mapFlag]) {
    s.flags[mapFlag] = true;
    out.flags.push(mapFlag);
  }
  return out;
}

/** Is this connection usable right now? */
export function connectionOpen(s: GameState, id: string): boolean {
  return CONNECTIONS.find((c) => c.id === id)?.open(s) ?? false;
}

/**
 * Route between maps over open connections (breadth-first). Returns the transit object to use in
 * `from`, or null when already there / no open route. Hints use this so they always name the right
 * region first, then the way to get there, instead of pointing at an object in an unloaded map.
 */
export function nextHop(s: GameState, from: MapId, to: MapId): { object: string; connection: string; via: string } | null {
  if (from === to) return null;
  const prev = new Map<MapId, { from: MapId; object: string; connection: string; via: string }>();
  const queue: MapId[] = [from];
  const seen = new Set<MapId>([from]);
  while (queue.length) {
    const m = queue.shift()!;
    for (const c of CONNECTIONS) {
      if (!c.open(s)) continue;
      for (const [here, there] of [
        [c.a, c.b],
        [c.b, c.a],
      ] as const) {
        if (here.map !== m || seen.has(there.map)) continue;
        seen.add(there.map);
        prev.set(there.map, { from: m, object: here.object, connection: c.id, via: c.name });
        queue.push(there.map);
      }
    }
  }
  if (!prev.has(to)) return null;
  let step = prev.get(to)!;
  let at: MapId = to;
  while (step.from !== from) {
    at = step.from;
    step = prev.get(at)!;
  }
  return { object: step.object, connection: step.connection, via: step.via };
}

/** Where a target object is, for hints: its map, region name, and the local object to head for. */
export function routeTo(s: GameState, here: MapId, targetId: string): { localTarget: string | null; map: MapId; regionName: string; via: string | null } | null {
  const map = mapOfObject(targetId);
  const o = findObject(targetId);
  if (!map || !o) return null;
  const region = MAPS[map].regions.find((r) => o.col >= r.x0 && o.col <= r.x1) ?? MAPS[map].regions[0];
  if (map === here) return { localTarget: targetId, map, regionName: region.name, via: null };
  const hop = nextHop(s, here, map);
  return { localTarget: hop?.object ?? null, map, regionName: region.name, via: hop?.via ?? null };
}

// ---------------------------------------------------------------------------
// Transit objects (lifts, gates, cable car)
// ---------------------------------------------------------------------------

export function transitInteraction(o: WorldObject, s: GameState): Interaction | null {
  const info = connectionFor(o.id);
  if (!info) return null;
  const { c, side, here } = info;
  if (c.open(s)) return { verb: here.verb };
  if (c.activate && c.activate.side === side) {
    return c.activate.ready(s) ? { verb: c.activate.verb, detail: "Opens a shortcut" } : { verb: `Inspect ${o.label ?? "lift"}`, detail: c.activate.notReady };
  }
  return { verb: `Inspect ${o.label ?? "door"}`, detail: c.locked[side] || "Locked" };
}

export function performTransit(o: WorldObject, s: GameState): Effect[] {
  const info = connectionFor(o.id);
  if (!info) return [];
  const { c, side, there } = info;
  if (c.open(s)) {
    return [{ type: "anim", name: "interact" }, { type: "travel", connection: c.id, map: there.map, arrive: there.arrive }];
  }
  if (c.activate && c.activate.side === side && c.activate.ready(s)) {
    s.flags[c.activate.flag] = true;
    const fx: Effect[] = [
      { type: "anim", name: "repair" },
      { type: "sound", name: "power" },
      { type: "world", event: c.id === "skyline" ? "cableStarted" : "liftStarted", objectId: o.id },
      { type: "toast", text: `Shortcut open! The ${c.name.toLowerCase()} now runs to the ${regionNameOf(there.object)}.`, tone: "good" },
      { type: "save" },
    ];
    if (c.id === "skyline") fx.push({ type: "world", event: "mission03Complete", objectId: o.id });
    return fx;
  }
  const why = c.activate && c.activate.side === side ? c.activate.notReady : c.locked[side] || "Locked.";
  return [
    { type: "anim", name: "interact" },
    { type: "sound", name: "error" },
    { type: "toast", text: why, tone: "warn" },
  ];
}

/** Display name of the region an object belongs to. */
export function regionNameOf(objectId: string): string {
  const map = mapOfObject(objectId);
  const o = findObject(objectId);
  if (!map || !o) return "";
  const r = MAPS[map].regions.find((x) => o.col >= x.x0 && o.col <= x.x1) ?? MAPS[map].regions[0];
  return r.name;
}
