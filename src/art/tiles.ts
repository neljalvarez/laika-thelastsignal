/**
 * Programmatic 16x16 tileset with auto-tiling.
 *
 * Solid terrain types get 16 variants each, chosen by which sides are exposed to air
 * (bit 1 = top, 2 = right, 4 = bottom, 8 = left), plus "deep" variants for tiles far below
 * the surface and three interior alternatives to break up repetition.
 */
import { B, T } from "../data/world";
import { C } from "./palette";
import { makeCanvas, Painter, rng } from "./painter";

export const TS = 16;
export const TILESET_COLS = 16;
export const TILESET_ROWS = 10;

// Row layout of the tileset image.
const ROW = { regolith: 0, rock: 1, hull: 2, special: 3, back: 4, alts: 5, regolithDeep: 6, rockDeep: 7, cave: 8 };

export const SPECIAL = { crate: 0, door: 1, ledgeL: 2, ledgeM: 3, ledgeR: 4, scaffoldL: 5, scaffoldM: 6, scaffoldR: 7, bridge: 8, stationDoor: 9, floorHatch: 10 };

export function tileIndex(row: number, col: number): number {
  return row * TILESET_COLS + col;
}

/** Index for a solid terrain tile. */
export function terrainIndex(t: T, mask: number, depth: number, alt: number): number {
  if (t === T.Regolith) {
    if (mask === 0 && depth >= 2) return tileIndex(ROW.alts, 9 + (alt % 3));
    if (depth >= 3) return tileIndex(ROW.regolithDeep, mask);
    return mask === 0 ? tileIndex(ROW.alts, alt % 3) : tileIndex(ROW.regolith, mask);
  }
  if (t === T.Rock) {
    if (mask === 0 && depth >= 2) return tileIndex(ROW.alts, 12 + (alt % 3));
    if (depth >= 3) return tileIndex(ROW.rockDeep, mask);
    return mask === 0 ? tileIndex(ROW.alts, 3 + (alt % 3)) : tileIndex(ROW.rock, mask);
  }
  if (t === T.Cave) return tileIndex(ROW.cave, mask);
  return mask === 0 ? tileIndex(ROW.alts, 6 + (alt % 3)) : tileIndex(ROW.hull, mask);
}

export function backIndex(b: B, alt: number): number {
  if (b === B.Hull) return tileIndex(ROW.back, alt % 4);
  if (b === B.Cave) return tileIndex(ROW.back, 4 + (alt % 4));
  return tileIndex(ROW.back, 8 + (alt % 4));
}

export function specialIndex(name: keyof typeof SPECIAL): number {
  return tileIndex(ROW.special, SPECIAL[name]);
}

interface Earth {
  top: string;
  top2: string;
  base: string;
  light: string;
  dark: string;
  speck: string;
  edge: string;
  strata?: string;
}

const REGOLITH: Earth = { top: C.crustL, top2: C.crust, base: C.soil, light: C.soilL, dark: C.soilD, speck: C.pebble, edge: C.soilDD };
const REGOLITH_DEEP: Earth = { top: C.crust, top2: C.soilL, base: C.soilD, light: C.soil, dark: C.soilDD, speck: C.pebble, edge: "#4c1d16" };
const ROCK: Earth = { top: C.rockL, top2: C.strata, base: C.rock, light: C.strata, dark: C.rockD, speck: C.rockDD, edge: C.rockDD, strata: C.rockD };
const ROCK_DEEP: Earth = { top: C.strata, top2: C.rock, base: C.rockD, light: C.rock, dark: C.rockDD, speck: "#3e141b", edge: "#3e141b", strata: C.rockDD };
const CAVE: Earth = { top: C.caveL, top2: C.cave, base: C.cave, light: C.caveL, dark: C.caveD, speck: C.caveD, edge: C.caveD };

