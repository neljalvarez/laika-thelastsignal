/**
 * Phase 5: route-aware objective guidance. Pure (no Phaser): given the map grid, where Laika
 * stands and the objective's target, it returns ONE next point to head for.
 *
 * 1. Another map: the lift / gate / cable car that leads there (regions.routeTo, open connections
 *    only, shortcuts when they are open). Locked routes give no waypoint.
 * 2. Same map: a breadth-first search over standing cells with Laika's real jump reach, plus the
 *    habitat ladder (a portal between the surface and the lower level). The waypoint is a point a
 *    few steps along that path, or the ladder when the path uses it, so the arrow follows the
 *    route around walls instead of pointing through them.
 * 3. No path found (the solver is conservative): fall back to the target itself.
 */
import { findObject, mapOfObject, type MapId } from "../data/regions/registry";
import { objectPos, type WorldObject } from "../data/world";
import { BASIC_JUMP, BOOTS_JUMP, canStand, neighbours, standCellFor, type JumpAbility } from "./navigation";
import { routeTo } from "./regions";
import type { GameState } from "./state";
import type { WorldGrid } from "./worldBuilder";

export interface Waypoint {
  /** World pixel position to point at. */
  x: number;
  y: number;
  /** Object at the waypoint, if it is one (target, lift, ladder). */
  objectId: string | null;
  kind: "target" | "route" | "portal" | "transit";
  /** The objective target is on another map. */
  otherMap: boolean;
  /** Steps along the path (rough distance), or -1 when unknown. */
  steps: number;
}

export type GuidanceMode = "guided" | "explorer" | "minimal";

interface Portal {
  from: [number, number];
  to: [number, number];
  objectId: string;
}

/** Ladders between the surface and the outpost's lower level (only once they are usable). */
export function portals(map: MapId, s: GameState, g: WorldGrid): Portal[] {
  if (map !== "surface" || !s.flags.m4Briefed) return [];
  const out: Portal[] = [];
  const hab = findObject("habitat");
  const lower = findObject("lower_stairs");
  const cell = (c: number, r: number) => standCellFor(g, c, r);
  if (hab && lower) {
    const top = cell(hab.col, hab.row);
    const bottom = cell(lower.col, lower.row);
    const arriveLow = cell(62, 31);
    const arriveTop = cell(lower.to?.[0] ?? 60, lower.to?.[1] ?? 24);
    if (top && arriveLow) out.push({ from: top, to: arriveLow, objectId: "habitat" });
    if (bottom && arriveTop) out.push({ from: bottom, to: arriveTop, objectId: "lower_stairs" });
  }
  return out;
}

const key = (c: number, r: number) => r * 10000 + c;

/** Shortest standing-cell path (BFS) including portals. Returns the cells, or null. */
export function findPath(g: WorldGrid, start: [number, number], goal: [number, number], jump: JumpAbility, ports: Portal[] = [], limit = 20000): Array<{ c: number; r: number; via?: string }> | null {
  const goalK = key(goal[0], goal[1]);
  const prev = new Map<number, { k: number; via?: string }>();
  const startK = key(start[0], start[1]);
  prev.set(startK, { k: -1 });
  const queue: Array<[number, number]> = [start];
  let n = 0;
  while (queue.length && n++ < limit) {
    const [c, r] = queue.shift()!;
    const k = key(c, r);
    if (k === goalK) break;
    const next: Array<[number, number, string | undefined]> = neighbours(g, c, r, jump).map(([a, b]) => [a, b, undefined]);
    for (const p of ports) if (p.from[0] === c && p.from[1] === r) next.push([p.to[0], p.to[1], p.objectId]);
    for (const [a, b, via] of next) {
      const nk = key(a, b);
      if (prev.has(nk)) continue;
      prev.set(nk, { k, via });
      queue.push([a, b]);
    }
  }
  if (!prev.has(goalK)) return null;
  const path: Array<{ c: number; r: number; via?: string }> = [];
  let k = goalK;
  while (k !== -1) {
    const p = prev.get(k)!;
    path.push({ c: k % 10000, r: Math.floor(k / 10000), via: p.via });
    k = p.k;
  }
  return path.reverse();
}

/** How far along the path the arrow looks (in standing cells). */
const LOOK_AHEAD = 9;

export function nextWaypoint(g: WorldGrid, s: GameState, map: MapId, at: { col: number; row: number }, targetId: string): Waypoint | null {
  const route = routeTo(s, map, targetId, at.col);
  if (!route || !route.localTarget) return null;
  const local = findObject(route.localTarget);
  if (!local || mapOfObject(local.id) !== map) return null;
  const otherMap = route.localTarget !== targetId;
  const tp = objectPos(local);
  const direct: Waypoint = { x: tp.x, y: tp.y - 12, objectId: local.id, kind: otherMap ? "transit" : "target", otherMap, steps: -1 };
  const goal = standCellFor(g, local.col, local.row);
  const start = standAt(g, at.col, at.row);
  if (!goal || !start) return direct;
  const jump = s.abilities.thrusters ? BOOTS_JUMP : BASIC_JUMP;
  const path = findPath(g, start, goal, jump, portals(map, s, g));
  if (!path) return direct;
  // A ladder on the way is the next thing to reach.
  for (let i = 1; i < path.length; i++) {
    if (path[i].via) {
      const portal = findObject(path[i].via!);
      if (portal && i <= LOOK_AHEAD + 30) {
        const pp = objectPos(portal);
        return { x: pp.x, y: pp.y - 12, objectId: portal.id, kind: "portal", otherMap, steps: i };
      }
      break;
    }
  }
  if (path.length - 1 <= LOOK_AHEAD) return { ...direct, steps: path.length - 1 };
  const p = path[LOOK_AHEAD];
  return { x: p.c * 16 + 8, y: (p.r + 1) * 16 - 12, objectId: null, kind: "route", otherMap, steps: path.length - 1 };
}

/** Nearest standing cell at or just below Laika (she may be mid-jump). */
function standAt(g: WorldGrid, col: number, row: number): [number, number] | null {
  for (let r = row; r < Math.min(g.h, row + 12); r++) if (canStand(g, col, r)) return [col, r];
  for (let r = row - 1; r >= Math.max(0, row - 3); r--) if (canStand(g, col, r)) return [col, r];
  return null;
}

/** Waypoints never point at hidden discoveries: only objective targets and travel objects. */
export function guidable(o: WorldObject | undefined): boolean {
  return !!o && o.kind !== "secret";
}

