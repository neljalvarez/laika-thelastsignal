/**
 * Handcrafted world for Phase 1: one interconnected map in four sections.
 *
 *   A  Laika's spacecraft   cols   3-23
 *   B  Landing outpost      cols  24-93
 *   C  Crimson Canyon       cols  94-199  (jump pit, tunnel, cavern, mesa, rover, east rim)
 *   D  Ares research station cols 212-239 (across the chasm, reached by the bridge)
 *
 * The terrain is authored as a list of simple operations (fill / clear / surface / back),
 * compiled into a tile grid by systems/worldBuilder.ts. Objects are placed by tile column and
 * the tile row of the ground they stand on. Everything here is data: new regions are new
 * entries, not new code.
 */
import type { ItemId } from "./items";

export const WORLD_W = 240;
export const WORLD_H = 34;

export enum T {
  Empty = 0,
  Regolith = 1,
  Rock = 2,
  Hull = 3,
  Cave = 4,
  Ledge = 5, // one-way rock ledge
  Scaffold = 6, // one-way metal walkway
  Crate = 7,
  Door = 8, // solid until opened (hatch / station door)
  Bridge = 9, // placed when the bridge extends
  FloorHatch = 10, // the hatch between the ship's two decks (open after Mission 00)
  // Phase 3 materials (Frozen Depths, Echo Ridge)
  FrostRock = 11, // blue-violet cave rock
  Ice = 12, // water-ice deposits (solid)
  RidgeRock = 13, // weathered, tilted ridge strata
  IceLedge = 14, // one-way ice shelf
  Shutter = 15, // powered / light-sensor door: solid until opened
}

export enum B {
  None = 0,
  Hull = 1,
  Cave = 2,
  Station = 3,
  Frost = 4, // cave wall behind the Frozen Depths
  Lab = 5, // survey facility interior panels
  Ridge = 6, // dark rock behind ridge alcoves
}

export type TerrainOp =
  | { op: "fill"; t: T; x0: number; x1: number; y0: number; y1: number }
  | { op: "clear"; x0: number; x1: number; y0: number; y1: number }
  /** Columns x0..x1 become ground whose top tile is `row` (cleared above, filled below to the bedrock). */
  | { op: "surface"; t: T; x0: number; x1: number; row: number }
  | { op: "back"; b: B; x0: number; x1: number; y0: number; y1: number };

const fill = (t: T, x0: number, x1: number, y0: number, y1: number): TerrainOp => ({ op: "fill", t, x0, x1, y0, y1 });
const clear = (x0: number, x1: number, y0: number, y1: number): TerrainOp => ({ op: "clear", x0, x1, y0, y1 });
const surface = (t: T, x0: number, x1: number, row: number): TerrainOp => ({ op: "surface", t, x0, x1, row });
const back = (b: B, x0: number, x1: number, y0: number, y1: number): TerrainOp => ({ op: "back", b, x0, x1, y0, y1 });

