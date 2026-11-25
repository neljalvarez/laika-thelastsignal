/**
 * Phase 3 art: props for Frozen Depths and Echo Ridge, lighting stamps, and the two regions'
 * parallax backdrops. Same rules as props.ts: integer pixels, the shared palette, an outline.
 * Glows in the depths come from equipment and lamps, never from the ice itself.
 */
import { VIEW_H, VIEW_W } from "../config/constants";
import { drawText, textWidth } from "./font";
import { C } from "./palette";
import { makeCanvas, Painter, rng } from "./painter";
import type { PropDef } from "./props";

const box = (p: Painter, x: number, y: number, w: number, h: number, fill: string, edge: string = C.out) => p.rect(x, y, w, h, edge).rect(x + 1, y + 1, w - 2, h - 2, fill);
const ICE = { l: "#d9f1f7", m: "#9fd3e3", d: "#5b93ad", dd: "#3d6a80" };
const FROST = { l: "#8fa3c8", m: "#4c5279", d: "#2c2e4c" };
const RIDGE = { l: "#e2a07a", m: "#a85846", d: "#6e3630", dd: "#4a2320" };

// ---------------------------------------------------------------------------
// Lifts, gates, cable car
// ---------------------------------------------------------------------------

/** A survey-lift cage: frame, car and a status lamp (on = powered). */
function liftCage(on: boolean, top: boolean): (p: Painter) => void {
  return (p) => {
    // Frame posts.
    p.rect(0, 0, 3, 44, C.out).rect(1, 0, 1, 44, C.steel).rect(25, 0, 3, 44, C.out).rect(26, 0, 1, 44, C.steel);
    p.rect(0, 0, 28, 3, C.out).rect(1, 1, 26, 1, C.steelL);
    for (let y = 6; y < 40; y += 8) p.rect(3, y, 22, 1, C.steelDD);
    // Car.
    box(p, 4, 22, 20, 20, on ? C.steel : C.steelD);
    p.rect(6, 25, 16, 7, on ? C.navy : C.steelDD);
    if (on) p.rect(7, 27, 6, 1, C.mint).rect(7, 29, 10, 1, C.glass);
    p.rect(5, 40, 18, 2, C.yellow).rect(9, 40, 2, 2, C.out).rect(15, 40, 2, 2, C.out);
    // Status lamp.
    p.rect(12, 4, 4, 4, C.out).rect(13, 5, 2, 2, on ? C.mint : C.red);
    if (top) p.rect(4, 8, 20, 2, C.steelD).px(13, 12, C.steelL).px(14, 15, C.steelL);
  };
}

function freightLift(on: boolean): (p: Painter) => void {
  return (p) => {
    box(p, 0, 0, 30, 44, C.steelD);
    p.rect(2, 2, 26, 3, on ? C.yellow : C.steel);
    for (let x = 4; x < 28; x += 6) p.rect(x, 2, 3, 3, C.out);
    box(p, 3, 8, 24, 34, on ? "#3a4460" : C.steelDD);
    for (let y = 10; y < 40; y += 4) p.rect(4, y, 22, 1, on ? "#4a5573" : "#232838");
    p.rect(13, 22, 4, 6, C.out).rect(14, 23, 2, 2, on ? C.mint : C.red);
  };
}

function gatePanel(open: boolean): (p: Painter) => void {
  return (p) => {
    box(p, 0, 0, 14, 22, C.steelD);
    p.rect(2, 2, 10, 8, open ? C.navy : C.steelDD);
    p.rect(3, 4, 8, 4, open ? C.mint : C.red);
    drawText(p, open ? "GO" : "--", 3, 13, open ? C.mint : C.red);
  };
}

function northGate(p: Painter): void {
  // A heavy blast door set into the tunnel's end, chevrons and a light strip.
  box(p, 0, 0, 30, 64, C.steelDD);
  p.rect(3, 3, 24, 58, C.steelD);
  for (let y = 6; y < 58; y += 10) {
    for (let i = 0; i < 6; i++) p.px(6 + i, y + i, C.yellow).px(23 - i, y + i, C.yellow);
  }
  p.rect(14, 3, 2, 58, C.out);
  drawText(p, "N", 13 - 0, 26, C.white);
}

function ridgeHatch(open: boolean): (p: Painter) => void {
  return (p) => {
    // A hatch in a concrete collar, its lid tilted open.
    box(p, 0, 12, 30, 12, "#8a8f9c");
    p.rect(3, 14, 24, 8, C.out);
    if (open) p.rect(0, 2, 6, 12, C.steel).rect(1, 3, 4, 10, C.steelL);
    else p.rect(3, 9, 24, 4, C.steel);
    p.rect(12, 16, 6, 2, open ? C.mint : C.red);
  };
}

