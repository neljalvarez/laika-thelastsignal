/**
 * Region 05: ECHO RIDGE. A tall, wind-scoured ridge north-east of the station, reached through the
 * Frozen Depths' North Access. The relay tower is visible from the very first screen (a background
 * silhouette) and the route climbs towards it:
 *
 *   1  Lower approach        arrival hatch, Relay A (dusty: tail sweep), rover tracks to an abandoned hut
 *   2  Abandoned relay gear  old antenna, buried rover wheel (secret: sniff)
 *   3  Cliff climb           switchback ledges, 2-tile steps (mandatory, no precision needed)
 *   4  High ledges (opt.)    Thruster Boots route: olivine sample, hidden weather station
 *   5  Ridge Camp            checkpoint + comms junction (install the relay cell); habitat ruin
 *                            behind a false wall (crew recording)
 *   -  Hidden relay niche    Relay C, found by following its faint signal with the scanner
 *   6  Antenna platform      Relay B: turn the dish to match the painted plaque
 *   7  Main relay tower      opens when the relay network is online; trace the signal at the top
 *   8  Scenic overlook       acoustic sensor (bark) extends a bridge to a cache (Golden Treat)
 *   9  Cable car             tower -> Ares Station: the return shortcut
 */
import { B, T, type TerrainOp, type WorldObject } from "../world";
import type { MapDef } from "./types";

const fill = (t: T, x0: number, x1: number, y0: number, y1: number): TerrainOp => ({ op: "fill", t, x0, x1, y0, y1 });
const clear = (x0: number, x1: number, y0: number, y1: number): TerrainOp => ({ op: "clear", x0, x1, y0, y1 });
const surface = (t: T, x0: number, x1: number, row: number): TerrainOp => ({ op: "surface", t, x0, x1, row });
const back = (b: B, x0: number, x1: number, y0: number, y1: number): TerrainOp => ({ op: "back", b, x0, x1, y0, y1 });

export const RIDGE_W = 112;
export const RIDGE_H = 64;

const TERRAIN: TerrainOp[] = [
  // Rock pillars (background only) holding up the overlook and the cache: the sky stays open so the
  // tower can be seen from the very first screen.
  back(B.Ridge, 66, 70, 14, 29),
  back(B.Ridge, 51, 52, 13, 33),
  // Map edges.
  fill(T.RidgeRock, 0, 1, 0, RIDGE_H - 1),
  fill(T.RidgeRock, 108, RIDGE_W - 1, 0, RIDGE_H - 1),

  // 1-2: lower approach.
  surface(T.RidgeRock, 2, 41, 58),
  // 3: steps up to the cliff, then switchback ledges.
  surface(T.RidgeRock, 42, 44, 56),
  surface(T.RidgeRock, 45, 47, 54),
  surface(T.RidgeRock, 48, 50, 52),
  fill(T.Ledge, 44, 47, 50, 50),
  fill(T.Ledge, 40, 43, 48, 48),
  fill(T.Ledge, 44, 47, 46, 46),
  fill(T.Ledge, 40, 43, 44, 44),
  fill(T.Ledge, 44, 47, 42, 42),
  fill(T.Ledge, 40, 43, 40, 40),
  fill(T.Ledge, 44, 47, 38, 38),
  fill(T.Ledge, 48, 50, 36, 36),
  // A boulder hangs off the cliff; a hidden niche inside it holds Relay C.
  fill(T.RidgeRock, 30, 39, 36, 46),
  clear(32, 39, 39, 41),
  back(B.Ridge, 32, 39, 39, 41),

  // 4: optional high ledges (4-tile climbs: Thruster Boots).
  fill(T.Ledge, 22, 24, 54, 54),
  fill(T.Ledge, 16, 18, 50, 50),
  fill(T.Ledge, 10, 12, 46, 46),
  fill(T.Ledge, 16, 18, 42, 42),
  fill(T.Ledge, 8, 12, 38, 38),
  fill(T.Ledge, 14, 16, 34, 34),
  fill(T.RidgeRock, 20, 23, 30, 33), // weather-station pillar
  // Phase 4, Challenge C "High observation platform": an old survey scaffold 7 tiles above the
  // pillar. Only a suit-boosted second air jump (Thruster Boots + stored suit energy) reaches it.
  fill(T.Scaffold, 17, 22, 23, 23),
  fill(T.Ledge, 26, 28, 33, 33), // drop-off towards the boulder top

  // 5: Ridge Camp mesa, with a habitat ruin hidden inside a rock knob.
  surface(T.RidgeRock, 51, 75, 34),
  fill(T.Ledge, 62, 64, 32, 32),
  fill(T.RidgeRock, 66, 75, 30, 33),
  clear(66, 74, 31, 33),
  back(B.Ridge, 66, 74, 31, 33),

  // 6: rising to the antenna platform.
  surface(T.RidgeRock, 76, 79, 28),
  surface(T.RidgeRock, 80, 83, 26),
  surface(T.RidgeRock, 84, 107, 24),
  fill(T.Scaffold, 84, 90, 24, 24),

  // 7: the relay tower. A metal wall with a powered door; scaffold stairs inside; top deck.
  fill(T.Hull, 91, 91, 10, 20),
  fill(T.Shutter, 91, 91, 21, 23),
  back(B.Station, 92, 107, 9, 23),
  fill(T.Scaffold, 93, 96, 22, 22),
  fill(T.Scaffold, 100, 103, 20, 20),
  fill(T.Scaffold, 93, 96, 18, 18),
  fill(T.Scaffold, 100, 103, 16, 16),
  fill(T.Scaffold, 93, 96, 14, 14),
  fill(T.Scaffold, 100, 103, 12, 12),
  fill(T.Scaffold, 92, 107, 10, 10),

  // 8: overlook outcrop, catwalk to the tower's top doorway, and the cache across a gap.
  fill(T.RidgeRock, 60, 75, 10, 13),
  fill(T.Scaffold, 76, 90, 10, 10),
  fill(T.RidgeRock, 49, 54, 10, 12),
];