export const TERRAIN: TerrainOp[] = [
  // Base ground: regolith with its surface on row 24, bedrock on the last row.
  fill(T.Regolith, 0, WORLD_W - 1, 24, WORLD_H - 1),
  // World edges: cliffs so Laika can never walk off the map.
  fill(T.Rock, 0, 1, 8, WORLD_H - 1),
  fill(T.Rock, WORLD_W - 3, WORLD_W - 1, 8, WORLD_H - 1),

  // ---------------- A: the spacecraft (two decks) ----------------
  // Upper deck (rows 8-13): Laika's quarters and training bay, where Mission 00 takes place.
  // Lower deck (rows 16-21): cockpit and cargo bay with the radio and the hatch (Mission 01).
  fill(T.Hull, 3, 23, 6, 7), // roof
  fill(T.Hull, 3, 3, 6, 23), // aft wall
  fill(T.Hull, 23, 23, 6, 23), // nose wall
  fill(T.Hull, 3, 23, 14, 15), // floor between the decks
  fill(T.Hull, 3, 23, 22, 23), // lower deck
  back(B.Hull, 4, 22, 8, 13),
  back(B.Hull, 4, 22, 16, 21),
  fill(T.FloorHatch, 21, 22, 14, 15), // opens at the end of Mission 00
  back(B.Hull, 21, 22, 14, 15), // hull wall behind the open hatch shaft (no sky showing through)
  fill(T.Crate, 11, 11, 13, 13), // training crate: the tutorial's first jump
  fill(T.Door, 23, 23, 19, 21), // hatch
  fill(T.Crate, 15, 15, 21, 21), // fallen cargo crate: the first jump
  fill(T.Hull, 24, 25, 22, 23), // hatch landing
  fill(T.Regolith, 26, 26, 23, 23), // step down to the ground

  // ---------------- B: landing outpost ----------------
  fill(T.Crate, 84, 85, 22, 23),
  fill(T.Crate, 86, 86, 23, 23),

  // Phase 4: the Outpost Lower Level, a compact maintenance level cut into the regolith under the
  // outpost (the surface above is untouched). Rooms are on rows 26-30, the floor is row 31.
  //   40-49 radiation shelter (double hull walls) | 50-56 maintenance bay | 57-65 habitat quarters
  //   66-72 life support | 73-81 grow room (under the greenhouse dome) | 82-88 water room
  clear(40, 88, 26, 30),
  back(B.Station, 40, 88, 26, 30),
  fill(T.Hull, 40, 41, 26, 30), // shelter: thick west wall
  fill(T.Hull, 48, 49, 26, 28), // shelter: thick east wall over the doorway
  fill(T.Hull, 40, 49, 25, 25), // shelter: thick roof under the soil
  back(B.Hull, 42, 47, 26, 30),
  fill(T.Hull, 88, 88, 26, 30), // east end of the lower level

  // ---------------- C: Crimson Canyon ----------------
  surface(T.Rock, 94, 95, 25),
  surface(T.Rock, 96, 97, 26),
  surface(T.Rock, 98, 99, 27),
  surface(T.Rock, 100, 183, 28),

  // Hidden room behind a false rock wall, off the jump pit (cols 105-111).
  clear(105, 111, 29, 30),
  back(B.Cave, 105, 111, 29, 30),

  // Jump pit: three easy gaps between two rock stepping stones. The stones are one-way ledges,
  // so anyone who falls can walk along the pit floor into the survey tunnel (never a dead end).
  clear(112, 122, 28, 30),
  fill(T.Ledge, 115, 116, 28, 28),
  fill(T.Ledge, 119, 120, 28, 28),
  // Phase 2: a low one-way step in the west gap. A jump that comes up short heading west (easy with the new apex
  // hang, which carries a fully held sprint jump past the stones) climbs straight out instead of looping back
  // through the tunnel: pit floor -> step (1 tile) -> west lip (2 tiles).
  fill(T.Ledge, 113, 114, 30, 30),
  back(B.Cave, 112, 122, 29, 30),

  // Survey tunnel: the pit drains east under the canyon floor and the mesa.
  clear(123, 149, 29, 30),
  back(B.Cave, 123, 149, 29, 30),

  // Twin Mesa: the main path climbs over it in 2-tile steps...
  surface(T.Rock, 132, 132, 26),
  surface(T.Rock, 133, 146, 24),
  surface(T.Rock, 147, 147, 26),
  // ...while a cavern opens underneath it.
  clear(133, 146, 27, 30),
  back(B.Cave, 133, 146, 27, 30),
  clear(123, 149, 29, 30), // re-open the tunnel through the mesa's footing
  back(B.Cave, 123, 149, 29, 30),
  // Optional climb on the mesa (2-tile steps), plus a high ledge only Thruster Boots can reach.
  fill(T.Ledge, 136, 138, 22, 22),
  fill(T.Ledge, 140, 142, 20, 20),
  fill(T.Ledge, 144, 146, 16, 16),

  // Tunnel exit: an open shaft with a one-way ledge. From the tunnel Laika hops up onto the
  // ledge, then onto the canyon floor; walking along the floor she just steps over it.
  clear(150, 151, 28, 30),
  fill(T.Ledge, 150, 151, 29, 29),
  back(B.Cave, 150, 151, 29, 30),

  // East climb out of the canyon to the rim.
  surface(T.Rock, 184, 185, 26),
  surface(T.Rock, 186, 199, 24),

  // The chasm. The bridge will span row 24. Ledges let Laika climb back out if she falls.
  clear(200, 211, 24, WORLD_H - 2),
  back(B.Cave, 200, 211, 27, WORLD_H - 2),
  fill(T.Ledge, 201, 203, 31, 31),
  fill(T.Ledge, 205, 207, 29, 29),
  fill(T.Ledge, 201, 203, 27, 27),
  fill(T.Ledge, 200, 200, 25, 25),

  // ---------------- D: Ares research station ----------------
  surface(T.Regolith, 212, 236, 24),
  fill(T.Hull, 216, 235, 13, 14), // roof
  fill(T.Hull, 216, 216, 13, 23), // west wall
  fill(T.Hull, 235, 235, 13, 23), // east wall
  back(B.Station, 217, 234, 15, 23),
  fill(T.Door, 216, 216, 21, 23), // sealed door
  fill(T.Scaffold, 218, 220, 22, 22), // step up
  fill(T.Scaffold, 222, 229, 20, 20), // catwalk
];

