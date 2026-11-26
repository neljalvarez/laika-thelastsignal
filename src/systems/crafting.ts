/**
 * Phase 5: the outpost workbench, equipment effects and cosmetics. Pure rules (no Phaser, no DOM).
 *
 * - Crafting validates once, spends once, and applies the benefit at once. A second request for
 *   the same item (double click, held button) does nothing.
 * - Recipes only use Metal and Circuits. Mission items and collectibles are never spent.
 * - Permanent upgrades work automatically: there are no slots or loadouts.
 */
import { COSMETIC_ORDER, COSMETICS, EQUIPMENT, EQUIPMENT_ORDER, GEAR, type CosmeticId, type EquipmentId } from "../data/equipment";
import { ITEMS, type Cost, type ItemId } from "../data/items";
import { ALL_OBJECTS } from "../data/regions/registry";
import type { Effect } from "./effects";
import { canAfford, spend } from "./inventory";
import { gearReady, type GameState } from "./state";

/** Materials a recipe may use. Anything else in a cost is a bug and makes the recipe uncraftable. */
export const CRAFT_MATERIALS: ItemId[] = ["metal", "electronics"];

export function hasGear(s: GameState, id: EquipmentId): boolean {
  return id === "boots" ? s.abilities.thrusters : s.gear.built.includes(id);
}

export function knowsBlueprint(s: GameState, id: EquipmentId): boolean {
  return id === "boots" || s.gear.blueprints.includes(id);
}

export type CraftStatus = "built" | "ready" | "missing" | "locked" | "noPower";

export interface CraftCard {
  id: EquipmentId;
  status: CraftStatus;
  /** Per material: have / need (only the materials the recipe uses). */
  need: Array<{ item: ItemId; have: number; need: number }>;
  /** Why it is locked, in a few words. */
  lockedBy?: string;
}

function requirementMet(s: GameState, id: EquipmentId): boolean {
  const r = EQUIPMENT[id].requires;
  if (!r) return true;
  return r === "headlamp" ? s.abilities.headlamp : hasGear(s, r);
}

export function recipeIsSafe(cost: Cost): boolean {
  return (Object.keys(cost) as ItemId[]).every((k) => CRAFT_MATERIALS.includes(k) && !ITEMS[k].critical);
}

export function craftCard(s: GameState, id: EquipmentId, powered: boolean): CraftCard {
  const def = EQUIPMENT[id];
  const need = (Object.keys(def.cost) as ItemId[]).map((item) => ({ item, have: s.inventory[item] ?? 0, need: def.cost[item] ?? 0 }));
  if (hasGear(s, id)) return { id, status: "built", need };
  if (!requirementMet(s, id)) return { id, status: "locked", need, lockedBy: def.requires === "headlamp" ? "Needs the headlamp" : `Needs ${EQUIPMENT[def.requires as EquipmentId].name}` };
  if (!powered) return { id, status: "noPower", need };
  return { id, status: canAfford(s, def.cost) && recipeIsSafe(def.cost) ? "ready" : "missing", need };
}

/** The cards the workbench shows: known blueprints only, in a fixed order. */
export function workbenchCards(s: GameState, powered: boolean): CraftCard[] {
  return EQUIPMENT_ORDER.filter((id) => knowsBlueprint(s, id)).map((id) => craftCard(s, id, powered));
}

/** Builds one item. Returns the effects to present, or [] if nothing happened (never spends twice). */
export function craft(s: GameState, id: EquipmentId, powered: boolean): Effect[] {
  const card = craftCard(s, id, powered);
  if (card.status !== "ready" || !knowsBlueprint(s, id)) return [];
  const cost = EQUIPMENT[id].cost;
  spend(s, cost);
  if (id === "boots") s.abilities.thrusters = true;
  else s.gear.built.push(id);
  const fx: Effect[] = [{ type: "spend", cost }, { type: "anim", name: "repair" }, { type: "world", event: "crafted", objectId: id }, { type: "anim", name: "celebrate" }];
  if (id === "boots") fx.push({ type: "world", event: "thrusters" });
  fx.push({ type: "save" });
  return fx;
}

// ---------------------------------------------------------------------------
// Equipment effects
// ---------------------------------------------------------------------------

export function sniffRadiusFactor(s: GameState): number {
  return hasGear(s, "booster") ? GEAR.boosterSniffRadius : 1;
}

export function revealRadiusFactor(s: GameState): number {
  return hasGear(s, "booster") ? GEAR.boosterRevealRadius : 1;
}

export function suitMax(s: GameState): number {
  return hasGear(s, "reserveBattery") ? GEAR.reserveSuitMax : 100;
}

export function thrusterCostFactor(s: GameState): number {
  return hasGear(s, "efficientBoots") ? GEAR.efficientCostFactor : 1;
}

export function headlampFactor(s: GameState): number {
  return hasGear(s, "surveyLamp") ? GEAR.surveyLampRadius : 1;
}

/** Hidden objects that need a piece of equipment before the world shows them. */
export function gearAllows(s: GameState, needs: string | undefined): boolean {
  return gearReady(s, needs);
}

// ---------------------------------------------------------------------------
// Cosmetics (no gameplay effect)
// ---------------------------------------------------------------------------

const total = (item: ItemId) => ALL_OBJECTS.filter((o) => o.item === item).length;

export function cosmeticUnlocked(s: GameState, id: CosmeticId): boolean {
  switch (id) {
    case "stripe":
      return s.collected.includes("lamp_cache");
    case "patch":
      return s.flags.m4Complete;
    case "trimBlue":
      return (s.inventory.treat ?? 0) >= total("treat");
    case "packCopper":
      return (s.inventory.sample ?? 0) >= total("sample");
    case "collarStar":
      return s.science.length >= 8;
  }
}

export function unlockedCosmetics(s: GameState): CosmeticId[] {
  return COSMETIC_ORDER.filter((id) => cosmeticUnlocked(s, id));
}

/** Toggles a cosmetic. Locked ones cannot be worn. Returns true if something changed. */
export function toggleCosmetic(s: GameState, id: CosmeticId): boolean {
  if (!COSMETICS[id] || !cosmeticUnlocked(s, id)) return false;
  s.gear.wear = s.gear.wear.includes(id) ? s.gear.wear.filter((c) => c !== id) : [...s.gear.wear, id];
  return true;
}

/** What Laika looks like: drives the generated sprite sheet (equipment + worn cosmetics). */
export interface LaikaLook {
  boots: boolean;
  booster: boolean;
  reserve: boolean;
  lamp: boolean;
  efficient: boolean;
  wear: CosmeticId[];
}

export function lookOf(s: GameState): LaikaLook {
  return {
    boots: s.abilities.thrusters,
    booster: hasGear(s, "booster"),
    reserve: hasGear(s, "reserveBattery"),
    lamp: hasGear(s, "surveyLamp"),
    efficient: hasGear(s, "efficientBoots"),
    wear: s.gear.wear.filter((c) => cosmeticUnlocked(s, c)).sort(),
  };
}

export function lookKey(l: LaikaLook): string {
  const bits = [l.boots && "b", l.booster && "a", l.reserve && "r", l.lamp && "l", l.efficient && "e", ...l.wear].filter(Boolean);
  return bits.length ? `laika_${bits.join("_")}` : "laika";
}
