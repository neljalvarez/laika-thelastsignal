import type { Cost, ItemId } from "../data/items";
import type { GameState } from "./state";

export function count(s: GameState, item: ItemId): number {
  return s.inventory[item] ?? 0;
}

export function canAfford(s: GameState, cost: Cost): boolean {
  return (Object.keys(cost) as ItemId[]).every((k) => count(s, k) >= (cost[k] ?? 0));
}

/** Missing amounts for a cost, e.g. { metal: 1 }. Empty when affordable. */
export function missing(s: GameState, cost: Cost): Cost {
  const out: Cost = {};
  for (const k of Object.keys(cost) as ItemId[]) {
    const need = (cost[k] ?? 0) - count(s, k);
    if (need > 0) out[k] = need;
  }
  return out;
}

/** Mutates. Only call after canAfford(). */
export function spend(s: GameState, cost: Cost): void {
  for (const k of Object.keys(cost) as ItemId[]) {
    s.inventory[k] = Math.max(0, count(s, k) - (cost[k] ?? 0));
  }
}

/**
 * Collects a world object's item exactly once. Returns false (and changes nothing) if the
 * object was already collected, so items can never be duplicated by double presses, saves
 * or reloads.
 */
export function collectOnce(s: GameState, objectId: string, item: ItemId, amount = 1): boolean {
  if (s.collected.includes(objectId)) return false;
  s.collected.push(objectId);
  s.inventory[item] = count(s, item) + amount;
  return true;
}
