/**
 * The surface map: Laika's ship and the Landing Outpost (Region 01), Crimson Canyon (Region 02) and
 * the Ares Research Station (Region 03). It stays one seamless map, exactly as in Phases 1-2, so
 * every existing object id, checkpoint and save keeps working. Its terrain and objects still live in
 * data/world.ts; this module only describes it to the region registry.
 */
import { OBJECTS, OPTIONAL_ZONES, REGIONS, SECRETS, TERRAIN, WORLD_H, WORLD_W } from "../world";
import type { MapDef } from "./types";

export const SURFACE: MapDef = {
  id: "surface",
  name: "Surface",
  w: WORLD_W,
  h: WORLD_H,
  terrain: TERRAIN,
  objects: OBJECTS,
  regions: REGIONS,
  sections: [
    { id: "s_ship", name: "Laika's Ship", region: "ship", rect: { x0: 3, x1: 23, y0: 6, y1: 23 } },
    { id: "s_outpost", name: "Landing Outpost", region: "outpost", rect: { x0: 24, x1: 93, y0: 8, y1: 23 } },
    { id: "s_lower", name: "Outpost Lower Level", region: "outpost", rect: { x0: 40, x1: 88, y0: 25, y1: 30 } },
    { id: "s_canyon_gate", name: "Canyon Gate & Jump Pit", region: "canyon", rect: { x0: 94, x1: 131, y0: 8, y1: 27 } },
    { id: "s_secret_room", name: "Secret Room", region: "canyon", rect: { x0: 104, x1: 111, y0: 28, y1: 31 }, optional: true },
    { id: "s_tunnel", name: "Survey Tunnel & Cavern", region: "canyon", rect: { x0: 112, x1: 151, y0: 28, y1: 31 } },
    { id: "s_mesa", name: "Twin Mesa", region: "canyon", rect: { x0: 132, x1: 150, y0: 8, y1: 27 } },
    { id: "s_rover", name: "Rover Wreck", region: "canyon", rect: { x0: 151, x1: 183, y0: 8, y1: 27 } },
    { id: "s_rim", name: "East Rim & Chasm", region: "canyon", rect: { x0: 184, x1: 211, y0: 8, y1: 33 } },
    { id: "s_station", name: "Ares Research Station", region: "station", rect: { x0: 212, x1: 239, y0: 8, y1: 23 } },
  ],
  landmarks: [
    { id: "lm_ship", name: "Laika's Ship", col: 12, row: 14, seenFrom: { x0: 0, x1: 40, y0: 0, y1: 33 } },
    { id: "lm_dish", name: "Outpost Radio Mast", col: 70, row: 18, seenFrom: { x0: 40, x1: 95, y0: 0, y1: 33 } },
    { id: "lm_spire", name: "The Red Spire", col: 104, row: 20, seenFrom: { x0: 85, x1: 130, y0: 0, y1: 33 } },
    { id: "lm_rover", name: "Rover R-2", col: 175, row: 27, seenFrom: { x0: 160, x1: 190, y0: 0, y1: 33 } },
    { id: "lm_station", name: "Ares Station Dish", col: 225, row: 10, seenFrom: { x0: 190, x1: 239, y0: 0, y1: 33 } },
  ],
  secrets: SECRETS,
  optionalZones: OPTIONAL_ZONES,
  theme: { backdrop: "surface", dark: false, ambience: "outside", refY: 210 },
  // Surface decor, lamps and cables are drawn by WorldView / ObjectsView (Phase 1 code paths).
  decor: [],
  cables: [],
  lights: [],
  doors: {},
  bridges: {},
  frame: { x: 2, y: 26, w: 72, h: 10.2 },
};
