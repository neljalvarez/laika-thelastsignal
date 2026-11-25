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
export const TILESET_ROWS = 14;

// Row layout of the tileset image.
const ROW = { regolith: 0, rock: 1, hull: 2, special: 3, back: 4, alts: 5, regolithDeep: 6, rockDeep: 7, cave: 8, frost: 9, ice: 10, ridge: 11, alts2: 12, special2: 13 };

export const SPECIAL = { crate: 0, door: 1, ledgeL: 2, ledgeM: 3, ledgeR: 4, scaffoldL: 5, scaffoldM: 6, scaffoldR: 7, bridge: 8, stationDoor: 9, floorHatch: 10 };
/** Phase 3 specials (second special row): ice shelves, the powered shutter, and new back walls. */
export const SPECIAL2 = { iceLedgeL: 0, iceLedgeM: 1, iceLedgeR: 2, shutter: 3 };

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
  if (t === T.FrostRock) {
    if (mask === 0) return tileIndex(ROW.alts2, (depth >= 2 ? 9 : 0) + (alt % 3));
    return tileIndex(ROW.frost, mask);
  }
  if (t === T.Ice) return mask === 0 ? tileIndex(ROW.alts2, 3 + (alt % 3)) : tileIndex(ROW.ice, mask);
  if (t === T.RidgeRock) {
    if (mask === 0) return tileIndex(ROW.alts2, (depth >= 2 ? 12 : 6) + (alt % 3));
    return tileIndex(ROW.ridge, mask);
  }
  return mask === 0 ? tileIndex(ROW.alts, 6 + (alt % 3)) : tileIndex(ROW.hull, mask);
}

export function backIndex(b: B, alt: number): number {
  if (b === B.Frost) return tileIndex(ROW.special2, 4 + (alt % 4));
  if (b === B.Lab) return tileIndex(ROW.special2, 8 + (alt % 4));
  if (b === B.Ridge) return tileIndex(ROW.special2, 12 + (alt % 4));
  if (b === B.Hull) return tileIndex(ROW.back, alt % 4);
  if (b === B.Cave) return tileIndex(ROW.back, 4 + (alt % 4));
  return tileIndex(ROW.back, 8 + (alt % 4));
}

export function specialIndex(name: keyof typeof SPECIAL): number {
  return tileIndex(ROW.special, SPECIAL[name]);
}

export function special2Index(name: keyof typeof SPECIAL2): number {
  return tileIndex(ROW.special2, SPECIAL2[name]);
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
  /** Phase 3: strata drawn on a diagonal (ridge rock), and an irregular, weathered top edge. */
  tilt?: boolean;
}

const REGOLITH: Earth = { top: C.crustL, top2: C.crust, base: C.soil, light: C.soilL, dark: C.soilD, speck: C.pebble, edge: C.soilDD };
const REGOLITH_DEEP: Earth = { top: C.crust, top2: C.soilL, base: C.soilD, light: C.soil, dark: C.soilDD, speck: C.pebble, edge: "#4c1d16" };
const ROCK: Earth = { top: C.rockL, top2: C.strata, base: C.rock, light: C.strata, dark: C.rockD, speck: C.rockDD, edge: C.rockDD, strata: C.rockD };
const ROCK_DEEP: Earth = { top: C.strata, top2: C.rock, base: C.rockD, light: C.rock, dark: C.rockDD, speck: "#3e141b", edge: "#3e141b", strata: C.rockDD };
const CAVE: Earth = { top: C.caveL, top2: C.cave, base: C.cave, light: C.caveL, dark: C.caveD, speck: C.caveD, edge: C.caveD };
// Phase 3 materials. Frost rock: desaturated blue-violet with rusty red flecks (exposed Mars rock).
const FROST: Earth = { top: "#8fa3c8", top2: "#5d6a92", base: "#3b3f63", light: "#4c5279", dark: "#2c2e4c", speck: "#7a3a3a", edge: "#1f2038" };
const FROST_DEEP: Earth = { top: "#5d6a92", top2: "#4c5279", base: "#2f3254", light: "#3b3f63", dark: "#23243f", speck: "#5e2c30", edge: "#191a30" };
// Ridge rock: warmer and paler than the canyon, with tilted strata instead of flat bands.
const RIDGE: Earth = { top: "#e2a07a", top2: "#c97a5a", base: "#a85846", light: "#bd6b53", dark: "#86433a", speck: "#6a332d", edge: "#5a2a27", strata: "#93493d", tilt: true };
const RIDGE_DEEP: Earth = { top: "#bd6b53", top2: "#a85846", base: "#8a453a", light: "#9b4f42", dark: "#6e3630", speck: "#552824", edge: "#4a2320", strata: "#7a3c33", tilt: true };