function cableCar(on: boolean, dock: boolean): (p: Painter) => void {
  return (p) => {
    // Cable running up out of frame, pulley, and the gondola.
    p.rect(14, 0, 1, 16, C.out);
    p.disc(14, 16, 4, C.out).disc(14, 16, 2, C.steelL);
    p.rect(13, 20, 3, 6, C.steelD);
    box(p, 2, 26, 26, 18, on ? C.red : C.steelD);
    p.rect(5, 29, 9, 7, on ? C.glass : C.steelDD).rect(16, 29, 9, 7, on ? C.glass : C.steelDD);
    p.rect(3, 40, 24, 2, on ? C.redDark : C.out);
    if (dock) p.rect(0, 44, 30, 2, C.steel);
    p.rect(13, 22, 3, 3, on ? C.mint : C.red);
  };
}

// ---------------------------------------------------------------------------
// Frozen Depths machines
// ---------------------------------------------------------------------------

function lampKit(full: boolean): (p: Painter) => void {
  return (p) => {
    box(p, 0, 8, 20, 12, C.steelD);
    p.rect(2, 10, 16, 1, C.steel);
    drawText(p, "LAMP", 2, 13, C.yellow);
    if (full) {
      box(p, 5, 0, 10, 8, C.steel);
      p.rect(7, 2, 6, 4, C.yellow).px(8, 2, C.white);
    }
  };
}

function lightSensor(on: boolean): (p: Painter) => void {
  return (p) => {
    p.rect(5, 10, 3, 18, C.out).rect(6, 10, 1, 18, C.steelL);
    box(p, 0, 0, 13, 12, C.steelD);
    p.disc(6, 5, 3, C.out).disc(6, 5, 2, on ? C.yellow : "#3d4a66");
    if (on) p.px(5, 4, C.white);
    p.rect(1, 26, 11, 2, C.out);
  };
}

function batteryBank(p: Painter): void {
  box(p, 0, 4, 34, 22, C.steelD);
  for (let i = 0; i < 4; i++) {
    box(p, 3 + i * 7, 7, 6, 14, C.steel);
    p.rect(4 + i * 7, 15, 4, 5, C.mint);
  }
  p.rect(14, 0, 6, 4, C.out).rect(15, 1, 4, 3, C.yellow);
  p.rect(0, 24, 34, 2, C.out);
}

function junction(fixed: boolean): (p: Painter) => void {
  return (p) => {
    box(p, 0, 0, 24, 26, C.steelD);
    box(p, 3, 3, 18, 12, C.steelDD);
    // Connector socket.
    p.rect(8, 6, 8, 6, C.out).rect(9, 7, 6, 4, fixed ? C.yellow : "#3a2a2a");
    if (!fixed) p.px(10, 7, C.red).px(13, 10, C.red).px(11, 9, C.orange);
    p.rect(4, 18, 4, 4, C.out).rect(5, 19, 2, 2, fixed ? C.mint : C.red);
    p.rect(10, 18, 10, 2, C.steel).rect(10, 21, 10, 1, C.steel);
    p.rect(0, 24, 24, 2, C.out);
  };
}

function coreDrill(on: boolean): (p: Painter) => void {
  return (p) => {
    // A tripod drill rig with an ice core in a clear tube.
    p.rect(2, 10, 2, 30, C.out).rect(24, 10, 2, 30, C.out).rect(13, 6, 2, 34, C.out);
    p.rect(0, 6, 28, 4, C.out).rect(1, 7, 26, 2, on ? C.yellow : C.steel);
    box(p, 8, 14, 12, 18, C.steelD);
    p.rect(10, 16, 8, 14, on ? ICE.l : "#3d4a66");
    if (on) p.rect(11, 18, 6, 1, ICE.m).rect(11, 23, 6, 1, ICE.d).rect(11, 27, 6, 1, ICE.m);
    p.rect(12, 32, 4, 8, C.steel).rect(13, 38, 2, 2, C.white);
    p.rect(20, 18, 4, 4, C.out).rect(21, 19, 2, 2, on ? C.mint : C.red);
  };
}

function salvageLocker(open: boolean): (p: Painter) => void {
  return (p) => {
    box(p, 0, 0, 16, 26, "#55647e");
    p.rect(2, 2, 12, 22, open ? "#2a3146" : "#6d7c97");
    if (open) p.rect(3, 15, 10, 2, C.steelL).rect(3, 8, 10, 2, C.steelL);
    else p.rect(11, 11, 2, 4, C.out).rect(3, 4, 8, 1, ICE.l).rect(4, 20, 6, 1, ICE.l);
    p.rect(-1 + 1, 24, 16, 2, C.out);
  };
}

function labConsole(p: Painter): void {
  box(p, 0, 6, 26, 18, C.steelD);
  box(p, 3, 0, 20, 10, C.steelDD);
  p.rect(5, 2, 7, 1, C.mint).rect(5, 4, 12, 1, C.glass).rect(5, 6, 9, 1, C.mint);
  p.rect(4, 13, 3, 3, C.red).rect(9, 13, 3, 3, C.yellow).rect(14, 13, 3, 3, C.mint);
}

