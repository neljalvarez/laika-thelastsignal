/**
 * Phase 5: equipment Laika can build at the outpost workbench, and her cosmetic options.
 * Display text is short on purpose (one benefit line); details are optional in the UI.
 * Recipes only ever use the two crafting materials (Metal, Circuit), never mission items or
 * collectibles, so crafting can never block the story.
 */
import type { Cost } from "./items";

export type EquipmentId = "boots" | "booster" | "efficientBoots" | "surveyLamp" | "reserveBattery";

export interface EquipmentDef {
  id: EquipmentId;
  name: string;
  /** One short benefit line (the card's only text by default). */
  benefit: string;
  /** Optional expanded detail (shown when the player asks for details). */
  detail: string;
  cost: Cost;
  /** Equipment (or ability) that must exist first. */
  requires?: EquipmentId | "headlamp";
  /** Icon key (12x12 grid in art/icons.ts). */
  icon: string;
}

export const EQUIPMENT: Record<EquipmentId, EquipmentDef> = {
  boots: {
    id: "boots",
    name: "Thruster Boots",
    benefit: "Jump again in mid-air.",
    detail: "Press Jump in the air. Reaches high ledges.",
    cost: { metal: 2, electronics: 1 },
    icon: "eq_boots",
  },
  booster: {
    id: "booster",
    name: "Signal Booster",
    benefit: "Find buried things from farther away.",
    detail: "Sniff range +60%. Picks up faint caches the plain scanner misses.",
    cost: { metal: 2, electronics: 1 },
    icon: "eq_booster",
  },
  efficientBoots: {
    id: "efficientBoots",
    name: "Thruster Upgrade",
    benefit: "Boost jumps use less energy.",
    detail: "Thruster and boost jumps cost half as much suit energy.",
    cost: { metal: 3, electronics: 2 },
    requires: "boots",
    icon: "eq_thruster",
  },
  surveyLamp: {
    id: "surveyLamp",
    name: "Survey Headlamp",
    benefit: "See more in dark caves.",
    detail: "A wider, brighter beam that shows hidden survey marks.",
    cost: { metal: 1, electronics: 2 },
    requires: "headlamp",
    icon: "eq_lamp",
  },
  reserveBattery: {
    id: "reserveBattery",
    name: "Reserve Battery",
    benefit: "Explore longer before recharging.",
    detail: "Suit energy 150 instead of 100, and a higher reserve.",
    cost: { metal: 3, electronics: 1 },
    icon: "eq_battery",
  },
};

export const EQUIPMENT_ORDER: EquipmentId[] = ["boots", "booster", "efficientBoots", "surveyLamp", "reserveBattery"];

/** Equipment effects (one place, read by the rules and the scene). */
export const GEAR = {
  boosterSniffRadius: 1.6,
  boosterRevealRadius: 1.35,
  efficientCostFactor: 0.5,
  reserveSuitMax: 150,
  reserveFloorBonus: 15,
  surveyLampRadius: 1.35,
} as const;

export type CosmeticId = "stripe" | "patch" | "trimBlue" | "packCopper" | "collarStar";

export interface CosmeticDef {
  id: CosmeticId;
  name: string;
  /** How it is earned, in a few words (shown under a locked silhouette). */
  how: string;
}

export const COSMETICS: Record<CosmeticId, CosmeticDef> = {
  stripe: { id: "stripe", name: "Helmet Stripe", how: "A survey mark deep in the caves" },
  patch: { id: "patch", name: "Mission Patch", how: "Restore the outpost" },
  trimBlue: { id: "trimBlue", name: "Ridge Blue Trim", how: "Find every Golden Treat" },
  packCopper: { id: "packCopper", name: "Copper Backpack", how: "Collect every rock sample" },
  collarStar: { id: "collarStar", name: "Star Collar", how: "Fill 8 journal pages" },
};

export const COSMETIC_ORDER: CosmeticId[] = ["stripe", "patch", "trimBlue", "packCopper", "collarStar"];