function earthTile(p: Painter, ox: number, oy: number, e: Earth, mask: number, seed: number): void {
  const r = rng(seed);
  p.rect(ox, oy, TS, TS, e.base);
  // Grain: light and dark speckles.
  for (let i = 0; i < 22; i++) {
    const x = Math.floor(r() * TS);
    const y = Math.floor(r() * TS);
    p.px(ox + x, oy + y, r() < 0.5 ? e.light : e.dark);
  }
  if (e.strata && e.tilt) {
    // Tilted layers that continue across neighbouring tiles (period 8 px on the diagonal).
    for (let x = 0; x < TS; x++)
      for (let y = 0; y < TS; y++) if ((x + 2 * y) % 16 === 0 && r() < 0.8) p.px(ox + x, oy + y, e.strata);
    // Weathering cracks.
    if (r() < 0.5) {
      let cx = 3 + Math.floor(r() * 10);
      for (let y = 4 + Math.floor(r() * 4); y < TS - 2; y++) {
        p.px(ox + cx, oy + y, e.edge);
        if (r() < 0.4) cx += r() < 0.5 ? -1 : 1;
        if (cx < 1 || cx > 14) break;
      }
    }
  } else if (e.strata) {
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
  if (top && e.tilt) {
    // Weathered cap: a ragged crest with chipped notches (no straight brick lines).
    for (let x = 0; x < TS; x++) {
      const h = r() < 0.18 ? 1 : 0;
      p.rect(ox + x, oy, 1, h, "rgba(0,0,0,0)");
      p.px(ox + x, oy + h, e.top);
      p.rect(ox + x, oy + h + 1, 1, 2, e.top2);
      if (r() < 0.45) p.px(ox + x, oy + h + 3, e.top2);
    }
  } else if (top) {
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

/** Water ice: pale cyan, with long glints, a few cracks and frosted edges. Not glowing: just bright. */
function iceTile(p: Painter, ox: number, oy: number, mask: number, seed: number): void {
  const r = rng(seed);
  p.rect(ox, oy, TS, TS, "#8fc9dc");
  p.dither(ox, oy + 8, TS, 8, "#8fc9dc", "#79b3cb", 0.35);
  for (let i = 0; i < 3; i++) {
    const x0 = Math.floor(r() * 12);
    const y0 = Math.floor(r() * 14);
    for (let k = 0; k < 5; k++) p.px(ox + x0 + k, oy + y0 + Math.floor(k / 2), "#d9f1f7");
  }
  if (r() < 0.6) {
    let cx = 2 + Math.floor(r() * 12);
    for (let y = 2; y < 14; y++) {
      p.px(ox + cx, oy + y, "#5b93ad");
      if (r() < 0.35) cx += r() < 0.5 ? -1 : 1;
      cx = Math.max(1, Math.min(14, cx));
    }
  }
  for (let i = 0; i < 6; i++) p.px(ox + Math.floor(r() * TS), oy + Math.floor(r() * TS), "#b8e3ee");
  if (mask & 1) p.rect(ox, oy, TS, 1, "#f2fbfd").rect(ox, oy + 1, TS, 1, "#c6eaf3");
  if (mask & 8) p.rect(ox, oy, 1, TS, "#5b93ad");
  if (mask & 2) p.rect(ox + TS - 1, oy, 1, TS, "#4b7f98");
  if (mask & 4) {
    p.rect(ox, oy + TS - 1, TS, 1, "#4b7f98");
    // Small icicles under exposed ice.
    for (let x = 1; x < TS; x += 4 + Math.floor(r() * 3)) p.rect(ox + x, oy + TS - 2, 1, 2, "#d9f1f7");
  }
}

function iceLedge(p: Painter, ox: number, oy: number, end: "L" | "M" | "R", seed: number): void {
  const r = rng(seed);
  const x0 = end === "L" ? 2 : 0;
  const x1 = end === "R" ? 13 : 15;
  p.rect(ox + x0, oy, x1 - x0 + 1, 4, "#9fd3e3");
  p.rect(ox + x0, oy, x1 - x0 + 1, 1, "#f2fbfd");
  p.rect(ox + x0, oy + 4, x1 - x0 + 1, 1, "#5b93ad");
  for (let x = x0; x <= x1; x++) {
    if (r() < 0.3) p.rect(ox + x, oy + 5, 1, 1 + Math.floor(r() * 3), "#c6eaf3");
  }
}

/** Powered shutter: chevron stripes and a status light (it opens, never needs force). */
function shutter(p: Painter, ox: number, oy: number): void {
  p.rect(ox, oy, TS, TS, "#2c3347");
  p.rect(ox + 2, oy, 12, TS, "#4a5573");
  for (let y = 0; y < TS; y += 3) p.rect(ox + 2, oy + y, 12, 1, "#3a4460");
  p.rect(ox + 2, oy + 6, 12, 3, "#f2ca76").rect(ox + 4, oy + 7, 2, 1, "#2a1a22").rect(ox + 9, oy + 7, 2, 1, "#2a1a22");
  p.rect(ox + 7, oy + 12, 2, 2, "#5fb7f0");
}

function region2Back(p: Painter, ox: number, oy: number, kind: "frost" | "lab" | "ridge", v: number): void {
  const r = rng(3000 + v * 17 + (kind === "lab" ? 100 : kind === "ridge" ? 200 : 0));
  if (kind === "frost") {
    p.rect(ox, oy, TS, TS, "#23264a");
    for (let i = 0; i < 16; i++) p.px(ox + Math.floor(r() * TS), oy + Math.floor(r() * TS), r() < 0.5 ? "#2d3159" : "#1b1d3a");
    if (v === 1) p.rect(ox + 2, oy + 9, 6, 1, "#1b1d3a").rect(ox + 8, oy + 10, 5, 1, "#1b1d3a");
    if (v === 2) p.px(ox + 11, oy + 4, "#5e2c30").px(ox + 12, oy + 4, "#5e2c30").px(ox + 4, oy + 12, "#3d6a80");
  } else if (kind === "lab") {
    p.rect(ox, oy, TS, TS, "#2b3146");
    p.rect(ox, oy, TS, 1, "#202536").rect(ox, oy, 1, TS, "#202536");
    p.rect(ox + 1, oy + 1, TS - 1, 1, "#363d55");
    if (v === 1) p.rect(ox + 3, oy + 5, 10, 5, "#232838").rect(ox + 4, oy + 6, 3, 1, "#3d6a80");
    if (v === 2) p.rect(ox + 1, oy + 8, TS - 1, 2, "#33405a");
    if (v === 3) p.rect(ox + 7, oy, 2, TS, "#262b3d").px(ox + 12, oy + 12, "#5fb7f0");
  } else {
    p.rect(ox, oy, TS, TS, "#6a3330");
    for (let x = 0; x < TS; x++) for (let y = 0; y < TS; y++) if ((x + 2 * y + v * 4) % 16 === 0) p.px(ox + x, oy + y, "#5a2a27");
    for (let i = 0; i < 10; i++) p.px(ox + Math.floor(r() * TS), oy + Math.floor(r() * TS), r() < 0.5 ? "#763a35" : "#5a2a27");
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
  // ---- Phase 3 rows ----
  for (let m = 0; m < 16; m++) {
    earthTile(p, m * TS, ROW.frost * TS, FROST, m, 1100 + m);
    iceTile(p, m * TS, ROW.ice * TS, m, 1200 + m);
    earthTile(p, m * TS, ROW.ridge * TS, RIDGE, m, 1300 + m);
  }
  // Interior alternates: frost 0-2, ice 3-5, ridge 6-8, deep frost 9-11, deep ridge 12-14.
  for (let a = 0; a < 3; a++) {
    earthTile(p, a * TS, ROW.alts2 * TS, FROST, 0, 1400 + a);
    iceTile(p, (3 + a) * TS, ROW.alts2 * TS, 0, 1410 + a);
    earthTile(p, (6 + a) * TS, ROW.alts2 * TS, RIDGE, 0, 1420 + a);
    earthTile(p, (9 + a) * TS, ROW.alts2 * TS, FROST_DEEP, 0, 1430 + a);
    earthTile(p, (12 + a) * TS, ROW.alts2 * TS, RIDGE_DEEP, 0, 1440 + a);
  }
  const s2 = ROW.special2 * TS;
  iceLedge(p, SPECIAL2.iceLedgeL * TS, s2, "L", 1501);
  iceLedge(p, SPECIAL2.iceLedgeM * TS, s2, "M", 1502);
  iceLedge(p, SPECIAL2.iceLedgeR * TS, s2, "R", 1503);
  shutter(p, SPECIAL2.shutter * TS, s2);
  for (let v = 0; v < 4; v++) {
    region2Back(p, (4 + v) * TS, s2, "frost", v);
    region2Back(p, (8 + v) * TS, s2, "lab", v);
    region2Back(p, (12 + v) * TS, s2, "ridge", v);
  }
  return canvas;
}