function crewLamp(p: Painter): void {
  // A camping lantern left running on a crate: the one warm light in the room.
  box(p, 0, 8, 14, 8, C.steelD);
  p.rect(4, 0, 6, 2, C.out).rect(3, 2, 8, 6, C.out).rect(4, 3, 6, 4, C.yellow).px(5, 3, C.white);
}

function frozenGenerator(p: Painter): void {
  box(p, 0, 4, 32, 20, C.steelD);
  for (let x = 3; x < 29; x += 4) p.rect(x, 7, 2, 10, C.steelDD);
  p.rect(0, 0, 32, 5, ICE.l).rect(2, 5, 2, 4, ICE.m).rect(12, 5, 1, 6, ICE.m).rect(25, 5, 2, 3, ICE.m);
  p.rect(24, 18, 5, 3, C.red);
}

function shelfFrost(p: Painter): void {
  p.rect(0, 0, 2, 28, C.out).rect(18, 0, 2, 28, C.out);
  for (const y of [4, 13, 22]) p.rect(0, y, 20, 2, C.steel);
  p.rect(3, 9, 5, 4, C.steelD).rect(10, 1, 6, 3, "#6d7c97").rect(4, 18, 9, 4, C.steelDD);
  p.rect(0, 0, 20, 1, ICE.l).rect(2, 14, 3, 1, ICE.l).rect(11, 23, 4, 1, ICE.l);
}

function stalactite(p: Painter): void {
  // Hangs down from its anchor (drawn with origin at the top).
  p.rect(0, 0, 14, 3, FROST.m);
  p.rect(2, 3, 10, 4, FROST.m).rect(4, 7, 6, 4, FROST.d).rect(6, 11, 2, 4, FROST.d);
  p.rect(1, 0, 1, 3, FROST.l).rect(3, 3, 1, 4, FROST.l);
}

function icicles(p: Painter): void {
  for (const [x, h] of [
    [1, 6],
    [5, 10],
    [9, 5],
    [13, 8],
  ]) {
    p.rect(x, 0, 2, h, ICE.m).px(x, h, ICE.l).px(x, 0, ICE.l);
  }
}

function iceColumn(p: Painter): void {
  // A frozen drip column: water ice, lit only by whatever light reaches it.
  p.rect(4, 0, 8, 40, ICE.m).rect(2, 30, 12, 10, ICE.m).rect(3, 34, 10, 6, ICE.d);
  p.rect(5, 2, 1, 26, ICE.l).rect(10, 6, 1, 18, ICE.d);
}

function icePool(p: Painter): void {
  p.rect(0, 0, 40, 3, ICE.d).rect(1, 0, 38, 1, ICE.l).rect(6, 1, 10, 1, ICE.m).rect(22, 1, 8, 1, ICE.m);
}

function sampleCase(p: Painter): void {
  box(p, 0, 4, 18, 10, "#c9c39a");
  p.rect(2, 6, 14, 2, C.red).rect(7, 0, 4, 4, C.out).rect(8, 1, 2, 3, "#c9c39a");
}

function oreCart(p: Painter): void {
  box(p, 2, 0, 26, 12, C.steelD);
  p.rect(4, 2, 22, 3, C.rockD);
  p.disc(8, 14, 3, C.out).disc(22, 14, 3, C.out).disc(8, 14, 1, C.steelL).disc(22, 14, 1, C.steelL);
}

function pipeValve(p: Painter): void {
  p.rect(0, 10, 24, 4, C.out).rect(0, 11, 24, 2, C.steel);
  p.rect(10, 2, 4, 9, C.out).rect(11, 3, 2, 8, C.steel);
  p.rect(6, 0, 12, 3, C.out).rect(7, 1, 10, 1, C.red);
}

function signLab(p: Painter): void {
  p.rect(13, 12, 3, 16, C.out).rect(14, 12, 1, 16, C.steelL);
  box(p, 0, 0, 30, 14, "#33405a");
  drawText(p, "LEVEL", 3, 2, C.glass);
  drawText(p, "B", 23, 2, C.yellow);
  p.rect(3, 9, 24, 2, C.yellow);
}

/** Reflective survey markings: drawn bright (they sit above the darkness, revealed by lamplight). */
function mark(kind: "dl" | "l" | "sensor" | "x"): (p: Painter) => void {
  return (p) => {
    const c = "#fff3b0";
    const e = "#b88a2a";
    if (kind === "l") {
      p.rect(3, 5, 10, 3, c).rect(0, 6, 3, 1, c);
      for (let i = 0; i < 4; i++) p.rect(1 + i, 6 - i, 1, 1 + i * 2, c);
      p.rect(3, 8, 10, 1, e);
    } else if (kind === "dl") {
      for (let i = 0; i < 9; i++) p.rect(3 + i, 2 + i, 2, 2, c);
      p.rect(2, 9, 7, 2, c).rect(2, 4, 2, 7, c);
      p.rect(3, 11, 6, 1, e);
    } else if (kind === "sensor") {
      p.disc(6, 6, 4, c).disc(6, 6, 2, "#6b5520");
      for (const [x, y] of [
        [6, 0],
        [0, 6],
        [12, 6],
        [6, 12],
      ])
        p.px(x, y, c);
    } else {
      for (let i = 0; i < 10; i++) p.rect(i, i, 2, 2, c).rect(9 - i, i, 2, 2, c);
    }
  };
}