/** The bridge tiles placed when the canyon bridge extends (west to east). */
export const BRIDGE_TILES: Array<[col: number, row: number]> = Array.from({ length: 12 }, (_, i) => [200 + i, 24]);
export const HATCH_TILES: Array<[number, number]> = [
  [23, 19],
  [23, 20],
  [23, 21],
];
export const FLOOR_HATCH_TILES: Array<[number, number]> = [
  [21, 14],
  [22, 14],
  [21, 15],
  [22, 15],
];
export const STATION_DOOR_TILES: Array<[number, number]> = [
  [216, 21],
  [216, 22],
  [216, 23],
];

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------

export type ObjectKind =
  | "checkpoint"
  | "shipRadio"
  | "hatch"
  | "pickup"
  | "buried"
  | "solarControl"
  | "solarPanel"
  | "battery"
  | "habitat"
  | "receiver"
  | "workstation"
  | "sign"
  | "rover"
  | "bridgeControl"
  | "stationDoor"
  | "log"
  | "beacon"
  | "secret"
  | "practiceConsole"
  | "practiceBuried"
  | "trainingMachine"
  | "echoSensor"
  // Phase 3
  | "transit" // lift, cable car, access gate: moves Laika to another map (see data/regions/registry.ts)
  | "headlampKit"
  | "lightSensor"
  | "powerSource"
  | "junction"
  | "sampler"
  | "liftControl"
  | "relay"
  | "commsJunction"
  | "towerConsole"
  | "cableControl"
  | "acousticSensor"
  | "locker"
  // Phase 4
  | "facility" // a part of the outpost's engineering (see `part` and systems/facilities.ts)
  | "recharge" // suit-energy recharge station
  | "stairs"; // same-map passage with a short fade (habitat <-> lower level)

export interface WorldObject {
  id: string;
  kind: ObjectKind;
  /** Tile column of the object's centre. */
  col: number;
  /** Tile row of the ground tile it stands on (its bottom sits on top of this row). */
  row: number;
  /** Fine horizontal offset in pixels. */
  dx?: number;
  item?: ItemId;
  /** Phase 5: only shown / detectable once Laika has built this equipment (e.g. "booster"). */
  needs?: string;
  /** Short name used by prompts ("Read <label>"). */
  label?: string;
  /** Text for signs and logs: each entry is one short line. */
  text?: string[];
  /** Optional one-line science fact shown when the object is first used / collected. */
  fact?: string;
  /** Phase 3: connection id for "transit" objects. */
  link?: string;
  /** Phase 3: checkpoint without a beacon pole (arrival points of lifts and gates). */
  hidden?: boolean;
  /** Phase 3: relay symbol shown on its plaque (colour-independent puzzle indicator). */
  symbol?: "tri" | "circle" | "square";
  /** Phase 3: relay dish target direction (0 = left, 1 = up-left, 2 = up, 3 = up-right). */
  aim?: number;
  /** Phase 4: which engineering part a "facility" object is (systems/facilities.ts). */
  part?: FacilityPart;
  /** Phase 4: where "stairs" lead on the same map (tile column, ground row). */
  to?: [col: number, row: number];
  /** Phase 4: a recharge station that only works after a repair (Challenge A). */
  broken?: boolean;
}

export type FacilityPart =
  | "cargoLocker"
  | "baseTerminal"
  | "probeOut"
  | "probeIn"
  | "shelterTerminal"
  | "distConsole"
  | "bed"
  | "storage"
  | "recycler"
  | "recyclerPower"
  | "growPower"
  | "planter"
  | "growValve"
  | "waterProcessor"
  | "seismometer"
  | "deepProbe"
  | "telescopeNorth";