const OBJECTS: WorldObject[] = [
  // ---- 1: lower approach ----
  { id: "ridge_hatch", kind: "transit", col: 4, row: 58, label: "north access hatch", link: "northGate" },
  { id: "cp_ridge_hatch", kind: "checkpoint", col: 6, row: 58, label: "North Access", hidden: true },
  { id: "cp_ridge_base", kind: "checkpoint", col: 11, row: 58, label: "Ridge Base" },
  {
    id: "sign_ridge",
    kind: "sign",
    col: 9,
    row: 58,
    label: "sign",
    text: ["ECHO RIDGE RELAY ROUTE", "Relays: A (here) - B (platform) - C (?)", "Tower access opens when all relays report in."],
  },
  { id: "relay_a", kind: "relay", col: 19, row: 58, label: "Relay A", symbol: "tri", aim: 3 },
  {
    id: "rover_wheel",
    kind: "buried",
    col: 33,
    row: 58,
    item: "roverPart",
    label: "R-2's lost wheel",
    text: ["WHEEL 3, ROVER R-2", "So this is where it came off.", "The tracks end here, by the old survey hut."],
  },
  {
    id: "log_hut",
    kind: "log",
    col: 37,
    row: 58,
    label: "hut logbook",
    text: [
      "SURVEY HUT LOG",
      "REAL: rovers on Mars send most of their data to Earth through orbiters that act as relays.",
      "GAME: this ridge's relays and their 88-minute signal are fiction.",
    ],
  },

  // ---- 3: cliff climb; hidden niche ----
  { id: "relay_c", kind: "relay", col: 34, row: 42, label: "Relay C", symbol: "square", aim: 4 },
  { id: "secret_niche", kind: "secret", col: 39, row: 42, label: "loose rock" },

  // ---- Phase 4, Challenge C: the high observation platform ----
  { id: "telescope_north", kind: "facility", part: "telescopeNorth", col: 20, row: 23, label: "survey telescope" },
  { id: "rover_camera", kind: "pickup", col: 17, row: 23, item: "roverPart", label: "R-2's lost camera" },

  // ---- 4: high ledges (Thruster Boots) ----
  {
    id: "sample_olivine",
    kind: "pickup",
    col: 9,
    row: 38,
    item: "sample",
    label: "Olivine sand",
    fact: "Olivine: a green mineral from volcanic rock. Mars rovers have found it in sand and rocks.",
  },
  {
    id: "weather_station",
    kind: "log",
    col: 21,
    row: 30,
    label: "weather station",
    text: [
      "HIDDEN WEATHER STATION",
      "Wind gusts from the north-west. Dust devils seen at noon.",
      "REAL: Mars has dust devils, whirlwinds of dust that rovers have filmed.",
    ],
  },

  // ---- 5: Ridge Camp ----
  { id: "cp_ridge_camp", kind: "checkpoint", col: 53, row: 34, label: "Ridge Camp" },
  { id: "recharge_camp", kind: "recharge", col: 55, row: 34, label: "camp charger" },
  // Phase 5: workbench materials.
  { id: "metal_ridge", kind: "buried", col: 63, row: 34, item: "metal" },
  { id: "elec_ridge", kind: "buried", col: 40, row: 58, item: "electronics" },
  { id: "metal_ridge2", kind: "pickup", col: 28, row: 58, item: "metal" },
  { id: "elec_ridge2", kind: "pickup", col: 30, row: 58, item: "electronics" },
  { id: "comms_junction", kind: "commsJunction", col: 58, row: 34, label: "ridge junction" },
  {
    id: "log_camp",
    kind: "log",
    col: 61,
    row: 34,
    label: "camp board",
    text: ["RIDGE CAMP", "Crew of three, here on day 205.", "'Tower first, then north.'"],
  },
  { id: "secret_ruin", kind: "secret", col: 66, row: 34, label: "rockfall" },
  {
    id: "recording_ruin",
    kind: "pickup",
    col: 71,
    row: 34,
    item: "recording",
    label: "Crew recording",
    text: ["RECORDING // RIDGE CAMP", "'The relays don't just repeat the signal...", " they were BUILT to catch it. Who built them first?'"],
  },

  // ---- 6: antenna platform ----
  { id: "cp_ridge_platform", kind: "checkpoint", col: 85, row: 24, label: "Antenna Platform" },
  { id: "relay_b", kind: "relay", col: 88, row: 24, label: "Relay B", symbol: "circle", aim: 3 },

  // ---- 7: tower ----
  { id: "tower_console", kind: "towerConsole", col: 99, row: 10, label: "tower console" },
  { id: "recharge_tower", kind: "recharge", col: 95, row: 10, label: "tower charger" },
  { id: "cp_ridge_tower", kind: "checkpoint", col: 103, row: 10, label: "Tower Top", hidden: true },
  { id: "ridge_cable", kind: "transit", col: 105, row: 10, label: "cable car", link: "skyline" },

  // ---- 8: overlook ----
  {
    id: "acoustic_sensor",
    kind: "acousticSensor",
    col: 66,
    row: 10,
    label: "acoustic sensor",
    fact: "Mars' air is so thin that sound barely carries. This sensor 'hears' through Laika's suit radio instead.",
  },
  { id: "treat_ridge", kind: "pickup", col: 51, row: 10, item: "treat", label: "Golden Treat" },
];