// ---------------------------------------------------------------------------
// Echo Ridge
// ---------------------------------------------------------------------------

const AIM_VEC: Array<[number, number]> = [
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
];

/** Relay unit: mast + dish pointing in one of five directions (0 left ... 4 right). */
function relay(aim: number, dusty: boolean): (p: Painter) => void {
  return (p) => {
    p.rect(13, 16, 3, 22, C.out).rect(14, 16, 1, 22, C.steelL);
    box(p, 6, 30, 17, 10, C.steelD);
    p.rect(8, 32, 13, 2, C.steel);
    const [dx, dy] = AIM_VEC[aim];
    const cx = 14;
    const cy = 13;
    // The dish: a short thick arc perpendicular to the aim, plus the feed horn along it.
    for (let t = -5; t <= 5; t++) {
      const px = Math.round(cx - dy * t * 0.9 - dx * Math.abs(t) * 0.25);
      const py = Math.round(cy + dx * t * 0.9 - dy * Math.abs(t) * 0.25);
      p.rect(px - 1, py - 1, 3, 3, C.out);
    }
    for (let t = -4; t <= 4; t++) {
      const px = Math.round(cx - dy * t * 0.9 - dx * Math.abs(t) * 0.25);
      const py = Math.round(cy + dx * t * 0.9 - dy * Math.abs(t) * 0.25);
      p.px(px, py, dusty ? "#b98a63" : C.hullL);
    }
    for (let k = 1; k <= 6; k++) p.px(cx + dx * k, cy + dy * k, C.steel);
    p.rect(cx + dx * 7 - 1, cy + dy * 7 - 1, 3, 3, C.out).px(cx + dx * 7, cy + dy * 7, C.red);
    if (dusty) for (let i = 0; i < 14; i++) p.px(6 + ((i * 7) % 17), 28 + (i % 4), C.dust);
  };
}

/** Status lamp above a relay: a check or a cross (not colour alone). */
function relayStatus(ok: boolean): (p: Painter) => void {
  return (p) => {
    box(p, 0, 0, 11, 9, C.navy);
    if (ok) {
      p.px(2, 4, C.mint).px(3, 5, C.mint).px(4, 6, C.mint).px(5, 5, C.mint).px(6, 4, C.mint).px(7, 3, C.mint).px(8, 2, C.mint);
    } else {
      for (let i = 0; i < 5; i++) p.px(3 + i, 2 + i, C.red).px(7 - i, 2 + i, C.red);
    }
  };
}

const ARROW_GLYPH: Array<Array<[number, number]>> = [
  [[0, 3], [1, 2], [1, 3], [1, 4], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3]],
  [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5]],
  [[3, 0], [2, 1], [3, 1], [4, 1], [3, 2], [3, 3], [3, 4], [3, 5], [3, 6]],
  [[3, 0], [4, 0], [5, 0], [5, 1], [5, 2], [4, 1], [3, 2], [2, 3], [1, 4], [0, 5]],
  [[6, 3], [5, 2], [5, 3], [5, 4], [4, 3], [3, 3], [2, 3], [1, 3], [0, 3]],
];

/** Painted plaque under a relay: its symbol and the direction its dish must point. */
function plaque(symbol: "tri" | "circle" | "square", aim: number): (p: Painter) => void {
  return (p) => {
    p.rect(10, 12, 2, 6, C.out);
    box(p, 0, 0, 22, 13, C.cream);
    if (symbol === "tri") for (let i = 0; i < 4; i++) p.rect(5 - i, 3 + i * 2, 1 + i * 2, 2, C.out);
    else if (symbol === "circle") p.disc(5, 6, 3, C.out).disc(5, 6, 2, C.cream);
    else p.rect(2, 3, 7, 7, C.out).rect(3, 4, 5, 5, C.cream);
    for (const [x, y] of ARROW_GLYPH[aim]) p.px(12 + x, 3 + y, C.redDark);
  };
}

function ridgeJunction(on: boolean): (p: Painter) => void {
  return (p) => {
    box(p, 0, 6, 26, 28, "#7d6f63");
    box(p, 3, 9, 20, 12, on ? C.navy : C.steelDD);
    if (on) {
      p.rect(5, 11, 3, 3, C.mint).rect(10, 11, 3, 3, C.mint).rect(15, 11, 3, 3, C.mint);
      p.rect(5, 16, 13, 1, C.glass);
    }
    p.rect(8, 24, 10, 6, C.out).rect(9, 25, 8, 4, on ? "#5fb7f0" : C.steelD);
    p.rect(11, 0, 4, 6, C.out).rect(12, 1, 2, 5, C.steel);
    p.rect(0, 32, 26, 2, C.out);
  };
}

