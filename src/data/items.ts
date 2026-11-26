/** Data-driven item definitions. Add a new resource here and give it an icon in art/icons.ts. */
export type ItemId =
  | "metal"
  | "electronics"
  | "commsModule"
  | "sample"
  | "treat"
  | "coupling"
  | "relayCell"
  | "recording"
  | "roverPart"
  // Phase 4: unique mission items (never bought with metal/electronics, so optional spending can never block the story)
  | "regulator"
  | "recyclerPart"
  | "waterCoupling"
  | "seeds"
  | "powerCell"
  // Phase 5: the Chapter 5 expedition component (unique, never crafted or spent on gear)
  | "navBeacon";

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
    name: "Metal",
    short: "Metal",
    blurb: "Bent but useful. Good for repairs.",
    critical: false,
    alwaysShow: false,
  },
  electronics: {
    id: "electronics",
    name: "Circuit",
    short: "Circuit",
    blurb: "A circuit board that still works.",
    critical: false,
    alwaysShow: false,
  },
  commsModule: {
    id: "commsModule",
    name: "Radio Part",
    short: "Radio Part",
    blurb: "The receiver's missing heart!",
    critical: true,
    alwaysShow: false,
  },
  sample: {
    id: "sample",
    name: "Rock Sample",
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
  coupling: {
    id: "coupling",
    name: "Power Part",
    short: "Power Part",
    blurb: "A chunky connector. The junction needs one!",
    critical: true,
    alwaysShow: false,
  },
  relayCell: {
    id: "relayCell",
    name: "Relay Cell",
    short: "Relay Cell",
    blurb: "Still charged. It belongs to the Echo Ridge relays.",
    critical: true,
    alwaysShow: false,
  },
  recording: {
    id: "recording",
    name: "Recording",
    short: "Recordings",
    blurb: "A crew member's voice, saved for later.",
    critical: false,
    alwaysShow: false,
  },
  roverPart: {
    id: "roverPart",
    name: "Rover Part",
    short: "Rover Parts",
    blurb: "A piece of the lost rover. One day she could roll again.",
    critical: false,
    alwaysShow: false,
  },
  regulator: {
    id: "regulator",
    name: "Battery Part",
    short: "Battery Part",
    blurb: "A spare from the ship. The battery station needs it.",
    critical: true,
    alwaysShow: false,
  },
  recyclerPart: {
    id: "recyclerPart",
    name: "Pump",
    short: "Pump",
    blurb: "The recycler's missing pump cartridge.",
    critical: true,
    alwaysShow: false,
  },
  waterCoupling: {
    id: "waterCoupling",
    name: "Pipe Connector",
    short: "Pipe Connector",
    blurb: "Connects melted ice to the outpost's water system.",
    critical: true,
    alwaysShow: false,
  },
  seeds: {
    id: "seeds",
    name: "Seeds",
    short: "Seeds",
    blurb: "Lettuce seeds, sealed and ready to grow.",
    critical: true,
    alwaysShow: false,
  },
  navBeacon: {
    id: "navBeacon",
    name: "Nav Beacon",
    short: "Nav Beacon",
    blurb: "Marks the way north.",
    critical: true,
    alwaysShow: false,
  },
  powerCell: {
    id: "powerCell",
    name: "Power Cell",
    short: "Power Cell",
    blurb: "Enough to wake an old recharge post.",
    critical: false,
    alwaysShow: false,
  },
};

export const ITEM_ORDER: ItemId[] = ["commsModule", "coupling", "relayCell", "regulator", "recyclerPart", "waterCoupling", "seeds", "navBeacon", "powerCell", "metal", "electronics", "sample", "treat", "recording", "roverPart"];

/** Costs are data, so balancing never touches code. */
export type Cost = Partial<Record<ItemId, number>>;

export const RECIPES = {
  solarRepair: { metal: 2, electronics: 1 } as Cost,
  thrusterBoots: { metal: 2, electronics: 1 } as Cost,
};
