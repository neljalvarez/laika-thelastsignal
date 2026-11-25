/** Data-driven item definitions. Add a new resource here and give it an icon in art/icons.ts. */
export type ItemId = "metal" | "electronics" | "commsModule" | "sample" | "treat";

export interface ItemDef {
  id: ItemId;
  name: string;
  /** Plural / short label for the HUD. */
  short: string;
  /** One-line description shown in the pickup notification. */
  blurb: string;
  /** Mission-critical items are never consumed except by the machine that needs them. */
  critical: boolean;
  /** Shown in the HUD even when the count is zero? */
  alwaysShow: boolean;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  metal: {
    id: "metal",
    name: "Salvaged Metal",
    short: "Metal",
    blurb: "Bent but useful. Good for repairs.",
    critical: false,
    alwaysShow: false,
  },
  electronics: {
    id: "electronics",
    name: "Electronic Component",
    short: "Electronics",
    blurb: "A circuit board that still works.",
    critical: false,
    alwaysShow: false,
  },
  commsModule: {
    id: "commsModule",
    name: "Comms Module",
    short: "Comms Module",
    blurb: "The receiver's missing heart!",
    critical: true,
    alwaysShow: false,
  },
  sample: {
    id: "sample",
    name: "Geological Sample",
    short: "Samples",
    blurb: "A piece of Mars' history.",
    critical: false,
    alwaysShow: false,
  },
  treat: {
    id: "treat",
    name: "Golden Treat",
    short: "Golden Treat",
    blurb: "A secret snack. Good girl!",
    critical: false,
    alwaysShow: false,
  },
};

export const ITEM_ORDER: ItemId[] = ["commsModule", "metal", "electronics", "sample", "treat"];

/** Costs are data, so balancing never touches code. */
export type Cost = Partial<Record<ItemId, number>>;

export const RECIPES = {
  solarRepair: { metal: 2, electronics: 1 } as Cost,
  thrusterBoots: { metal: 2, electronics: 1 } as Cost,
};