function towerConsole(on: boolean): (p: Painter) => void {
  return (p) => {
    box(p, 0, 8, 24, 20, C.steelD);
    box(p, 2, 0, 20, 12, on ? C.navy : C.steelDD);
    if (on) {
      p.disc(12, 6, 4, C.glass).disc(12, 6, 2, C.navy).px(12, 6, C.red);
      p.rect(4, 2, 2, 1, C.mint).rect(18, 9, 2, 1, C.mint);
    }
    p.rect(4, 15, 16, 2, on ? C.yellow : C.steel).rect(0, 26, 24, 2, C.out);
  };
}

function surveyHut(p: Painter): void {
  // A collapsed survey hut: half a dome, a doorway, dust drifts.
  p.dome(30, 34, 26, "#b9b2a6");
  p.dome(30, 34, 22, "#a39b8e");
  p.rect(0, 26, 60, 8, "#00000000");
  p.rect(36, 18, 30, 16, "#00000000");
  for (let x = 34; x < 58; x++) p.rect(x, 34 - Math.floor((x - 34) * 0.6), 1, Math.floor((x - 34) * 0.6), "#5a2a27");
  box(p, 18, 20, 10, 14, "#3a2f2a");
  p.rect(4, 32, 52, 2, C.dust);
}

function oldAntenna(p: Painter): void {
  p.rect(9, 6, 2, 34, C.out).rect(10, 6, 1, 34, C.steel);
  for (let y = 10; y < 36; y += 6) p.rect(5, y, 10, 1, C.steelD);
  p.rect(2, 0, 16, 2, C.out).rect(4, 2, 2, 5, C.steel).rect(14, 2, 2, 4, C.steel);
  p.rect(3, 38, 14, 2, C.out);
}

function hoodoo(p: Painter): void {
  // Rock spire with a balanced cap: the ridge's silhouette motif.
  const r = rng(77);
  p.rect(4, 0, 24, 8, RIDGE.d).rect(5, 1, 22, 5, RIDGE.m).rect(6, 1, 18, 1, RIDGE.l);
  for (let y = 8; y < 60; y++) {
    const w = 8 + Math.round(Math.sin(y / 6) * 2 + y / 8);
    const x0 = 16 - Math.floor(w / 2);
    p.rect(x0, y, w, 1, RIDGE.m).px(x0, y, RIDGE.l).px(x0 + w - 1, y, RIDGE.d);
    if (y % 7 === 0) p.rect(x0 + 1, y, w - 2, 1, RIDGE.d);
    if (r() < 0.08) p.px(x0 + 2 + Math.floor(r() * (w - 4)), y, RIDGE.dd);
  }
}

function rope(p: Painter): void {
  for (let y = 0; y < 64; y++) p.px(1 + Math.round(Math.sin(y / 5)), y, "#c9a56a");
  p.rect(0, 0, 4, 3, C.steel);
}

function campTent(p: Painter): void {
  for (let i = 0; i < 16; i++) p.rect(16 - i, i, i * 2, 1, i < 2 ? C.orange : "#d9783f");
  p.rect(0, 16, 32, 2, C.out).rect(14, 8, 4, 8, "#7a3c33");
}

function habitatRuin(p: Painter): void {
  box(p, 0, 6, 30, 22, "#9a948a");
  p.rect(3, 9, 8, 6, C.navy).rect(18, 9, 8, 6, "#5a544c");
  p.rect(0, 0, 14, 7, "#9a948a").rect(20, 2, 10, 5, "#9a948a");
  p.rect(4, 22, 22, 6, C.dust);
}

function towerFrame(p: Painter): void {
  // The relay tower's lattice (behind the stairs): tapering legs and cross-bracing.
  const W = 256;
  const H = 240;
  for (let y = 0; y < H; y++) {
    const inset = Math.round((1 - y / H) * 26);
    p.px(inset, y, C.steelD).px(inset + 1, y, C.steel);
    p.px(W - 1 - inset, y, C.steelD).px(W - 2 - inset, y, C.steel);
  }
  for (let y = 16; y < H; y += 32) {
    const inset = Math.round((1 - y / H) * 26);
    for (let x = inset; x < W - inset; x++) {
      const t = (x - inset) / (W - 2 * inset);
      p.px(x, y + Math.round(t * 28), C.steelD).px(x, y + Math.round((1 - t) * 28), C.steelD);
    }
  }
}

function towerDish(p: Painter): void {
  for (let t = -18; t <= 18; t++) {
    const y = Math.round((t * t) / 26);
    p.rect(20 + t, 10 - y, 1, 4, C.out).px(20 + t, 11 - y, C.hullL);
  }
  p.rect(19, 10, 3, 14, C.out).rect(20, 10, 1, 14, C.steelL);
  p.rect(18, 0, 5, 5, C.out).rect(19, 1, 3, 3, C.red);
}

