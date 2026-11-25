/**
 * Compiles the authored terrain operations (data/world.ts) into tile grids.
 * Pure: used by the game scene and by the level-validation tests.
 */
import { B, BRIDGE_TILES, T, TERRAIN, WORLD_H, WORLD_W, type TerrainOp } from "../data/world";

export interface WorldGrid {
  w: number;
  h: number;
  /** Foreground tiles, indexed [row][col]. */
  fg: T[][];
  /** Background (non-colliding) wall tiles. */
  bg: B[][];
}

export function buildWorld(ops: TerrainOp[] = TERRAIN, w = WORLD_W, h = WORLD_H): WorldGrid {
  const fg: T[][] = Array.from({ length: h }, () => Array<T>(w).fill(T.Empty));
  const bg: B[][] = Array.from({ length: h }, () => Array<B>(w).fill(B.None));
  const inX = (x: number) => Math.max(0, Math.min(w - 1, x));
  const inY = (y: number) => Math.max(0, Math.min(h - 1, y));
  for (const op of ops) {
    if (op.op === "surface") {
      for (let x = inX(op.x0); x <= inX(op.x1); x++) {
        for (let y = 0; y < h - 1; y++) fg[y][x] = y < op.row ? T.Empty : op.t;
      }
      continue;
    }
    for (let y = inY(op.y0); y <= inY(op.y1); y++) {
      for (let x = inX(op.x0); x <= inX(op.x1); x++) {
        if (op.op === "fill") fg[y][x] = op.t;
        else if (op.op === "clear") fg[y][x] = T.Empty;
        else bg[y][x] = op.b;
      }
    }
  }
  return { w, h, fg, bg };
}

export const ONE_WAY = new Set<T>([T.Ledge, T.Scaffold]);

export function isSolid(t: T): boolean {
  return t !== T.Empty && !ONE_WAY.has(t);
}

/** Standing surface (solid or one-way). */
export function isStandable(t: T): boolean {
  return t !== T.Empty;
}

/** Returns a copy of the grid with the bridge placed (for validation of the post-bridge world). */
export function withBridge(g: WorldGrid): WorldGrid {
  const fg = g.fg.map((r) => r.slice());
  for (const [c, r] of BRIDGE_TILES) fg[r][c] = T.Bridge;
  return { ...g, fg };
}

/** Returns a copy with the given tiles cleared (doors opened). */
export function withCleared(g: WorldGrid, tiles: Array<[number, number]>): WorldGrid {
  const fg = g.fg.map((r) => r.slice());
  for (const [c, r] of tiles) fg[r][c] = T.Empty;
  return { ...g, fg };
}