function earthTile(p: Painter, ox: number, oy: number, e: Earth, mask: number, seed: number): void {
  const r = rng(seed);
  p.rect(ox, oy, TS, TS, e.base);
  // Grain: light and dark speckles.
  for (let i = 0; i < 22; i++) {
    const x = Math.floor(r() * TS);
    const y = Math.floor(r() * TS);
    p.px(ox + x, oy + y, r() < 0.5 ? e.light : e.dark);
  }
  if (e.strata) {
    // Sedimentary layers: horizontal bands broken into dashes.
    for (const y of [5, 11]) {
      for (let x = 0; x < TS; x++) if (r() < 0.75) p.px(ox + x, oy + y, e.strata);
    }
  }
  // Pebbles.
  for (let i = 0; i < 2; i++) {
    const x = 2 + Math.floor(r() * 11);
    const y = 4 + Math.floor(r() * 10);
    p.rect(ox + x, oy + y, 2, 1, e.speck).px(ox + x, oy + y - 1, e.light);
  }
  const top = (mask & 1) !== 0;
  const right = (mask & 2) !== 0;
  const bottom = (mask & 4) !== 0;
  const left = (mask & 8) !== 0;
  if (top) {
    p.rect(ox, oy, TS, 1, e.top);
    p.rect(ox, oy + 1, TS, 2, e.top2);
    for (let x = 0; x < TS; x++) {
      const d = r();
      if (d < 0.55) p.px(ox + x, oy + 3, e.top2);
      if (d < 0.2) p.px(ox + x, oy + 4, e.top2);
      if (d > 0.85) p.px(ox + x, oy + 1, e.top);
    }
  }
  if (left) {
    p.rect(ox, oy, 1, TS, e.edge);
    p.rect(ox + 1, oy + (top ? 1 : 0), 1, TS - (top ? 1 : 0), e.light);
    if (top) p.px(ox, oy, e.top2);
  }
  if (right) {
    p.rect(ox + TS - 1, oy, 1, TS, e.edge);
    p.rect(ox + TS - 2, oy + (top ? 3 : 0), 1, TS - (top ? 3 : 0), e.dark);
  }
  if (bottom) {
    p.rect(ox, oy + TS - 1, TS, 1, e.edge);
    p.rect(ox, oy + TS - 2, TS, 1, e.dark);
  }
}

function hullTile(p: Painter, ox: number, oy: number, mask: number, seed: number): void {
  const r = rng(seed);
  p.rect(ox, oy, TS, TS, C.hull);
  p.rect(ox, oy + 8, TS, 1, C.hullD);
  p.rect(ox + 7 + (seed % 2) * 2, oy, 1, 8, C.hullD);
  p.rect(ox + 3, oy + 9, 1, 7, C.hullD);
  for (const [x, y] of [
    [2, 2],
    [13, 2],
    [2, 12],
    [13, 12],
  ]) {
    if (r() < 0.7) p.px(ox + x, oy + y, C.steel);
  }
  if (r() < 0.25) p.rect(ox + 9, oy + 11, 4, 2, C.hullL);
  if (mask & 1) p.rect(ox, oy, TS, 1, C.hullL).rect(ox, oy + 1, TS, 1, C.white);
  if (mask & 8) p.rect(ox, oy, 1, TS, C.steelD);
  if (mask & 2) p.rect(ox + TS - 1, oy, 1, TS, C.steelD).rect(ox + TS - 2, oy, 1, TS, C.hullD);
  if (mask & 4) p.rect(ox, oy + TS - 1, TS, 1, C.steelD).rect(ox, oy + TS - 2, TS, 1, C.hullD);
}

function crate(p: Painter, ox: number, oy: number): void {
  p.rect(ox, oy, TS, TS, C.steelDD);
  p.rect(ox + 1, oy + 1, 14, 14, C.steel);
  p.rect(ox + 1, oy + 1, 14, 1, C.steelL);
  p.rect(ox + 2, oy + 2, 12, 12, C.steelD);
  for (let i = 0; i < 12; i++) {
    p.px(ox + 2 + i, oy + 2 + i, C.steelL);
    p.px(ox + 13 - i, oy + 2 + i, C.steel);
  }
  p.rect(ox + 5, oy + 6, 6, 4, C.yellow).rect(ox + 6, oy + 7, 4, 2, C.yellowD);
  p.rect(ox + 1, oy + 14, 14, 1, C.steelDD);
}

