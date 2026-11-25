/**
 * Region 04: FROZEN DEPTHS. An abandoned survey facility under the plain between the Ares Station
 * (east) and the Landing Outpost (west). Laika arrives by the station's freight lift and works her
 * way WEST and down:
 *
 *   E  Survey Entrance (lit)        headlamp kit, freight lift, checkpoint
 *   P  Descending survey passage    a failing lamp, a crew log
 *   C  Dark observation chamber     PUZZLE A "Light the way": reflective markers show the route to a
 *                                   light-sensor shutter. Upper ice ledges -> hidden alcove (secret);
 *                                   lower floor -> buried recorder (secret) + ledge ladder back up.
 *   Q  Frozen equipment room        warm crew lamp, salvage locker, buried power coupling
 *   J  Power junction               PUZZLE B "Restore the circuit": battery -> broken junction ->
 *                                   lights, ice-chamber door, survey lift, service hatch
 *   I  Water-ice research chamber   PUZZLE C: powered core drill -> water-ice sample + relay cell;
 *                                   a Thruster-Boots shelf (secret) and a buried clay sample
 *   L  Lift hall                    the survey lift up to the outpost (shortcut once started)
 *   S  Service tunnel               under everything, from the lift hall to the NORTH ACCESS gate
 *                                   (the route to Echo Ridge, sealed until Mission 02 ends)
 *
 * Rows grow downward. Climbs on the main route are at most 2 tiles, gaps at most 3 (tests/regions.test.ts).
 */
import { B, T, type TerrainOp, type WorldObject } from "../world";
import type { MapDef } from "./types";

const fill = (t: T, x0: number, x1: number, y0: number, y1: number): TerrainOp => ({ op: "fill", t, x0, x1, y0, y1 });
const clear = (x0: number, x1: number, y0: number, y1: number): TerrainOp => ({ op: "clear", x0, x1, y0, y1 });
const back = (b: B, x0: number, x1: number, y0: number, y1: number): TerrainOp => ({ op: "back", b, x0, x1, y0, y1 });
/** Open a room: rows top..floor-1 become air, `floor` stays solid. */
const carve = (x0: number, x1: number, top: number, floor: number): TerrainOp[] => [clear(x0, x1, top, floor - 1), back(B.Frost, x0, x1, top, floor - 1)];

export const DEPTHS_W = 136;
export const DEPTHS_H = 42;

const TERRAIN: TerrainOp[] = [
  fill(T.FrostRock, 0, DEPTHS_W - 1, 0, DEPTHS_H - 1),
  // Ice bands around the research chamber (ceiling, floor, west wall).
  fill(T.Ice, 14, 33, 14, 17),
  fill(T.Ice, 14, 33, 28, 30),
  fill(T.Ice, 34, 40, 28, 29),

  // E: Survey Entrance (arrival from the station's freight lift).
  clear(120, 131, 6, 11),
  back(B.Lab, 120, 131, 6, 11),

  // P: the survey passage steps down to the west.
  ...carve(112, 119, 8, 14),
  ...carve(104, 111, 10, 16),
  ...carve(96, 103, 12, 18),

  // C: dark observation chamber.
  ...carve(66, 95, 10, 30), // tall enough to jump up onto the upper ice shelves
  fill(T.Scaffold, 82, 95, 18, 18), // survey walkway (continues the passage floor)
  fill(T.Scaffold, 66, 81, 20, 20), // lower walkway to the light-sensor shutter
  // Upper branch: ice shelves up to a nook... and a false wall into the hidden alcove.
  fill(T.IceLedge, 76, 79, 16, 16),
  fill(T.IceLedge, 66, 73, 14, 14),
  ...carve(60, 65, 10, 14),
  ...carve(52, 59, 10, 14),
  // Lower branch: the chamber floor, with an ice-shelf ladder back up to the walkway.
  fill(T.IceLedge, 90, 92, 28, 28),
  fill(T.IceLedge, 86, 88, 26, 26),
  fill(T.IceLedge, 90, 92, 24, 24),
  fill(T.IceLedge, 86, 88, 22, 22),
  fill(T.IceLedge, 90, 92, 20, 20),

  // Light-sensor shutter in the chamber's west wall, and the corridor behind it.
  ...carve(56, 64, 17, 20),
  fill(T.Shutter, 65, 65, 17, 19),

  // Q: frozen equipment room, with a pit in its west end down to the junction.
  ...carve(34, 55, 15, 20), // ceiling at row 14 is the hidden alcove's floor
  clear(34, 41, 20, 22),
  back(B.Frost, 34, 41, 20, 22),
  // J: power junction hall.
  ...carve(34, 60, 23, 28),
  // Ice-shelf ladder in the pit (zigzag), from the junction floor up to the equipment room.
  fill(T.IceLedge, 38, 41, 26, 26),
  fill(T.IceLedge, 34, 37, 24, 24),
  fill(T.IceLedge, 38, 41, 22, 22),

  // I: water-ice research chamber, behind a powered door.
  clear(15, 32, 18, 27),
  back(B.Lab, 15, 32, 18, 27),
  clear(33, 33, 25, 27),
  fill(T.Shutter, 33, 33, 25, 27),
  fill(T.Ice, 26, 27, 26, 27), // ice block: a little hop, and the boots launch point
  fill(T.IceLedge, 18, 21, 21, 21), // high shelf (Thruster Boots)

  // L: lift hall, open to the chamber.
  clear(2, 13, 20, 27),
  back(B.Lab, 2, 13, 20, 27),
  clear(14, 14, 24, 27),
  back(B.Frost, 14, 14, 24, 27),
  // S: service tunnel to the North Access (carved before the shaft ladder so it keeps its shelves).
  ...carve(2, 132, 34, 38),
  // Service hatch in the lift hall floor (opens with the circuit) and the shaft below it.
  clear(2, 7, 28, 33),
  back(B.Frost, 2, 7, 28, 33),
  fill(T.Shutter, 2, 7, 28, 28),
  fill(T.IceLedge, 5, 7, 30, 30),
  fill(T.IceLedge, 2, 4, 32, 32),
  fill(T.IceLedge, 5, 7, 34, 34),
  fill(T.IceLedge, 2, 4, 36, 36),
];

