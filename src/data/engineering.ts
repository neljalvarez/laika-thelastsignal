/**
 * Phase 4: the outpost's engineering, as data. Every number here is a SIMPLIFIED, FICTIONAL GAME UNIT
 * chosen for readability and pacing. None of it is a real Mars or spacecraft engineering value.
 *
 *   PU  power units (generation and consumption per second)
 *   BU  battery units (stored energy; 1 PU for 1 s = 1 BU)
 *   SE  suit energy (0-100)
 *
 *            SOLAR ARRAY ──► BATTERY STATION ──► power bus (lower level)
 *                                  │
 *       ┌──────────────┬───────────┼──────────────┬───────────────┬──────────────┐
 *   HABITAT (crit) LIFE SUPPORT (crit)  SHELTER (crit)  WATER PUMP (opt)  GREENHOUSE (opt)  RESEARCH (opt)
 *                       ▲                                    │                ▲
 *                       └──────────── water loop ────────────┴────────────────┘
 *
 * Critical systems always get power first. Optional systems can be switched at the distribution
 * console and are the first to brown out when the battery is empty. A shortage never undoes a
 * restoration: restoration is a permanent flag, power is only a temporary operating condition.
 */
export type FacilityId = "solar" | "battery" | "habitat" | "lifeSupport" | "shelter" | "water" | "greenhouse" | "research";
export type OptionalSystem = "water" | "greenhouse" | "research";

export interface FacilityDef {
  id: FacilityId;
  name: string;
  /** Short symbol used in the HUD, the base status diagram and the console (never colour alone). */
  symbol: string;
  /** What it does, in one line a child can read. */
  role: string;
  /** PU drawn while operating (0 for generators / storage). */
  demand: number;
  /** Critical systems are powered first and cannot be switched off at the console. */
  critical: boolean;
  /** Facilities that must be restored before this one can operate. */
  dependsOn: FacilityId[];
  /** Science journal entry unlocked when it is restored. */
  science?: string;
}

export const FACILITIES: Record<FacilityId, FacilityDef> = {
  solar: { id: "solar", name: "Solar Array", symbol: "☀", role: "Turns sunlight into electricity.", demand: 0, critical: true, dependsOn: [], science: "solar_dust" },
  battery: { id: "battery", name: "Battery Station", symbol: "▮", role: "Stores spare power for later.", demand: 0, critical: true, dependsOn: ["solar"], science: "battery" },
  habitat: { id: "habitat", name: "Habitat", symbol: "⌂", role: "Warm lights and a bed: home.", demand: 2, critical: true, dependsOn: ["battery"] },
  lifeSupport: { id: "lifeSupport", name: "Life Support", symbol: "♺", role: "Recycles air and water.", demand: 3, critical: true, dependsOn: ["battery"], science: "water_recovery" },
  shelter: { id: "shelter", name: "Radiation Shelter", symbol: "⛨", role: "Thick walls that block radiation.", demand: 1, critical: true, dependsOn: ["battery"], science: "radiation" },
  water: { id: "water", name: "Water System", symbol: "≈", role: "Melts and pumps water to the base.", demand: 1, critical: false, dependsOn: ["battery"], science: "water_loop" },
  greenhouse: { id: "greenhouse", name: "Greenhouse", symbol: "✿", role: "Grow lights and water for plants.", demand: 3, critical: false, dependsOn: ["battery", "water"], science: "plants" },
  research: { id: "research", name: "Research Gear", symbol: "✦", role: "Receiver and workstation screens.", demand: 2, critical: false, dependsOn: ["solar"] },
};

export const OPTIONAL_SYSTEMS: OptionalSystem[] = ["water", "greenhouse", "research"];
export const CONSUMERS: FacilityId[] = ["habitat", "lifeSupport", "shelter", "water", "greenhouse", "research"];

/** All engineering balance values. Tests read these, so changing a value keeps the tests honest. */
export const ENGINEERING = {
  /** The simulation advances in fixed steps of this length (ms), never per rendered frame. */
  stepMs: 250,
  /** At most this many steps per rendered frame: a long hitch or a tab switch never fast-forwards. */
  maxStepsPerFrame: 4,
  /** PU from one clean, sunlit panel. Three panels make 15 PU. */
  panelOutput: 5,
  /** PU from a panel covered by the Lights Out dust. */
  dustyPanelOutput: 1,
  /** Battery capacity (BU) by survival setting; Expedition stores less. */
  batteryCapacity: { relaxed: 100, adventure: 100, expedition: 80 },
  /**
   * BU moved per PU-second of surplus or shortage. Below 1 so the battery fills over about half a
   * minute of play and a shortage drains it slowly: there is time to walk to the console.
   */
  batteryRate: 0.25,
  /** Charge the battery holds the moment it is restored. */
  batteryStart: 40,
  /** Lights Out: fraction of normal sunlight while the dust haze passes (by survival setting). */
  hazeSun: { relaxed: 0.7, adventure: 0.62, expedition: 0.5 },
  /** Lights Out: the panels the haze leaves dusty once the network is balanced. */
  hazeDustPanels: ["panel_1", "panel_3"],
  /**
   * Greenhouse: active-play milliseconds (lights on, water flowing, powered) after planting at which
   * the plants become sprouts, small plants and mature plants. About a minute of play in total.
   */
  growStageMs: [15_000, 35_000, 60_000],
} as const;

export type SurvivalMode = "relaxed" | "adventure" | "expedition";

/** Suit energy costs and recovery by survival setting. Basic movement, interacting and Bark never cost energy. */
export const SUIT = {
  max: 100,
  /** First Thruster Boots air jump. */
  thrustCost: { relaxed: 0, adventure: 10, expedition: 16 },
  /** Second, suit-boosted air jump (needs Thruster Boots and enough energy). */
  boostCost: { relaxed: 0, adventure: 25, expedition: 36 },
  /** Scanner pulse. At zero energy the scanner still works, at short range. */
  scanCost: { relaxed: 0, adventure: 2, expedition: 4 },
  /** Scanner radius multiplier at zero energy (the reveal radius is unchanged, so no dig spot is ever unreachable). */
  scanFallbackRadius: 0.55,
  /**
   * Reserve cell: below this level, energy trickles back after a short rest. Always at least one thruster jump,
   * so Laika can never be stranded on a ledge she reached with the boots.
   */
  reserveLevel: { relaxed: 100, adventure: 25, expedition: 20 },
  reserveDelayMs: 4000,
  reservePerSecond: 3,
  /** Time a recharge station takes to fill the suit (short on purpose). */
  rechargeMs: 1200,
} as const;