function door(p: Painter, ox: number, oy: number, station: boolean): void {
  p.rect(ox, oy, TS, TS, C.steelDD);
  p.rect(ox + 2, oy, 12, TS, station ? C.steelD : C.steel);
  for (let y = 0; y < TS; y += 4) {
    p.rect(ox + 2, oy + y, 3, 2, C.yellow).rect(ox + 11, oy + y + 2, 3, 2, C.yellow);
  }
  p.rect(ox + 6, oy, 4, TS, station ? C.steel : C.steelL);
  p.rect(ox + 7, oy + 6, 2, 3, station ? C.red : C.orange);
}

function floorHatch(p: Painter, ox: number, oy: number): void {
  p.rect(ox, oy, TS, TS, C.steelDD);
  p.rect(ox, oy + 1, TS, TS - 2, C.steelD);
  for (let x = 0; x < TS; x += 4) p.rect(ox + x, oy + 1, 2, 2, C.yellow).rect(ox + x + 2, oy + 1, 2, 2, C.out);
  p.rect(ox, oy + 7, TS, 1, C.steel).rect(ox + 6, oy + 9, 4, 3, C.steel);
}

function ledge(p: Painter, ox: number, oy: number, end: "L" | "M" | "R", seed: number): void {
  const r = rng(seed);
  const x0 = end === "L" ? 2 : 0;
  const x1 = end === "R" ? 13 : 15;
  p.rect(ox + x0, oy, x1 - x0 + 1, 6, C.rock);
  p.rect(ox + x0, oy, x1 - x0 + 1, 1, C.rockL);
  p.rect(ox + x0, oy + 1, x1 - x0 + 1, 1, C.strata);
  for (let x = x0; x <= x1; x++) {
    const h = 6 + Math.floor(r() * 3);
    p.rect(ox + x, oy + 5, 1, h - 5, C.rockD);
    p.px(ox + x, oy + h, C.rockDD);
  }
  if (end === "L") p.rect(ox + 1, oy + 1, 1, 5, C.rockDD);
  if (end === "R") p.rect(ox + 14, oy + 1, 1, 5, C.rockDD);
}

function scaffold(p: Painter, ox: number, oy: number, end: "L" | "M" | "R"): void {
  p.rect(ox, oy, TS, 3, C.steel).rect(ox, oy, TS, 1, C.steelL).rect(ox, oy + 3, TS, 1, C.steelDD);
  for (let x = 0; x < TS; x += 4) p.px(ox + x + 1, oy + 1, C.steelD);
  // Truss underneath.
  for (let i = 0; i < 6; i++) {
    p.px(ox + 2 + i, oy + 4 + i, C.steelD);
    p.px(ox + 13 - i, oy + 4 + i, C.steelD);
  }
  if (end !== "M") p.rect(ox + (end === "L" ? 0 : 14), oy, 2, 12, C.steelD);
}

function bridge(p: Painter, ox: number, oy: number): void {
  p.rect(ox, oy, TS, 4, C.steel).rect(ox, oy, TS, 1, C.steelL);
  for (let x = 0; x < TS; x += 4) p.rect(ox + x, oy + 4, 2, 1, C.yellow).rect(ox + x + 2, oy + 4, 2, 1, C.out);
  p.rect(ox, oy + 5, TS, 1, C.steelDD);
  for (let i = 0; i < 8; i++) {
    p.px(ox + i * 2, oy + 6 + (i % 4), C.steelD);
  }
  p.rect(ox, oy + 6, 1, 6, C.steelD).rect(ox + 8, oy + 6, 1, 6, C.steelD);
  p.rect(ox, oy + 11, TS, 1, C.steelD);
}