function towerFar(p: Painter): void {
  // Distant silhouette of the tower (seen from the approach), with a red light.
  const col = "#5a2d3c";
  for (let y = 10; y < 120; y++) {
    const w = 3 + Math.round((y / 120) * 18);
    p.rect(20 - Math.floor(w / 2), y, w, 1, col);
  }
  for (let t = -10; t <= 10; t++) p.px(20 + t, 10 - Math.round((t * t) / 18), col);
  p.rect(19, 0, 3, 10, col).rect(19, 0, 3, 3, C.red);
}

function telescope(p: Painter): void {
  p.rect(6, 10, 2, 14, C.out).rect(2, 22, 10, 2, C.out).rect(1, 20, 2, 4, C.out).rect(11, 20, 2, 4, C.out);
  p.rect(0, 4, 18, 5, C.out).rect(1, 5, 16, 3, C.steelL).rect(15, 3, 4, 7, C.out).rect(16, 4, 2, 5, C.glass);
}

function signRelay(p: Painter): void {
  p.rect(13, 12, 3, 16, C.out).rect(14, 12, 1, 16, C.steelL);
  box(p, 0, 0, 30, 14, C.cream);
  drawText(p, "RELAY", 3, 2, C.redDark);
  p.rect(6, 9, 16, 1, C.steelD).px(21, 8, C.steelD).px(21, 10, C.steelD).px(20, 7, C.steelD).px(20, 11, C.steelD);
}

function signOverlook(p: Painter): void {
  p.rect(13, 12, 3, 16, C.out).rect(14, 12, 1, 16, C.steelL);
  box(p, 0, 0, 34, 14, C.cream);
  drawText(p, "VIEW", 17 - Math.floor(textWidth("VIEW") / 2), 2, C.redDark);
  p.rect(4, 9, 26, 1, C.steelD);
}

// ---------------------------------------------------------------------------
// Lighting stamps (erase the darkness) and small particles
// ---------------------------------------------------------------------------

/** Stepped radial light (pixel-art banding, not a smooth gradient). Alpha = how much darkness it removes. */
function lightStamp(radius: number): PropDef {
  const size = radius * 2;
  return {
    w: size,
    h: size,
    draw: (p) => {
      for (let y = 0; y < size; y += 2)
        for (let x = 0; x < size; x += 2) {
          const d = Math.hypot(x - radius + 1, y - radius + 1) / radius;
          if (d >= 1) continue;
          const a = d < 0.45 ? 1 : d < 0.65 ? 0.8 : d < 0.82 ? 0.55 : 0.3;
          p.rect(x, y, 2, 2, "#ffffff", a);
        }
    },
  };
}

/** The headlamp beam: a soft cone pointing right (flipped for left). */
function lampCone(p: Painter): void {
  const W = 150;
  const H = 96;
  for (let x = 0; x < W; x += 2) {
    const half = 8 + (x / W) * 40;
    for (let y = 0; y < H; y += 2) {
      const dy = Math.abs(y - H / 2 + 1);
      if (dy > half) continue;
      const edge = dy / half;
      const far = x / W;
      const a = (edge < 0.55 ? 1 : edge < 0.8 ? 0.7 : 0.4) * (far < 0.6 ? 1 : far < 0.85 ? 0.7 : 0.4);
      p.rect(x, y, 2, 2, "#ffffff", a);
    }
  }
}