const OBJECTS: WorldObject[] = [
  // ---- E: Survey Entrance ----
  { id: "cp_depths_entry", kind: "checkpoint", col: 121, row: 12, label: "Survey Entrance" },
  {
    id: "headlamp_kit",
    kind: "headlampKit",
    col: 124,
    row: 12,
    label: "survey lamp",
    fact: "Mars gets less than half the sunlight Earth does, and none at all underground. Explorers bring their own light.",
  },
  { id: "cp_depths_freight", kind: "checkpoint", col: 126, row: 12, label: "Freight Lift", hidden: true },
  { id: "depths_freight", kind: "transit", col: 128, row: 12, label: "freight lift", link: "freightLift" },
  {
    id: "sign_depths",
    kind: "sign",
    col: 131, // three tiles from the freight lift (and signs have a short reach), so E at the lift rides it
    dx: -8, // keeps the sign inside the room's east wall
    row: 12,
    label: "sign",
    text: ["ARES SURVEY FACILITY // LEVEL B", "Ice research - Power junction - Survey lift", "Lights: OFFLINE. Take a lamp."],
  },

  // ---- P: passage ----
  {
    id: "log_passage",
    kind: "log",
    col: 106,
    row: 16,
    label: "survey log",
    text: ["SURVEY LOG 12", "Chamber lights failed again.", "Follow the reflective markers to the sensor door.", "The markers only show in lamplight."],
  },

  // ---- C: dark chamber ----
  { id: "cp_depths_chamber", kind: "checkpoint", col: 94, row: 18, label: "Observation Chamber" },
  { id: "light_sensor", kind: "lightSensor", col: 67, row: 20, label: "light sensor" },
  { id: "secret_alcove", kind: "secret", col: 59, row: 14, label: "false wall" },
  { id: "treat_depths", kind: "pickup", col: 54, row: 14, item: "treat", label: "Golden Treat" },
  {
    id: "recorder_depths",
    kind: "buried",
    col: 72,
    row: 30,
    item: "recording",
    label: "Survey recorder",
    text: ["RECORDING // CREW 3", "'If the ice holds water, the next crew can drink, breathe and refuel here.'", "'Leaving the core drill on standby. Lights off to save power.'"],
  },

  // ---- Q: equipment room ----
  { id: "cp_depths_equipment", kind: "checkpoint", col: 52, row: 20, label: "Equipment Room" },
  {
    id: "log_equipment",
    kind: "log",
    col: 47,
    row: 20,
    label: "crew note",
    text: ["CREW NOTE (by the lamp)", "'Junction coupling cracked in the cold.", " Spare is in the frost by the door.", " Leaving this lamp on for whoever comes next.'"],
  },
  { id: "coupling_cache", kind: "buried", col: 44, row: 20, item: "coupling", label: "Power coupling" },
  { id: "salvage_locker", kind: "locker", col: 50, row: 20, label: "salvage locker" },

  // ---- J: junction ----
  { id: "cp_depths_junction", kind: "checkpoint", col: 57, row: 28, label: "Power Junction" },
  { id: "depths_battery", kind: "powerSource", col: 45, row: 28, label: "battery bank" },
  { id: "depths_junction", kind: "junction", col: 52, row: 28, label: "power junction" },

  // ---- I: ice chamber ----
  { id: "cp_depths_ice", kind: "checkpoint", col: 31, row: 28, label: "Ice Chamber" },
  {
    id: "sampler",
    kind: "sampler",
    col: 22,
    row: 28,
    label: "core drill",
    fact: "Water ice could give future explorers drinking water, oxygen to breathe and fuel for rockets.",
  },
  {
    id: "log_ice",
    kind: "log",
    col: 29,
    row: 28,
    label: "ice research terminal",
    text: [
      "ICE RESEARCH (optional reading)",
      "REAL: Mars has water ice under its surface and in its polar caps.",
      "REAL: In 2008 the Phoenix lander dug up bright ice that slowly vanished into the thin air.",
      "GAME: this cave, its core drill and the relay cell are fiction.",
    ],
  },
  {
    id: "sample_clay",
    kind: "buried",
    col: 16,
    row: 28,
    item: "sample",
    label: "Clay-rich mudstone",
    fact: "Clay minerals form in water. The Curiosity rover found clay in Gale Crater's mudstone.",
  },
  { id: "rover_antenna", kind: "pickup", col: 19, row: 21, item: "roverPart", label: "R-2's lost antenna" },

  // ---- L: lift hall ----
  { id: "cp_depths_lift", kind: "checkpoint", col: 9, row: 28, label: "Lift Hall", hidden: true },
  { id: "depths_lift", kind: "transit", col: 11, row: 28, label: "survey lift", link: "surveyLift" },
  {
    id: "sign_service",
    kind: "sign",
    col: 14, // three tiles from the survey lift, so the lift always wins the interaction target
    row: 28,
    label: "sign",
    text: ["SERVICE TUNNEL", "Hatch opens when the junction has power.", "East end: NORTH ACCESS (ridge relay route)."],
  },

  // ---- S: service tunnel ----
  {
    id: "log_service",
    kind: "log",
    col: 70,
    row: 38,
    label: "maintenance board",
    text: ["MAINTENANCE BOARD", "Ridge tower relay cell: moved here for cold storage.", "Return it to the RIDGE JUNCTION before the next signal window."],
  },
  { id: "cp_depths_north", kind: "checkpoint", col: 127, row: 38, label: "North Access", hidden: true },
  { id: "depths_north", kind: "transit", col: 130, row: 38, label: "north access gate", link: "northGate" },
];