function backTile(p: Painter, ox: number, oy: number, kind: "hull" | "cave" | "station", v: number): void {
  const r = rng(900 + v * 17 + (kind === "cave" ? 1000 : kind === "station" ? 2000 : 0));
  if (kind === "hull") {
    p.rect(ox, oy, TS, TS, "#3a4258");
    p.rect(ox, oy, TS, 1, "#2a3043").rect(ox, oy, 1, TS, "#2a3043");
    p.rect(ox + 1, oy + 1, TS - 1, 1, "#46506a");
    if (v === 1) p.rect(ox + 4, oy + 5, 8, 6, "#2a3043").rect(ox + 5, oy + 6, 6, 1, "#46506a").rect(ox + 5, oy + 8, 6, 1, "#46506a");
    if (v === 2) p.rect(ox + 2, oy + 10, 12, 2, "#323a50").px(ox + 12, oy + 4, C.steel);
    if (v === 3) p.rect(ox + 6, oy, 2, TS, "#323a50");
  } else if (kind === "cave") {
    p.rect(ox, oy, TS, TS, C.cave);
    for (let i = 0; i < 18; i++) p.px(ox + Math.floor(r() * TS), oy + Math.floor(r() * TS), r() < 0.5 ? C.caveL : C.caveD);
    if (v === 2) p.rect(ox + 3, oy + 7, 5, 1, C.caveD).rect(ox + 8, oy + 8, 4, 1, C.caveD);
  } else {
    p.rect(ox, oy, TS, TS, "#2f3747");
    p.rect(ox, oy, TS, 1, "#232a37").rect(ox, oy, 1, TS, "#232a37");
    p.rect(ox + 1, oy + 1, TS - 1, 1, "#3a4456");
    if (v === 1) p.rect(ox + 1, oy + 7, TS - 1, 2, "#7a4a2c");
    if (v === 2) p.rect(ox + 4, oy + 4, 8, 8, "#262d3b").rect(ox + 5, oy + 5, 6, 1, "#3a4456");
    if (v === 3) p.px(ox + 12, oy + 12, C.steel).px(ox + 3, oy + 3, C.steel);
  }
}

export function drawTileset(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(TILESET_COLS * TS, TILESET_ROWS * TS);
  const p = new Painter(ctx);
  for (let m = 0; m < 16; m++) {
    earthTile(p, m * TS, ROW.regolith * TS, REGOLITH, m, 100 + m);
    earthTile(p, m * TS, ROW.rock * TS, ROCK, m, 200 + m);
    hullTile(p, m * TS, ROW.hull * TS, m, 300 + m);
    earthTile(p, m * TS, ROW.regolithDeep * TS, REGOLITH_DEEP, m, 400 + m);
    earthTile(p, m * TS, ROW.rockDeep * TS, ROCK_DEEP, m, 500 + m);
    earthTile(p, m * TS, ROW.cave * TS, CAVE, m, 600 + m);
  }
  // Interior alternates (mask 0): regolith 0-2, rock 3-5, hull 6-8, deep regolith 9-11, deep rock 12-14.
  for (let a = 0; a < 3; a++) {
    earthTile(p, a * TS, ROW.alts * TS, REGOLITH, 0, 700 + a);
    earthTile(p, (3 + a) * TS, ROW.alts * TS, ROCK, 0, 710 + a);
    hullTile(p, (6 + a) * TS, ROW.alts * TS, 0, 720 + a);
    earthTile(p, (9 + a) * TS, ROW.alts * TS, REGOLITH_DEEP, 0, 730 + a);
    earthTile(p, (12 + a) * TS, ROW.alts * TS, ROCK_DEEP, 0, 740 + a);
  }
  const sy = ROW.special * TS;
  crate(p, SPECIAL.crate * TS, sy);
  door(p, SPECIAL.door * TS, sy, false);
  ledge(p, SPECIAL.ledgeL * TS, sy, "L", 801);
  ledge(p, SPECIAL.ledgeM * TS, sy, "M", 802);
  ledge(p, SPECIAL.ledgeR * TS, sy, "R", 803);
  scaffold(p, SPECIAL.scaffoldL * TS, sy, "L");
  scaffold(p, SPECIAL.scaffoldM * TS, sy, "M");
  scaffold(p, SPECIAL.scaffoldR * TS, sy, "R");
  bridge(p, SPECIAL.bridge * TS, sy);
  door(p, SPECIAL.stationDoor * TS, sy, true);
  floorHatch(p, SPECIAL.floorHatch * TS, sy);
  for (let v = 0; v < 4; v++) {
    backTile(p, v * TS, ROW.back * TS, "hull", v);
    backTile(p, (4 + v) * TS, ROW.back * TS, "cave", v);
    backTile(p, (8 + v) * TS, ROW.back * TS, "station", v);
  }
  return canvas;
}