export const OBJECTS: WorldObject[] = [
  // ---- A: spacecraft, upper deck (Mission 00 practice objects; never part of the campaign state) ----
  { id: "practice_console", kind: "practiceConsole", col: 14, row: 14, label: "training console" },
  { id: "practice_buried", kind: "practiceBuried", col: 18, row: 14, label: "soil tray" },
  { id: "training_machine", kind: "trainingMachine", col: 20, row: 14, label: "air fan" },

  // ---- A: spacecraft, lower deck ----
  { id: "cp_ship", kind: "checkpoint", col: 6, row: 22, label: "Ship" },
  { id: "shipRadio", kind: "shipRadio", col: 9, row: 22, label: "ship radio" },
  { id: "metal_ship", kind: "pickup", col: 12, row: 22, item: "metal" },
  { id: "hatch", kind: "hatch", col: 22, row: 22, label: "hatch" },
  // Phase 4: the ship's cargo locker (battery regulator) and a recharge point by Laika's bed.
  { id: "recharge_ship", kind: "recharge", col: 5, row: 22, label: "ship charger" },
  { id: "cargo_locker", kind: "facility", part: "cargoLocker", col: 18, row: 22, label: "cargo locker" },

  // ---- B: outpost ----
  { id: "cp_outpost", kind: "checkpoint", col: 30, row: 24, label: "Outpost" },
  // Phase 4 (surface): recharge post, the shelter's outside probe, the base status terminal.
  { id: "recharge_outpost", kind: "recharge", col: 27, row: 24, label: "outpost charger" },
  { id: "probe_surface", kind: "facility", part: "probeOut", col: 50, row: 24, label: "surface probe" },
  { id: "base_terminal", kind: "facility", part: "baseTerminal", col: 57, row: 24, label: "base terminal" },
  // Phase 4 (lower level, floor row 31).
  { id: "shelter_terminal", kind: "facility", part: "shelterTerminal", col: 43, row: 31, label: "shelter monitor" },
  { id: "probe_shelter", kind: "facility", part: "probeIn", col: 46, row: 31, label: "shelter probe" },
  { id: "dist_console", kind: "facility", part: "distConsole", col: 52, row: 31, label: "power console" },
  { id: "buried_cartridge", kind: "buried", col: 55, row: 31, item: "recyclerPart", label: "loose regolith" },
  { id: "habitat_mat", kind: "facility", part: "bed", col: 57, row: 31, label: "sleeping mat" },
  { id: "cp_lower", kind: "checkpoint", col: 59, row: 31, label: "Lower Level" },
  { id: "lower_stairs", kind: "stairs", col: 61, row: 31, to: [60, 24], label: "stairs up" },
  { id: "habitat_storage", kind: "facility", part: "storage", col: 64, row: 31, label: "storage locker" },
  { id: "recycler", kind: "facility", part: "recycler", col: 68, row: 31, label: "recycler" },
  { id: "recycler_power", kind: "facility", part: "recyclerPower", col: 71, row: 31, label: "power box" },
  { id: "grow_power", kind: "facility", part: "growPower", col: 74, row: 31, label: "grow-room power" },
  { id: "planter", kind: "facility", part: "planter", col: 77, row: 31, label: "planter" },
  { id: "grow_valve", kind: "facility", part: "growValve", col: 80, row: 31, label: "water valve" },
  { id: "water_processor", kind: "facility", part: "waterProcessor", col: 84, row: 31, label: "water processor" },
  {
    id: "sign_outpost",
    kind: "sign",
    col: 33,
    row: 24,
    label: "sign",
    text: ["ARES LANDING OUTPOST", "Solar - Battery - Habitat - Comms", "Crew: 0. Dogs: 1 (new!)"],
  },
  { id: "solarControl", kind: "solarControl", col: 37, row: 24, label: "solar array" },
  { id: "panel_1", kind: "solarPanel", col: 40, row: 24, dx: 4 },
  { id: "panel_2", kind: "solarPanel", col: 44, row: 24, dx: 0 },
  { id: "panel_3", kind: "solarPanel", col: 48, row: 24, dx: -4 },
  { id: "battery", kind: "battery", col: 53, row: 24, label: "battery station" },
  { id: "habitat", kind: "habitat", col: 61, row: 24, label: "habitat" },
  {
    id: "echo_sensor",
    kind: "echoSensor",
    col: 66,
    row: 24,
    label: "echo sensor",
    fact: "Sound is quieter on Mars and travels slower than on Earth, because the air is so thin.",
  },
  { id: "receiver", kind: "receiver", col: 70, row: 24, label: "comms receiver" },
  { id: "workstation", kind: "workstation", col: 77, row: 24, label: "repair workstation" },
  // Phase 3: the survey lift's top station. Dead until its power is restored from below (Frozen Depths).
  { id: "outpost_lift", kind: "transit", col: 81, row: 24, label: "survey lift", link: "surveyLift" },
  { id: "cp_outpost_lift", kind: "checkpoint", col: 80, row: 24, label: "Survey Lift", hidden: true },
  { id: "metal_crates", kind: "pickup", col: 84, row: 22, dx: 8, item: "metal" },
  { id: "elec_outpost", kind: "buried", col: 89, row: 24, item: "electronics" },
  // Phase 5: workbench materials for Chapter 5 (a short walk from the workbench) and the booster-only cache.
  { id: "metal_lower", kind: "pickup", col: 86, row: 31, item: "metal" },
  { id: "metal_hab", kind: "pickup", col: 66, row: 31, item: "metal" },
  { id: "elec_lower", kind: "pickup", col: 45, row: 31, item: "electronics" },
  { id: "beacon_cache", kind: "buried", col: 104, row: 28, item: "navBeacon", needs: "booster", label: "Nav Beacon" },
  { id: "metal_cache", kind: "buried", col: 147, row: 31, item: "metal", needs: "booster" },
  {
    id: "sign_canyon",
    kind: "sign",
    col: 92,
    row: 24,
    label: "sign",
    text: ["CRIMSON CANYON", "Low gravity: jumps go higher here.", "Rover R-2 last seen heading east."],
  },

  // ---- C: Crimson Canyon ----
  { id: "cp_canyon", kind: "checkpoint", col: 101, row: 28, label: "Canyon Gate" },
  { id: "metal_canyon", kind: "buried", col: 108, row: 28, item: "metal" },
  { id: "secret_room", kind: "secret", col: 111, row: 31, label: "false wall" },
  { id: "treat", kind: "pickup", col: 106, row: 31, item: "treat" },
  { id: "elec_pit", kind: "pickup", col: 117, row: 31, item: "electronics" },
  { id: "metal_cavern", kind: "pickup", col: 140, row: 31, item: "metal" },
  {
    id: "log_tunnel",
    kind: "log",
    col: 128,
    row: 31,
    label: "survey marker",
    text: ["SURVEY TUNNEL 4", "Dug by rover R-2 to sample deep rock.", "Exit: east."],
  },
  {
    id: "sample_basalt",
    kind: "pickup",
    col: 141,
    row: 20,
    item: "sample",
    label: "Basalt",
    fact: "Basalt: dark volcanic rock. Much of Mars is covered in it.",
  },
  {
    id: "sample_hematite",
    kind: "pickup",
    col: 145,
    row: 16,
    item: "sample",
    label: "Hematite 'blueberry'",
    fact: "Hematite 'blueberries': tiny balls that formed in water, found by the Opportunity rover.",
  },
  { id: "metal_mesa", kind: "pickup", col: 135, row: 24, item: "metal" },
  { id: "elec_canyon", kind: "buried", col: 158, row: 28, item: "electronics" },
  // Phase 4, Challenge A "Forgotten instrument": an old recharge post and the seismometer it once powered.
  { id: "recharge_canyon", kind: "recharge", col: 153, row: 28, label: "old recharge post", broken: true },
  { id: "seismometer", kind: "facility", part: "seismometer", col: 155, row: 28, label: "seismometer" },
  { id: "buried_cell", kind: "buried", col: 162, row: 28, item: "powerCell", label: "power cell" },
  { id: "cp_rover", kind: "checkpoint", col: 166, row: 28, label: "Rover Wreck" },
  { id: "elec_rover", kind: "buried", col: 170, row: 28, item: "electronics" },
  {
    id: "rover",
    kind: "rover",
    col: 175,
    row: 28,
    label: "rover R-2",
    text: [
      "ROVER R-2 // LAST LOG",
      "Task: deliver spare comms module to outpost.",
      "Wheel 3 jammed. Module stowed in soil nearby.",
      "Strange signal from the east. Investigating.",
    ],
  },
  { id: "comms_module", kind: "buried", col: 180, row: 28, item: "commsModule" },
  { id: "cp_rim", kind: "checkpoint", col: 192, row: 24, label: "East Rim" },
  {
    id: "sample_gypsum",
    kind: "buried",
    col: 189,
    row: 24,
    item: "sample",
    label: "Gypsum vein",
    fact: "Gypsum veins: bright mineral cracks left by water. The Curiosity rover found many.",
  },
  { id: "bridgeControl", kind: "bridgeControl", col: 197, row: 24, label: "bridge control" },

  // ---- D: research station ----
  { id: "stationDoor", kind: "stationDoor", col: 214, row: 24, label: "station door" },
  { id: "recharge_station", kind: "recharge", col: 218, row: 24, label: "station charger" },
  { id: "cp_station", kind: "checkpoint", col: 219, row: 24, label: "Ares Station" },
  {
    id: "log_station",
    kind: "log",
    col: 222,
    row: 24,
    label: "station log",
    text: [
      "ARES STATION // DAY 211",
      "The signal repeats every 88 minutes.",
      "It is not coming from Earth.",
      "We have gone north to find it.",
    ],
  },
  {
    id: "log_catwalk",
    kind: "log",
    col: 226,
    row: 20,
    label: "pinned note",
    text: ["NOTE ON THE WALL", "'If anyone finds this station:", " the beacon console still works.", " Listen closely.'"],
  },
  { id: "beacon", kind: "beacon", col: 231, row: 24, label: "signal console" },
  // Phase 3: the station's freight lift down to the survey caves, and the cable car dock from the ridge.
  { id: "station_lift", kind: "transit", col: 226, row: 24, label: "freight lift", link: "freightLift" },
  { id: "cp_station_lift", kind: "checkpoint", col: 225, row: 24, label: "Freight Lift", hidden: true },
  // The dock is three tiles from the signal console, so E beside the console never rides the cable car.
  { id: "station_cable", kind: "transit", col: 234, row: 24, label: "cable car", link: "skyline" },
  { id: "cp_station_cable", kind: "checkpoint", col: 234, row: 24, dx: -10, label: "Cable Car Dock", hidden: true },
];