export const REGION_PROPS: Record<string, PropDef> = {
  lift_top_off: { w: 28, h: 44, draw: liftCage(false, true) },
  lift_top_on: { w: 28, h: 44, draw: liftCage(true, true) },
  lift_car_off: { w: 28, h: 44, draw: liftCage(false, false) },
  lift_car_on: { w: 28, h: 44, draw: liftCage(true, false) },
  freight_lift_off: { w: 30, h: 44, draw: freightLift(false) },
  freight_lift_on: { w: 30, h: 44, draw: freightLift(true) },
  gate_panel_off: { w: 14, h: 22, draw: gatePanel(false) },
  gate_panel_on: { w: 14, h: 22, draw: gatePanel(true) },
  north_gate: { w: 30, h: 64, draw: northGate },
  ridge_hatch_off: { w: 30, h: 24, draw: ridgeHatch(false) },
  ridge_hatch_on: { w: 30, h: 24, draw: ridgeHatch(true) },
  cable_car_off: { w: 30, h: 46, draw: cableCar(false, false) },
  cable_car_on: { w: 30, h: 46, draw: cableCar(true, false) },
  cable_dock_off: { w: 30, h: 46, draw: cableCar(false, true) },
  cable_dock_on: { w: 30, h: 46, draw: cableCar(true, true) },
  lamp_kit_full: { w: 20, h: 20, draw: lampKit(true) },
  lamp_kit_empty: { w: 20, h: 20, draw: lampKit(false) },
  light_sensor_off: { w: 13, h: 28, draw: lightSensor(false) },
  light_sensor_on: { w: 13, h: 28, draw: lightSensor(true) },
  battery_bank: { w: 34, h: 26, draw: batteryBank },
  junction_broken: { w: 24, h: 26, draw: junction(false) },
  junction_fixed: { w: 24, h: 26, draw: junction(true) },
  core_drill_off: { w: 28, h: 40, draw: coreDrill(false) },
  core_drill_on: { w: 28, h: 40, draw: coreDrill(true) },
  locker_closed: { w: 16, h: 26, draw: salvageLocker(false) },
  locker_open: { w: 16, h: 26, draw: salvageLocker(true) },
  lab_console: { w: 26, h: 24, draw: labConsole },
  crew_lamp: { w: 14, h: 16, draw: crewLamp },
  frozen_generator: { w: 32, h: 24, draw: frozenGenerator },
  shelf_frost: { w: 20, h: 28, draw: shelfFrost },
  stalactite: { w: 14, h: 15, draw: stalactite },
  icicles: { w: 16, h: 11, draw: icicles },
  ice_column: { w: 16, h: 40, draw: iceColumn },
  ice_pool: { w: 40, h: 3, draw: icePool },
  sample_case: { w: 18, h: 14, draw: sampleCase },
  ore_cart: { w: 30, h: 18, draw: oreCart },
  pipe_valve: { w: 24, h: 14, draw: pipeValve },
  sign_lab: { w: 30, h: 28, draw: signLab },
  mark_arrow_l: { w: 14, h: 10, draw: mark("l") },
  mark_arrow_dl: { w: 14, h: 13, draw: mark("dl") },
  mark_sensor: { w: 13, h: 13, draw: mark("sensor") },
  mark_x: { w: 12, h: 12, draw: mark("x") },
  ...Object.fromEntries([0, 1, 2, 3, 4].flatMap((a) => [[`relay_${a}`, { w: 28, h: 40, draw: relay(a, false) }], [`relay_dusty_${a}`, { w: 28, h: 40, draw: relay(a, true) }]])),
  relay_ok: { w: 11, h: 9, draw: relayStatus(true) },
  relay_off: { w: 11, h: 9, draw: relayStatus(false) },
  plaque_tri: { w: 22, h: 18, draw: plaque("tri", 3) },
  plaque_circle: { w: 22, h: 18, draw: plaque("circle", 3) },
  plaque_square: { w: 22, h: 18, draw: plaque("square", 4) },
  ridge_junction_off: { w: 26, h: 34, draw: ridgeJunction(false) },
  ridge_junction_on: { w: 26, h: 34, draw: ridgeJunction(true) },
  tower_console_off: { w: 24, h: 28, draw: towerConsole(false) },
  tower_console_on: { w: 24, h: 28, draw: towerConsole(true) },
  survey_hut: { w: 60, h: 36, draw: surveyHut },
  old_antenna: { w: 20, h: 40, draw: oldAntenna },
  hoodoo: { w: 32, h: 60, draw: hoodoo },
  rope: { w: 4, h: 64, draw: rope },
  camp_tent: { w: 32, h: 18, draw: campTent },
  habitat_ruin: { w: 30, h: 28, draw: habitatRuin },
  tower_frame: { w: 256, h: 240, draw: towerFrame },
  tower_dish: { w: 40, h: 24, draw: towerDish },
  tower_far: { w: 40, h: 120, draw: towerFar },
  telescope: { w: 19, h: 24, draw: telescope },
  sign_overlook: { w: 34, h: 28, draw: signOverlook },
  sign_relay: { w: 30, h: 28, draw: signRelay },
  light_s: lightStamp(32),
  light_m: lightStamp(56),
  light_l: lightStamp(96),
  lamp_cone: { w: 150, h: 96, draw: lampCone },
  px_frost: { w: 1, h: 1, draw: (p) => p.px(0, 0, ICE.l) },
  signal_dot: { w: 4, h: 2, draw: (p) => p.rect(0, 0, 2, 2, C.mint) },
};

// ---------------------------------------------------------------------------
// Backdrops (480 px wide seamless strips)
// ---------------------------------------------------------------------------

function band(p: Painter, cols: string[], stops: number[]): void {
  for (let i = 0; i < cols.length; i++) {
    p.rect(0, stops[i], VIEW_W, stops[i + 1] - stops[i], cols[i]);
    if (i < cols.length - 1) p.dither(0, stops[i + 1] - 4, VIEW_W, 4, cols[i], cols[i + 1], 0.5);
  }
}

const wave = (x: number, w: Array<[number, number, number]>) => w.reduce((y, [a, per, ph]) => y + a * Math.sin((x / per) * Math.PI * 2 + ph), 0);