export const FROZEN_DEPTHS: MapDef = {
  id: "depths",
  name: "Frozen Depths",
  w: DEPTHS_W,
  h: DEPTHS_H,
  terrain: TERRAIN,
  objects: OBJECTS,
  regions: [{ id: "depths", name: "Frozen Depths", x0: 0, x1: DEPTHS_W - 1, music: "game", ambience: "station", regionNo: 4 }],
  sections: [
    { id: "d_alcove", name: "Hidden Alcove", region: "depths", rect: { x0: 52, x1: 59, y0: 10, y1: 13 }, optional: true },
    { id: "d_entrance", name: "Survey Entrance", region: "depths", rect: { x0: 120, x1: 131, y0: 6, y1: 11 } },
    { id: "d_passage", name: "Survey Passage", region: "depths", rect: { x0: 96, x1: 119, y0: 8, y1: 17 } },
    { id: "d_equipment", name: "Frozen Equipment Room", region: "depths", rect: { x0: 34, x1: 64, y0: 14, y1: 19 } },
    { id: "d_chamber", name: "Dark Observation Chamber", region: "depths", rect: { x0: 60, x1: 95, y0: 10, y1: 29 } },
    { id: "d_junction", name: "Power Junction", region: "depths", rect: { x0: 34, x1: 60, y0: 20, y1: 27 } },
    { id: "d_ice", name: "Water-Ice Chamber", region: "depths", rect: { x0: 14, x1: 33, y0: 14, y1: 27 } },
    { id: "d_lift", name: "Lift Hall", region: "depths", rect: { x0: 2, x1: 13, y0: 20, y1: 27 } },
    { id: "d_service", name: "Service Tunnel", region: "depths", rect: { x0: 2, x1: 132, y0: 28, y1: 37 } },
  ],
  landmarks: [
    { id: "lm_lamp", name: "The Crew's Lamp", col: 47, row: 18, seenFrom: { x0: 34, x1: 64, y0: 14, y1: 27 } },
    { id: "lm_ice", name: "Water-Ice Deposit", col: 23, row: 20, seenFrom: { x0: 14, x1: 33, y0: 14, y1: 27 } },
    { id: "lm_lift", name: "Survey Lift", col: 11, row: 24, seenFrom: { x0: 2, x1: 14, y0: 20, y1: 27 } },
    { id: "lm_gate", name: "North Access Gate", col: 130, row: 36, seenFrom: { x0: 110, x1: 132, y0: 28, y1: 37 } },
  ],
  secrets: [{ id: "secret_alcove", rect: { x0: 52, x1: 59, y0: 10, y1: 13 } }],
  optionalZones: [
    { x0: 52, x1: 79, y0: 10, y1: 16 }, // upper ledges, nook and alcove
    { x0: 66, x1: 95, y0: 21, y1: 29 }, // chamber floor
    { x0: 15, x1: 22, y0: 18, y1: 21 }, // ice shelf
  ],
  theme: { backdrop: "depths", dark: true, ambience: "depths", particles: "frost", refY: 320 },
  decor: [
    // Entrance: abandoned survey kit and the facility console.
    { key: "lab_console", col: 122, row: 12, dx: -6 },
    { key: "storage_box", col: 119, row: 14, dx: 4 },
    { key: "stalactite", col: 116, row: 8 },
    { key: "stalactite", col: 101, row: 12, scale: 0.8 },
    { key: "stalactite", col: 89, row: 13 },
    { key: "stalactite", col: 71, row: 13, scale: 1.2 },
    // Puzzle A: reflective survey markings (only visible in lamplight).
    { key: "mark_arrow_dl", col: 85, row: 17, dy: -6, reflective: true },
    { key: "mark_arrow_l", col: 76, row: 19, dy: -4, reflective: true },
    { key: "mark_sensor", col: 69, row: 18, dy: -6, reflective: true },
    { key: "mark_x", col: 58, row: 12, dy: -4, reflective: true },
    { key: "mark_arrow_l", col: 99, row: 17, dy: -6, reflective: true },
    // Environmental storytelling.
    { key: "sample_case", col: 81, row: 30 },
    { key: "ice_pool", col: 76, row: 30, dy: 1 },
    { key: "crew_lamp", col: 46, row: 20, dx: -4 },
    { key: "frozen_generator", col: 38, row: 20 },
    { key: "shelf_frost", col: 54, row: 20 },
    { key: "ice_column", col: 17, row: 28 },
    { key: "ice_column", col: 30, row: 28, flip: true },
    { key: "icicles", col: 20, row: 18, dy: -16 },
    { key: "icicles", col: 27, row: 18, dy: -16, flip: true },
    { key: "ore_cart", col: 40, row: 38 },
    { key: "pipe_valve", col: 96, row: 38 },
    { key: "storage_box", col: 112, row: 38 },
    { key: "north_gate", col: 131, row: 38, dx: 6 },
  ],
  cables: [
    { group: "circuit", points: [[45.5, 27.6], [52, 27.6]] },
    { group: "circuit", points: [[52, 27.6], [52, 23.4], [34.4, 23.4], [34.4, 25]] },
    { group: "circuit", points: [[52, 23.4], [59.6, 23.4], [59.6, 22.6]] },
    { group: "circuit", points: [[33, 24.4], [14.6, 24.4], [12.2, 24.4], [12.2, 26.3]] },
    { group: "circuit", points: [[2.4, 34.3], [132, 34.3]] },
  ],
  lights: [
    { col: 121, row: 8, radius: 80, warm: true },
    { col: 129, row: 8, radius: 80, warm: true },
    { col: 108, row: 12, radius: 46, flicker: true },
    { col: 47, row: 18, radius: 62, warm: true },
    { col: 45, row: 26, radius: 30 },
    { col: 130, row: 36, radius: 40 },
    { col: 70, row: 16, radius: 90, group: "circuit" },
    { col: 81, row: 16, radius: 90, group: "circuit" },
    { col: 92, row: 16, radius: 90, group: "circuit" },
    { col: 38, row: 15, radius: 80, group: "circuit" },
    { col: 55, row: 15, radius: 80, group: "circuit" },
    { col: 40, row: 24, radius: 70, group: "circuit" },
    { col: 56, row: 24, radius: 70, group: "circuit" },
    { col: 19, row: 19, radius: 90, group: "circuit" },
    { col: 29, row: 19, radius: 90, group: "circuit" },
    { col: 8, row: 21, radius: 70, group: "circuit" },
    // Tunnel lamps are small: lights are not occluded, so a big radius would glow through the rock.
    ...Array.from({ length: 11 }, (_, i) => ({ col: 8 + i * 12, row: 36, radius: 36, group: "circuit" })),
  ],
  doors: {
    passage: { tiles: [[65, 17], [65, 18], [65, 19]], when: (s) => s.flags.passageOpen },
    iceDoor: { tiles: [[33, 25], [33, 26], [33, 27]], when: (s) => s.flags.circuitRestored },
    serviceHatch: { tiles: [[2, 28], [3, 28], [4, 28], [5, 28], [6, 28], [7, 28]], when: (s) => s.flags.circuitRestored },
  },
  bridges: {},
  frame: { x: 24.2, y: 41, w: 48.5, h: 15 },
  tipZones: [{ id: "tip:needLamp", rect: { x0: 96, x1: 119, y0: 8, y1: 17 } }],
};
