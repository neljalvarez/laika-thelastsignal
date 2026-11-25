/**
 * Phase 3: the world is made of several MAPS, each a handcrafted tile grid with its own look,
 * objects and atmosphere. A map contains one or more REGIONS (named areas with a title card and a
 * number) and finer SECTIONS (cells revealed on the world map as Laika explores).
 *
 *   surface  Region 01 Landing Outpost (+ ship), Region 02 Crimson Canyon, Region 03 Ares Station
 *   depths   Region 04 Frozen Depths
 *   ridge    Region 05 Echo Ridge
 *
 * Maps are linked by CONNECTIONS (lifts, gates, a cable car) defined in registry.ts. Only the map
 * Laika is in is built and rendered. Everything here is data; rules live in systems/.
 */
import type { FlagId, GameState } from "../../systems/state";
import type { Region, TerrainOp, TileRect, WorldObject } from "../world";

export type MapId = "surface" | "depths" | "ridge";

export interface Section {
  id: string;
  name: string;
  /** Region id this section belongs to. */
  region: string;
  rect: TileRect;
  /** Optional/secret sections are never drawn on the map until Laika has been inside. */
  optional?: boolean;
}

export interface Landmark {
  id: string;
  name: string;
  col: number;
  row: number;
  /** Laika discovers the landmark when she is inside this area (it can be seen from there). */
  seenFrom: TileRect;
}

/** A powered cable drawn as a polyline (tile coordinates of the cable's centre line). */
export interface CableRun {
  group: string;
  points: Array<[col: number, row: number]>;
}

/** A light source for dark maps. `group` lights only shine once that power group is on. */
export interface LightSpot {
  col: number;
  row: number;
  radius: number;
  group?: string;
  warm?: boolean;
  flicker?: boolean;
}

/** Decorative sprite. `reflective` decor sits above the darkness and only shows in the headlamp beam. */
export interface Decor {
  key: string;
  col: number;
  row: number;
  dx?: number;
  dy?: number;
  front?: boolean;
  reflective?: boolean;
  flip?: boolean;
  /** Parallax-ish scroll factor for distant landmarks. */
  scroll?: [number, number];
  alpha?: number;
  scale?: number;
}

export interface MapTheme {
  backdrop: "surface" | "depths" | "ridge";
  /** Darkness overlay (Frozen Depths). */
  dark: boolean;
  ambience: "outside" | "depths" | "ridge";
  particles?: "frost" | "dust";
  /** Camera Y around which the parallax layers are centred. */
  refY: number;
}

/** Tiles that change with the state: doors that open, bridges that extend. */
export interface TileGroup {
  tiles: Array<[col: number, row: number]>;
  /** Present when the state says so (doors: closed while false; bridges: placed while true). */
  when: (s: GameState) => boolean;
}

export interface MapDef {
  id: MapId;
  name: string;
  w: number;
  h: number;
  terrain: TerrainOp[];
  objects: WorldObject[];
  regions: Region[];
  sections: Section[];
  landmarks: Landmark[];
  secrets: Array<{ id: string; rect: TileRect }>;
  optionalZones: TileRect[];
  theme: MapTheme;
  decor: Decor[];
  cables: CableRun[];
  lights: LightSpot[];
  /** Solid door tiles that disappear when `when(s)` becomes true. */
  doors: Record<string, TileGroup>;
  /** One-way bridge tiles that appear when `when(s)` becomes true. */
  bridges: Record<string, TileGroup>;
  /** Where the map sits on the world-map journal (0-100 units, x = east, y = down). */
  frame: { x: number; y: number; w: number; h: number };
  /** Areas where a first-time contextual tip is shown (e.g. a Thruster Boots reminder). */
  tipZones?: Array<{ id: string; rect: TileRect }>;
}

export interface ConnectionEnd {
  map: MapId;
  /** The transit object Laika uses on this side. */
  object: string;
  /** Hidden checkpoint where she arrives on this side. */
  arrive: string;
  verb: string;
}

export interface Connection {
  id: string;
  name: string;
  a: ConnectionEnd;
  b: ConnectionEnd;
  /** True once the connection can be used in both directions. */
  open: (s: GameState) => boolean;
  /** Why it is closed, per side (shown as the prompt detail and in a toast). */
  locked: { a: string; b: string };
  /** A one-time activation on one side opens it (e.g. starting a lift's motor). */
  activate?: { side: "a" | "b"; ready: (s: GameState) => boolean; flag: FlagId; verb: string; notReady: string };
  /** Shortcuts are drawn in green on the world map. */
  shortcut?: boolean;
}