export function objectById(id: string): WorldObject | undefined {
  return OBJECTS.find((o) => o.id === id);
}

/** Pixel position of an object's anchor (bottom centre). */
export function objectPos(o: WorldObject): { x: number; y: number } {
  return { x: o.col * 16 + 8 + (o.dx ?? 0), y: o.row * 16 };
}

// ---------------------------------------------------------------------------
// Regions, interiors and secrets
// ---------------------------------------------------------------------------

export interface Region {
  id: string;
  name: string;
  /** Column range (inclusive). Rows are not needed: regions are vertical slices. */
  x0: number;
  x1: number;
  music: "game";
  ambience: "ship" | "outside" | "station";
  /** Phase 3: world region number shown on the title card ("REGION 02"), and its id on the world map. */
  regionNo?: number;
}

export const REGIONS: Region[] = [
  { id: "ship", name: "Laika's Ship", x0: 0, x1: 23, music: "game", ambience: "ship", regionNo: 1 },
  { id: "outpost", name: "Landing Outpost", x0: 24, x1: 93, music: "game", ambience: "outside", regionNo: 1 },
  { id: "canyon", name: "Crimson Canyon", x0: 94, x1: 211, music: "game", ambience: "outside", regionNo: 2 },
  { id: "station", name: "Ares Research Station", x0: 212, x1: 239, music: "game", ambience: "station", regionNo: 3 },
];