export function drawDepthsBack(layer: "sky" | "far" | "mid" | "near"): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(VIEW_W, VIEW_H);
  const p = new Painter(ctx);
  const r = rng(layer.length * 31 + 5);
  if (layer === "sky") {
    band(p, ["#07081a", "#0d0f28", "#141634", "#191b3d"], [0, 70, 150, 220, VIEW_H]);
    for (let i = 0; i < 40; i++) p.px(Math.floor(r() * VIEW_W), Math.floor(r() * VIEW_H), "#262a52");
    return canvas;
  }
  if (layer === "far") {
    // Distant cave wall: columns and arches.
    for (let x = 0; x < VIEW_W; x++) {
      const top = Math.round(30 + wave(x, [[14, 160, 0.3], [8, 60, 1.2]]));
      const bot = Math.round(200 + wave(x, [[16, 240, 2.1], [6, 80, 0.4]]));
      p.rect(x, 0, 1, top, "#1d2046").rect(x, bot, 1, VIEW_H - bot, "#1d2046");
    }
    for (const cx of [60, 210, 380]) p.rect(cx, 40, 14, 170, "#1a1c40");
    return canvas;
  }
  if (layer === "mid") {
    // Hanging rock formations and stubby stalagmites, with a few faint ice veins (not glowing).
    for (let i = 0; i < 9; i++) {
      const x = Math.floor((i / 9) * VIEW_W + r() * 30);
      const len = 20 + Math.floor(r() * 50);
      for (let y = 0; y < len; y++) {
        const w = Math.max(1, Math.round((1 - y / len) * (10 + r() * 2)));
        p.rect(x - Math.floor(w / 2), y, w, 1, "#272a52");
      }
    }
    for (let x = 0; x < VIEW_W; x++) {
      const y = Math.round(226 + wave(x, [[8, 120, 0.9], [4, 40, 0.2]]));
      p.rect(x, y, 1, VIEW_H - y, "#252850");
    }
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(r() * VIEW_W);
      const y = 150 + Math.floor(r() * 60);
      p.rect(x, y, 6 + Math.floor(r() * 10), 1, "#3a5f78");
    }
    return canvas;
  }
  for (let x = 0; x < VIEW_W; x++) {
    const y = Math.round(244 + wave(x, [[6, 160, 1.4], [3, 50, 0.6]]));
    p.rect(x, y, 1, VIEW_H - y, "#1b1d3a");
  }
  return canvas;
}

export function drawRidgeBack(layer: "sky" | "far" | "mid" | "near"): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(VIEW_W, VIEW_H);
  const p = new Painter(ctx);
  const r = rng(layer.length * 53 + 9);
  if (layer === "sky") {
    // Warmer horizon than the canyon: dusk orange low down, plum high up.
    band(p, ["#2a1838", "#4a2246", "#7a3148", "#b84e4a", "#e07a52", "#f2a86a"], [0, 40, 84, 128, 168, 210, VIEW_H]);
    for (let i = 0; i < 50; i++) p.px(Math.floor(r() * VIEW_W), Math.floor(r() * 70), C.white, 0.3 + r() * 0.5);
    p.disc(110, 168, 6, "#f6d6a0", 0.4).disc(110, 168, 4, "#fff6e0");
    return canvas;
  }
  if (layer === "far") {
    // Tall, jagged mountain range (pointed, unlike the canyon's flat mesas).
    for (let x = 0; x < VIEW_W; x++) {
      let y = 150 + wave(x, [[10, 240, 0.2], [6, 80, 1.7]]);
      for (const [px, h, w] of [
        [40, 92, 46],
        [150, 70, 38],
        [260, 104, 52],
        [390, 80, 40],
      ]) {
        const d = Math.abs(((x - px + VIEW_W * 1.5) % VIEW_W) - VIEW_W / 2) - 0;
        const dist = Math.min(Math.abs(x - px), VIEW_W - Math.abs(x - px));
        void d;
        if (dist < w) y = Math.min(y, 150 - h * (1 - dist / w) + wave(x, [[3, 12, px]]));
      }
      const yy = Math.round(y);
      p.rect(x, yy, 1, VIEW_H - yy, "#6a2f4a");
      p.px(x, yy, "#8a405a");
    }
    return canvas;
  }
  if (layer === "mid") {
    // Ridge line with hoodoos and an arch.
    for (let x = 0; x < VIEW_W; x++) {
      const y = Math.round(196 + wave(x, [[8, 160, 0.9], [4, 60, 2.2]]));
      p.rect(x, y, 1, VIEW_H - y, "#7e3a42");
      p.px(x, y, "#a04e4c");
    }
    for (const hx of [70, 182, 300, 430]) {
      const h = 40 + Math.floor(r() * 30);
      for (let y = 0; y < h; y++) {
        const w = 4 + Math.round(y / 9);
        p.rect(hx - Math.floor(w / 2), 190 - h + y, w, 1, "#7e3a42");
      }
      p.rect(hx - 7, 190 - h - 4, 14, 5, "#7e3a42");
    }
    return canvas;
  }
  for (let x = 0; x < VIEW_W; x++) {
    const y = Math.round(232 + wave(x, [[6, 120, 1.1], [2, 30, 0.4]]));
    p.rect(x, y, 1, VIEW_H - y, "#5a2a33");
  }
  return canvas;
}