export const ECHO_RIDGE: MapDef = {
  id: "ridge",
  name: "Echo Ridge",
  w: RIDGE_W,
  h: RIDGE_H,
  terrain: TERRAIN,
  objects: OBJECTS,
  regions: [{ id: "ridge", name: "Echo Ridge", x0: 0, x1: RIDGE_W - 1, music: "game", ambience: "outside", regionNo: 5 }],
  sections: [
    { id: "r_niche", name: "Hidden Relay Niche", region: "ridge", rect: { x0: 32, x1: 39, y0: 39, y1: 41 }, optional: true },
    { id: "r_ruin", name: "Habitat Ruin", region: "ridge", rect: { x0: 66, x1: 74, y0: 31, y1: 33 }, optional: true },
    { id: "r_cache", name: "Overlook Cache", region: "ridge", rect: { x0: 49, x1: 59, y0: 4, y1: 9 }, optional: true },
    { id: "r_tower", name: "Relay Tower", region: "ridge", rect: { x0: 91, x1: 107, y0: 4, y1: 23 } },
    { id: "r_overlook", name: "Scenic Overlook", region: "ridge", rect: { x0: 60, x1: 90, y0: 4, y1: 9 } },
    { id: "r_platform", name: "Antenna Platform", region: "ridge", rect: { x0: 76, x1: 90, y0: 14, y1: 27 } },
    { id: "r_camp", name: "Ridge Camp", region: "ridge", rect: { x0: 51, x1: 75, y0: 24, y1: 33 } },
    { id: "r_climb", name: "Cliff Climb", region: "ridge", rect: { x0: 40, x1: 50, y0: 30, y1: 56 } },
    { id: "r_high", name: "High Ledges", region: "ridge", rect: { x0: 2, x1: 39, y0: 20, y1: 49 }, optional: true },
    { id: "r_approach", name: "Lower Approach", region: "ridge", rect: { x0: 2, x1: 41, y0: 50, y1: 57 } },
  ],
  landmarks: [
    { id: "lm_tower", name: "Echo Ridge Relay Tower", col: 99, row: 8, seenFrom: { x0: 0, x1: RIDGE_W - 1, y0: 0, y1: RIDGE_H - 1 } },
    { id: "lm_camp", name: "Ridge Camp", col: 58, row: 33, seenFrom: { x0: 40, x1: 80, y0: 20, y1: 40 } },
    { id: "lm_weather", name: "Weather Station", col: 21, row: 29, seenFrom: { x0: 2, x1: 39, y0: 20, y1: 45 } },
    { id: "lm_overlook", name: "Scenic Overlook", col: 68, row: 9, seenFrom: { x0: 55, x1: 107, y0: 2, y1: 13 } },
  ],
  secrets: [
    { id: "secret_niche", rect: { x0: 32, x1: 39, y0: 39, y1: 41 } },
    { id: "secret_ruin", rect: { x0: 66, x1: 74, y0: 31, y1: 33 } },
  ],
  optionalZones: [
    { x0: 2, x1: 39, y0: 20, y1: 49 },
    { x0: 49, x1: 75, y0: 4, y1: 9 },
    { x0: 66, x1: 74, y0: 31, y1: 33 },
  ],
  theme: { backdrop: "ridge", dark: false, ambience: "ridge", particles: "dust", refY: 640 },
  decor: [
    { key: "rover_tracks", col: 23, row: 58 },
    { key: "rover_tracks", col: 28, row: 58 },
    { key: "survey_hut", col: 36, row: 58 },
    { key: "old_antenna", col: 27, row: 58 },
    { key: "hoodoo", col: 3, row: 58, scale: 1 },
    { key: "hoodoo", col: 39, row: 52, scale: 0.7, alpha: 0.9 },
    { key: "rope", col: 49, row: 52, dy: -2 },
    { key: "camp_tent", col: 56, row: 34 },
    { key: "storage_box", col: 64, row: 34 },
    { key: "habitat_ruin", col: 70, row: 34 },
    { key: "tower_frame", col: 99, row: 24 },
    { key: "tower_dish", col: 100, row: 10, dy: -10 },
    { key: "plaque_tri", col: 21, row: 58 },
    { key: "plaque_square", col: 36, row: 42 },
    { key: "plaque_circle", col: 90, row: 24 },
    { key: "telescope", col: 72, row: 10 },
    { key: "sign_overlook", col: 62, row: 10 },
  ],
  cables: [
    { group: "network", points: [[58.6, 33.7], [75.4, 33.7], [75.4, 27.7], [79.4, 27.7], [79.4, 25.7], [90.6, 25.7], [90.6, 23.7]] },
    { group: "network", points: [[91.6, 23.7], [106.8, 23.7], [106.8, 10.4]] },
  ],
  lights: [],
  doors: {
    // Opens when systems/puzzles.ts reports the relay network online.
    tower: { tiles: [[91, 21], [91, 22], [91, 23]], when: (s) => s.flags.relayNetworkOnline },
  },
  bridges: {
    overlook: { tiles: [[55, 10], [56, 10], [57, 10], [58, 10], [59, 10]], when: (s) => s.flags.ridgeBridgeOut },
  },
  frame: { x: 80, y: 2, w: 33.6, h: 19.2 },
  tipZones: [{ id: "tip:bootsRidge", rect: { x0: 14, x1: 28, y0: 50, y1: 57 } }],
};
