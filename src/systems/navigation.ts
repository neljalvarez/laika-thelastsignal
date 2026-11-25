/**
 * Conservative tile-level reachability for level validation.
 *
 * Laika occupies one tile column and one tile row (her hitbox is 14 x 15 px). From a standing
 * cell she can walk, step off edges, and jump to cells at most `up` tiles higher and `across`
 * tiles away when the path is clear. The real jump (about 3.5 tiles high, 5+ tiles long) is
 * stronger than these limits, so anything this finds reachable is comfortably reachable in play.
 *
 * Tests use it to prove the mission can be completed and that no reachable spot is a dead end.
 */
import { T } from "../data/world";
import { isSolid, isStandable, type WorldGrid } from "./worldBuilder";

export interface JumpAbility {
  up: number;
  across: number;
}

export const BASIC_JUMP: JumpAbility = { up: 3, across: 4 };
export const BOOTS_JUMP: JumpAbility = { up: 5, across: 6 };

const key = (c: number, r: number) => r * 10000 + c;
export const cellKey = key;

export function canStand(g: WorldGrid, c: number, r: number): boolean {
  if (c < 0 || c >= g.w || r < 1 || r >= g.h - 1) return false;
  const here = g.fg[r][c];
  if (here !== T.Empty && isSolid(here)) return false;
  if (here !== T.Empty) return false; // standing inside a one-way tile is not a resting spot
  return isStandable(g.fg[r + 1][c]);
}

function passable(g: WorldGrid, c: number, r: number): boolean {
  if (c < 0 || c >= g.w || r < 0 || r >= g.h) return false;
  return !isSolid(g.fg[r][c]);
}

/** Where a fall straight down column c starting at row r ends (a standing cell), or null. */
function fallFrom(g: WorldGrid, c: number, r: number): [number, number] | null {
  for (let y = r; y < g.h - 1; y++) {
    if (!passable(g, c, y)) return null;
    if (canStand(g, c, y)) return [c, y];
  }
  return null;
}

function clearJump(g: WorldGrid, c: number, r: number, tc: number, tr: number): boolean {
  const top = Math.min(r, tr) - 1;
  // Rise in the start column up to the travel height.
  for (let y = top; y <= r; y++) if (!passable(g, c, y)) return false;
  // Travel horizontally at the travel height (and the row below it, for the body).
  const step = tc > c ? 1 : -1;
  for (let x = c; x !== tc + step; x += step) {
    if (!passable(g, x, top)) return false;
    if (!passable(g, x, top + 1)) return false;
  }
  // Descend in the target column.
  for (let y = top; y <= tr; y++) if (!passable(g, tc, y)) return false;
  return true;
}

export function neighbours(g: WorldGrid, c: number, r: number, jump: JumpAbility): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const d of [-1, 1]) {
    const nc = c + d;
    if (canStand(g, nc, r)) out.push([nc, r]);
    else if (passable(g, nc, r)) {
      const f = fallFrom(g, nc, r);
      if (f) out.push(f);
    }
  }
  for (let dc = -jump.across; dc <= jump.across; dc++) {
    for (let dr = -jump.up; dr <= jump.up + 6; dr++) {
      if (dc === 0 && dr === 0) continue;
      const tc = c + dc;
      const tr = r + dr;
      if (!canStand(g, tc, tr)) continue;
      if (clearJump(g, c, r, tc, tr)) out.push([tc, tr]);
    }
  }
  return out;
}

export function standCells(g: WorldGrid): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let r = 1; r < g.h - 1; r++) for (let c = 0; c < g.w; c++) if (canStand(g, c, r)) cells.push([c, r]);
  return cells;
}

/** All standing cells reachable from (c, r). */
export function reachableFrom(g: WorldGrid, c: number, r: number, jump: JumpAbility = BASIC_JUMP): Set<number> {
  const seen = new Set<number>([key(c, r)]);
  const queue: Array<[number, number]> = [[c, r]];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [nx, ny] of neighbours(g, x, y, jump)) {
      const k = key(nx, ny);
      if (!seen.has(k)) {
        seen.add(k);
        queue.push([nx, ny]);
      }
    }
  }
  return seen;
}

/** Nearest standing cell at or just above a tile position (objects stand on row `row`). */
export function standCellFor(g: WorldGrid, col: number, row: number): [number, number] | null {
  for (let dy = 1; dy <= 3; dy++) if (canStand(g, col, row - dy)) return [col, row - dy];
  return null;
}