export interface TileRect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Building interiors: the exterior shell fades out while Laika is inside. */
export const INTERIORS: Record<"ship" | "station", TileRect> = {
  ship: { x0: 3, x1: 23, y0: 6, y1: 23 },
  station: { x0: 216, x1: 235, y0: 13, y1: 23 },
};

/** Secret areas: covered by a false rock wall that fades when Laika walks in. */
export const SECRETS: Array<{ id: string; rect: TileRect }> = [{ id: "secret_room", rect: { x0: 105, x1: 111, y0: 29, y1: 30 } }];

/** Campaign start (lower deck), used when the tutorial is skipped. */
export const SPAWN = { col: 6, row: 22 };
/** Mission 00 starts on the upper deck, by Laika's bed. */
export const TUTORIAL_SPAWN = { col: 6, row: 14 };
/** The tutorial ends when Laika drops through the floor hatch onto the lower deck. */
export const TUTORIAL_EXIT_ROW = 16;
/** Ids of objects that only exist for Mission 00. */
export const PRACTICE_IDS = new Set(["practice_console", "practice_buried", "training_machine"]);

/** Optional areas: time spent here never counts towards automatic hints. */
export const OPTIONAL_ZONES: TileRect[] = [
  { x0: 133, x1: 147, y0: 8, y1: 23 }, // mesa ledges
  { x0: 104, x1: 111, y0: 28, y1: 31 }, // secret room
  { x0: 200, x1: 211, y0: 25, y1: 33 }, // chasm floor
];
