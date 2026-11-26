/**
 * Phase 4 art: the outpost's engineering. Same rules as props.ts: integer pixels, the shared
 * palette, a dark outline. Every machine has a clearly different OFF / ON look that does not rely
 * on colour alone: screens show symbols, broken parts show gaps and crosses, running machines move.
 */
import { drawText, textWidth } from "./font";
import { C } from "./palette";
import type { Painter } from "./painter";
import type { PropDef } from "./props";

const box = (p: Painter, x: number, y: number, w: number, h: number, fill: string, edge: string = C.out) => p.rect(x, y, w, h, edge).rect(x + 1, y + 1, w - 2, h - 2, fill);
const LEAF = { l: "#8fe08a", m: "#4fae5d", d: "#2f7d45" };
const SOIL = { l: "#8a5a3a", m: "#6b3b2a", d: "#4a2a20" };

// ---------------------------------------------------------------------------
// Recharge station: a short post with a lightning symbol and a charge bar.
// ---------------------------------------------------------------------------
function recharge(state: "dead" | "on" | "charging"): (p: Painter) => void {
  return (p) => {
    box(p, 3, 4, 12, 22, state === "dead" ? C.steelD : C.steel);
    p.rect(1, 24, 16, 3, C.out).rect(2, 25, 14, 1, C.steelD);
    box(p, 5, 6, 8, 9, C.navy);
    if (state === "dead") {
      // A dark screen with a cross: unmistakable without colour.
      p.px(6, 8, C.red).px(7, 9, C.red).px(8, 10, C.red).px(9, 11, C.red).px(10, 12, C.red).px(10, 8, C.red).px(9, 9, C.red).px(7, 11, C.red).px(6, 12, C.red);
    } else {
      // Lightning bolt.
      const bolt = state === "charging" ? C.white : C.yellow;
      p.rect(9, 7, 2, 2, bolt).rect(8, 9, 2, 1, bolt).rect(7, 10, 4, 1, bolt).rect(8, 11, 2, 1, bolt).rect(7, 12, 2, 2, bolt);
    }
    // Charge bar.
    box(p, 5, 17, 8, 5, C.steelDD);
    if (state !== "dead") p.rect(6, 18, state === "charging" ? 6 : 3, 3, C.mint);
    p.rect(8, 1, 2, 3, C.out).px(8, 0, state === "dead" ? C.steelD : C.mint);
  };
}

// ---------------------------------------------------------------------------
// Ship cargo locker, base terminal, probes, shelter monitor, power console
// ---------------------------------------------------------------------------
function cargoLocker(open: boolean): (p: Painter) => void {
  return (p) => {
    box(p, 0, 0, 18, 20, C.steelD);
    if (open) {
      box(p, 2, 2, 14, 16, C.navy);
      p.rect(3, 12, 12, 1, C.steel);
      p.rect(0, 1, 3, 18, C.steel).rect(0, 1, 1, 18, C.out);
    } else {
      p.rect(2, 2, 14, 16, C.steel).rect(8, 2, 1, 16, C.out);
      p.rect(6, 9, 2, 3, C.yellow).rect(10, 9, 2, 3, C.yellow);
      p.rect(3, 4, 4, 1, C.steelL).rect(11, 4, 4, 1, C.steelL);
    }
  };
}

function baseTerminal(on: boolean): (p: Painter) => void {
  return (p) => {
    p.rect(7, 14, 4, 12, C.out).rect(8, 14, 2, 12, C.steel);
    p.rect(3, 24, 12, 2, C.out);
    box(p, 0, 0, 18, 15, C.steelD);
    box(p, 2, 2, 14, 10, C.navy);
    if (on) {
      // A tiny network diagram: a sun feeding a battery feeding three boxes.
      p.px(4, 4, C.yellow).px(5, 4, C.yellow).px(4, 5, C.yellow).px(5, 5, C.yellow);
      p.rect(6, 5, 3, 1, C.glass).rect(9, 4, 2, 3, C.mint);
      p.rect(11, 5, 1, 1, C.glass).rect(12, 3, 2, 2, C.glass).rect(12, 6, 2, 2, C.glass).rect(12, 9, 2, 2, C.glass);
      p.rect(4, 9, 5, 1, C.mint);
    } else {
      p.rect(4, 6, 10, 1, C.steelDD);
    }
  };
}

function probe(on: boolean): (p: Painter) => void {
  return (p) => {
    p.rect(4, 8, 2, 14, C.out).rect(4, 8, 1, 14, C.steelL);
    p.rect(1, 21, 8, 2, C.out);
    // A little ear-shaped sensor (it "listens" to the suit radio).
    box(p, 0, 0, 10, 9, on ? C.steel : C.steelD);
    p.rect(2, 2, 6, 5, on ? C.navy : C.steelDD);
    p.rect(4, 3, 2, 3, on ? C.mint : C.steelD);
    p.rect(8, 0, 2, 2, C.out).px(9, 0, on ? C.mint : C.red);
  };
}

function shelterMonitor(state: "off" | "awake" | "ready"): (p: Painter) => void {
  return (p) => {
    p.rect(7, 16, 4, 8, C.out).rect(8, 16, 2, 8, C.steel);
    box(p, 0, 0, 18, 17, C.steelD);
    box(p, 2, 2, 14, 11, C.navy);
    if (state === "off") {
      p.rect(4, 7, 10, 1, C.steelDD);
    } else {
      // Two bars: outside (tall) and inside (short) readings once calibrated.
      p.rect(4, 11, 3, 1, C.glass);
      p.rect(10, 11, 3, 1, C.glass);
      if (state === "ready") p.rect(4, 4, 3, 7, C.orange).rect(10, 9, 3, 2, C.mint);
      else p.px(5, 6, C.glass).px(11, 6, C.glass);
    }
    p.px(16, 15, state === "ready" ? C.mint : state === "awake" ? C.yellow : C.red);
  };
}

function distConsole(state: "off" | "on" | "alert"): (p: Painter) => void {
  return (p) => {
    box(p, 0, 6, 22, 16, C.steelD);
    box(p, 2, 0, 18, 8, C.steel);
    box(p, 3, 1, 16, 6, C.navy);
    if (state !== "off") {
      // Supply bar on the screen.
      p.rect(4, 3, state === "alert" ? 6 : 13, 2, state === "alert" ? C.orange : C.mint);
      if (state === "alert") p.rect(11, 3, 1, 2, C.white).rect(13, 3, 1, 2, C.white);
    }
    // Three big switches with symbol slots.
    for (let i = 0; i < 3; i++) {
      const x = 3 + i * 6;
      box(p, x, 11, 5, 8, C.steelDD);
      p.rect(x + 1, state === "off" ? 16 : 12, 3, 3, state === "off" ? C.steel : C.yellow);
    }
  };
}

// ---------------------------------------------------------------------------
// Habitat quarters
// ---------------------------------------------------------------------------
function mat(p: Painter): void {
  p.rect(0, 2, 28, 5, C.out).rect(1, 3, 26, 3, "#3f6fb5").rect(1, 3, 26, 1, "#6a95d6");
  p.rect(2, 0, 7, 3, C.out).rect(3, 1, 5, 2, C.cream);
  // Paw print.
  p.px(17, 4, C.cream).px(19, 4, C.cream).px(21, 4, C.cream).rect(18, 5, 3, 1, C.cream);
}

function storageLocker(open: boolean): (p: Painter) => void {
  return (p) => {
    box(p, 0, 0, 16, 26, C.steel);
    if (open) {
      box(p, 2, 2, 12, 22, C.navy);
      p.rect(3, 9, 10, 1, C.steelD).rect(3, 16, 10, 1, C.steelD);
      p.rect(4, 5, 4, 4, "#7b8ec8").rect(4, 12, 6, 4, "#c98a5a");
    } else {
      p.rect(2, 2, 12, 22, C.steelL).rect(2, 12, 12, 1, C.steelD);
      p.rect(11, 6, 2, 4, C.out).rect(11, 15, 2, 4, C.out);
      p.rect(4, 4, 6, 2, C.steel);
    }
  };
}

function wallLamp(on: boolean): (p: Painter) => void {
  return (p) => {
    p.rect(3, 0, 4, 3, C.out).rect(0, 3, 10, 4, C.out).rect(1, 4, 8, 2, on ? "#ffe3a0" : C.steelD);
  };
}

function statusLight(on: boolean): (p: Painter) => void {
  return (p) => {
    box(p, 0, 0, 8, 8, C.steelD);
    p.rect(2, 2, 4, 4, on ? C.mint : C.red);
    // Shape, not just colour: a tick when on, a bar when off.
    if (on) p.px(2, 4, C.white).px(3, 5, C.white).px(4, 4, C.white).px(5, 3, C.white);
    else p.rect(2, 4, 4, 1, C.white);
  };
}

function potPlant(p: Painter): void {
  p.rect(2, 8, 8, 6, C.out).rect(3, 9, 6, 4, "#c25d35");
  p.rect(5, 2, 2, 7, LEAF.d).rect(2, 3, 3, 3, LEAF.m).rect(7, 1, 3, 4, LEAF.m).rect(4, 0, 2, 3, LEAF.l);
}

// ---------------------------------------------------------------------------
// Life support, power boxes, grow room, water
// ---------------------------------------------------------------------------
function recycler(state: "broken" | "off" | "on0" | "on1"): (p: Painter) => void {
  return (p) => {
    // Body with two drums and a fan window.
    box(p, 0, 4, 32, 28, state === "broken" || state === "off" ? C.steelD : C.steel);
    box(p, 3, 7, 10, 20, C.steelDD);
    box(p, 19, 7, 10, 20, C.steelDD);
    // Water level in the drums.
    const running = state === "on0" || state === "on1";
    if (running) p.rect(4, 18, 8, 8, C.water).rect(20, 14, 8, 12, C.water);
    // Fan.
    box(p, 13, 9, 6, 6, C.navy);
    if (running) {
      if (state === "on0") p.rect(14, 11, 4, 2, C.steelL);
      else p.rect(15, 10, 2, 4, C.steelL);
    }
    // Cartridge slot: a gap (missing) or a part.
    box(p, 13, 18, 6, 8, C.navy);
    if (state !== "broken") p.rect(14, 19, 4, 6, C.blueL).rect(15, 20, 2, 4, C.blue);
    else p.px(14, 19, C.red).px(17, 19, C.red).px(15, 21, C.red).px(16, 21, C.red).px(14, 24, C.red).px(17, 24, C.red);
    // Top pipes.
    p.rect(6, 0, 3, 5, C.out).rect(7, 0, 1, 5, running ? C.water : C.steel);
    p.rect(23, 0, 3, 5, C.out).rect(24, 0, 1, 5, running ? C.water : C.steel);
    // Status lamp.
    p.rect(14, 28, 4, 3, C.out).rect(15, 29, 2, 1, running ? C.mint : C.red);
  };
}

function powerBox(on: boolean): (p: Painter) => void {
  return (p) => {
    box(p, 0, 0, 12, 16, C.steelD);
    p.rect(2, 2, 8, 6, C.navy);
    if (on) p.rect(5, 3, 2, 2, C.yellow).rect(4, 5, 2, 1, C.yellow).rect(6, 6, 1, 1, C.yellow);
    else p.rect(3, 4, 6, 1, C.steelDD);
    p.rect(4, 10, 4, 4, on ? C.mint : C.red);
    p.rect(5, 14, 2, 2, C.out);
  };
}

function planter(stage: "dry" | "wet" | "seeds" | "sprouts" | "small" | "mature"): (p: Painter) => void {
  return (p) => {
    // Tray on short legs.
    p.rect(1, 16, 3, 4, C.out).rect(32, 16, 3, 4, C.out);
    box(p, 0, 10, 36, 7, C.steel);
    p.rect(2, 11, 32, 4, stage === "dry" ? "#a9764a" : SOIL.m);
    if (stage === "dry") for (let x = 4; x < 32; x += 6) p.px(x, 12, "#c99a6a");
    if (stage === "wet" || stage === "seeds") p.rect(2, 11, 32, 1, SOIL.l);
    if (stage === "seeds") for (let x = 5; x < 32; x += 6) p.px(x, 12, C.cream);
    const plant = (x: number, h: number) => {
      p.rect(x, 11 - h, 1, h, LEAF.d);
      if (h >= 2) p.px(x - 1, 11 - h, LEAF.m).px(x + 1, 11 - h + 1, LEAF.m);
      if (h >= 5) p.rect(x - 3, 11 - h, 3, 3, LEAF.m).rect(x + 1, 11 - h + 1, 3, 3, LEAF.l).px(x - 2, 11 - h - 1, LEAF.l);
      if (h >= 8) p.rect(x - 3, 11 - h + 4, 7, 3, LEAF.m).rect(x - 2, 11 - h - 2, 5, 2, "#c75b6e");
    };
    const h = stage === "sprouts" ? 2 : stage === "small" ? 5 : stage === "mature" ? 9 : 0;
    if (h) for (let x = 5; x < 33; x += 6) plant(x, h);
  };
}

function growLamp(on: boolean): (p: Painter) => void {
  return (p) => {
    p.rect(4, 0, 1, 3, C.out).rect(35, 0, 1, 3, C.out);
    box(p, 0, 3, 40, 5, C.steelD);
    for (let x = 2; x < 38; x += 4) p.rect(x, 5, 2, 2, on ? (x % 8 === 2 ? "#ff7a9c" : "#8fa8ff") : C.steelDD);
  };
}

function valve(open: boolean): (p: Painter) => void {
  return (p) => {
    p.rect(0, 9, 12, 4, C.out).rect(0, 10, 12, 2, open ? C.water : C.steel);
    p.rect(5, 2, 2, 8, C.out);
    if (open) p.rect(1, 1, 10, 2, C.out).rect(2, 1, 8, 1, C.red);
    else p.rect(5, 0, 2, 5, C.out).rect(5, 0, 2, 1, C.red).rect(4, 1, 4, 2, C.red);
  };
}

function waterProcessor(state: "off" | "on0" | "on1"): (p: Painter) => void {
  return (p) => {
    box(p, 0, 6, 28, 26, state === "off" ? C.steelD : C.steel);
    // Melt chamber with ice block.
    box(p, 3, 9, 12, 14, C.navy);
    p.rect(5, 11, 8, 6, "#d9f1f7").rect(5, 11, 8, 1, C.white);
    if (state !== "off") p.rect(4, 19, 10, 3, C.water).px(state === "on0" ? 7 : 10, 18, C.glassL);
    // Gauge.
    box(p, 17, 9, 8, 8, C.cream);
    p.rect(20, 12, 1, 3, C.out).px(state === "off" ? 19 : 22, state === "off" ? 15 : 11, C.out);
    // Coupling port (empty socket when off).
    box(p, 17, 20, 8, 6, C.steelDD);
    if (state !== "off") p.rect(18, 21, 6, 4, C.blueL);
    p.rect(11, 0, 4, 7, C.out).rect(12, 0, 2, 7, state === "off" ? C.steel : C.water);
  };
}

function tankFrame(p: Painter): void {
  box(p, 0, 0, 20, 34, C.steelD);
  box(p, 2, 2, 16, 28, C.navy);
  for (let y = 7; y < 30; y += 6) p.rect(16, y, 2, 1, C.steelL);
  p.rect(1, 32, 4, 2, C.out).rect(15, 32, 4, 2, C.out);
}

function seismometer(on: boolean): (p: Painter) => void {
  return (p) => {
    p.rect(1, 12, 2, 4, C.out).rect(13, 12, 2, 4, C.out).rect(7, 12, 2, 4, C.out);
    p.dome(8, 13, 7, C.out).dome(8, 13, 6, on ? C.steelL : C.steel);
    p.rect(3, 12, 10, 1, C.steelD);
    p.rect(7, 4, 2, 2, C.out).px(7, 4, on ? C.mint : C.red);
  };
}

function deepProbe(on: boolean): (p: Painter) => void {
  return (p) => {
    box(p, 2, 0, 10, 18, on ? C.steel : C.steelD);
    p.rect(4, 2, 6, 4, C.navy).rect(5, 3, on ? 4 : 1, 2, on ? C.mint : C.red);
    p.rect(6, 18, 2, 6, C.out);
    for (let y = 8; y < 16; y += 3) p.rect(4, y, 6, 1, "#9fd3e3");
  };
}

// ---------------------------------------------------------------------------
// Surface: greenhouse dome, vent stack, base beacon; signs
// ---------------------------------------------------------------------------
const DW = 56;
const DCX = 28;
const DR = 25;
const DBASE = 31;
function greenhouseDome(p: Painter): void {
  // A glass dome on a low wall: the grow room's skylight, seen from the surface.
  p.rect(0, DBASE - 1, DW, 8, C.out).rect(1, DBASE, DW - 2, 6, C.hullD).rect(1, DBASE, DW - 2, 1, C.hull);
  p.dome(DCX, DBASE, DR + 1, C.out);
  p.dome(DCX, DBASE, DR, "#2b3550");
  p.dome(DCX, DBASE, DR - 1, "#3a4c6a");
  for (const x of [10, 19, 28, 37, 46]) p.vline(x, DBASE - Math.round(Math.sqrt(Math.max(0, (DR - 1) ** 2 - (x - DCX) ** 2))), DBASE - 1, C.steelL);
  p.hline(7, DW - 8, DBASE - 12, C.steelL).hline(14, DW - 15, DBASE - 21, C.steelL);
  p.rect(7, DBASE - 4, DW - 14, 4, SOIL.d).rect(7, DBASE - 4, DW - 14, 1, SOIL.m);
  p.rect(16, 10, 5, 1, C.glassL, 0.7).rect(11, 15, 3, 1, C.glassL, 0.6);
}

function domePlants(stage: number): (p: Painter) => void {
  return (p) => {
    const h = [0, 1, 3, 6, 10][stage];
    const y0 = DBASE - 4;
    for (let x = 11; x < DW - 8; x += 6) {
      if (h === 1) {
        p.px(x, y0 - 1, LEAF.m);
        continue;
      }
      p.rect(x, y0 - h, 1, h, LEAF.d);
      if (h >= 3) p.rect(x - 2, y0 - h, 2, 2, LEAF.m).rect(x + 1, y0 - h + 1, 2, 2, LEAF.l);
      if (h >= 6) p.rect(x - 2, y0 - h + 3, 5, 2, LEAF.m).rect(x - 1, y0 - h - 1, 3, 2, LEAF.l);
      if (h >= 10) p.rect(x - 1, y0 - h - 2, 3, 2, "#c75b6e");
    }
  };
}

function domeGlow(p: Painter): void {
  // Grow-light glow: soft bands inside the glass (rows of a half-disc).
  for (let y = DBASE - DR + 2; y < DBASE; y++) {
    const half = Math.floor(Math.sqrt(Math.max(0, (DR - 2) ** 2 - (DBASE - y) ** 2)));
    p.rect(DCX - half, y, half * 2, 1, "#ff9ad0", y > DBASE - 10 ? 0.24 : 0.12);
  }
}

function ladder(p: Painter): void {
  // The habitat's service ladder: rails and rungs from the lower floor up through the hatch.
  p.rect(0, 0, 2, 80, C.out).rect(12, 0, 2, 80, C.out);
  p.rect(0, 0, 1, 80, C.steelL).rect(12, 0, 1, 80, C.steelL);
  for (let y = 4; y < 80; y += 8) p.rect(2, y, 10, 2, C.out).rect(2, y, 10, 1, C.steel);
}

function telescope(on: boolean): (p: Painter) => void {
  return (p) => {
    p.rect(9, 14, 2, 10, C.out).rect(4, 22, 12, 2, C.out).rect(5, 23, 10, 1, C.steelD);
    // Tube tilted up toward the north sky.
    for (let i = 0; i < 12; i++) p.rect(2 + i, 14 - i, 4, 3, C.out);
    for (let i = 0; i < 11; i++) p.rect(3 + i, 14 - i, 2, 1, on ? C.steelL : C.steel);
    p.rect(14, 1, 4, 4, C.out).rect(15, 2, 2, 2, on ? C.glassL : C.steelDD);
    p.px(10, 18, on ? C.mint : C.red);
  };
}

function pipe(on: boolean): (p: Painter) => void {
  return (p) => {
    p.rect(0, 0, 16, 4, C.out).rect(0, 1, 16, 2, on ? C.water : C.steelD);
    if (on) p.rect(3, 1, 3, 1, C.glassL).rect(11, 2, 2, 1, C.glassL);
    p.rect(15, 0, 1, 4, C.steelDD);
  };
}

function wire(on: boolean): (p: Painter) => void {
  return (p) => {
    p.rect(0, 0, 16, 2, on ? "#d9a628" : C.steelDD);
    if (on) p.rect(6, 0, 3, 2, C.yellow);
  };
}

function ventStack(on: boolean): (p: Painter) => void {
  return (p) => {
    p.rect(2, 4, 8, 28, C.out).rect(3, 5, 6, 26, C.steel).rect(3, 5, 2, 26, C.steelL);
    p.rect(0, 0, 12, 5, C.out).rect(1, 1, 10, 3, C.steelD);
    p.rect(4, 20, 4, 4, C.out).rect(5, 21, 2, 2, on ? C.mint : C.red);
  };
}

function beaconMast(p: Painter): void {
  p.rect(3, 6, 2, 34, C.out).rect(3, 6, 1, 34, C.steelL);
  p.rect(0, 38, 8, 2, C.out);
  p.rect(1, 0, 6, 6, C.out).rect(2, 1, 4, 4, C.steelD);
}

function sign(text: string, symbol: "shield" | "arrow" | "none", bg: string): PropDef {
  const w = Math.max(24, textWidth(text) + (symbol === "none" ? 6 : 14));
  return {
    w,
    h: 14,
    draw: (p) => {
      box(p, 0, 0, w, 13, bg);
      const tx = symbol === "none" ? 3 : 11;
      drawText(p, text, tx, 4, C.out);
      if (symbol === "shield") p.rect(3, 3, 6, 5, C.out).rect(4, 4, 4, 3, C.yellow).rect(5, 8, 2, 2, C.out);
      if (symbol === "arrow") p.rect(5, 3, 1, 7, C.out).rect(3, 5, 5, 1, C.out).px(4, 4, C.out).px(6, 4, C.out);
    },
  };
}

// ---- Phase 5: habitat decorations (rewards that appear by themselves) ----
function decoShelf(p: Painter): void {
  p.rect(0, 10, 26, 3, C.out).rect(1, 11, 24, 1, C.steelL);
  p.rect(3, 5, 6, 5, C.out).rect(4, 6, 4, 3, "#b34a3a");
  p.rect(11, 4, 5, 6, C.out).rect(12, 5, 3, 4, "#3a3a46");
  p.rect(18, 6, 6, 4, C.out).rect(19, 7, 4, 2, "#e8e0d0");
}
function decoPatch(p: Painter): void {
  box(p, 0, 0, 16, 16, C.navy);
  p.rect(3, 3, 10, 10, "#e2483d").rect(4, 4, 8, 8, C.cream).rect(6, 5, 4, 2, "#e2483d").rect(5, 7, 6, 3, C.orange).px(7, 11, C.out).px(8, 11, C.out);
}
function decoRover(p: Painter): void {
  p.rect(2, 4, 14, 5, C.out).rect(3, 5, 12, 3, C.steelL).rect(9, 1, 2, 4, C.out).rect(10, 0, 3, 2, C.yellow);
  for (const x of [2, 7, 12]) p.rect(x, 9, 4, 4, C.out).rect(x + 1, 10, 2, 2, C.steel);
}
function decoPhoto(p: Painter): void {
  box(p, 0, 0, 14, 12, "#c99a5a");
  p.rect(2, 2, 10, 8, "#7ab6e0").rect(2, 7, 10, 3, "#c25d35").rect(5, 4, 3, 3, C.cream).px(6, 5, C.out);
}

export const BASE_PROPS: Record<string, PropDef> = {
  deco_shelf: { w: 26, h: 13, draw: decoShelf },
  deco_patch: { w: 16, h: 16, draw: decoPatch },
  deco_rover: { w: 18, h: 13, draw: decoRover },
  deco_photo: { w: 14, h: 12, draw: decoPhoto },
  recharge_dead: { w: 18, h: 27, draw: recharge("dead") },
  recharge_on: { w: 18, h: 27, draw: recharge("on") },
  recharge_charging: { w: 18, h: 27, draw: recharge("charging") },
  cargo_locker_closed: { w: 18, h: 20, draw: cargoLocker(false) },
  cargo_locker_open: { w: 18, h: 20, draw: cargoLocker(true) },
  base_terminal_off: { w: 18, h: 26, draw: baseTerminal(false) },
  base_terminal_on: { w: 18, h: 26, draw: baseTerminal(true) },
  probe_off: { w: 10, h: 23, draw: probe(false) },
  probe_on: { w: 10, h: 23, draw: probe(true) },
  shelter_monitor_off: { w: 18, h: 24, draw: shelterMonitor("off") },
  shelter_monitor_awake: { w: 18, h: 24, draw: shelterMonitor("awake") },
  shelter_monitor_ready: { w: 18, h: 24, draw: shelterMonitor("ready") },
  dist_console_off: { w: 22, h: 22, draw: distConsole("off") },
  dist_console_on: { w: 22, h: 22, draw: distConsole("on") },
  dist_console_alert: { w: 22, h: 22, draw: distConsole("alert") },
  sleeping_mat: { w: 28, h: 7, draw: mat },
  storage_closed: { w: 16, h: 26, draw: storageLocker(false) },
  storage_open: { w: 16, h: 26, draw: storageLocker(true) },
  wall_lamp_off: { w: 10, h: 7, draw: wallLamp(false) },
  wall_lamp_on: { w: 10, h: 7, draw: wallLamp(true) },
  status_light_off: { w: 8, h: 8, draw: statusLight(false) },
  status_light_on: { w: 8, h: 8, draw: statusLight(true) },
  pot_plant: { w: 12, h: 14, draw: potPlant },
  recycler_broken: { w: 32, h: 32, draw: recycler("broken") },
  recycler_off: { w: 32, h: 32, draw: recycler("off") },
  recycler_on0: { w: 32, h: 32, draw: recycler("on0") },
  recycler_on1: { w: 32, h: 32, draw: recycler("on1") },
  power_box_off: { w: 12, h: 16, draw: powerBox(false) },
  power_box_on: { w: 12, h: 16, draw: powerBox(true) },
  planter_dry: { w: 36, h: 20, draw: planter("dry") },
  planter_wet: { w: 36, h: 20, draw: planter("wet") },
  planter_seeds: { w: 36, h: 20, draw: planter("seeds") },
  planter_sprouts: { w: 36, h: 20, draw: planter("sprouts") },
  planter_small: { w: 36, h: 20, draw: planter("small") },
  planter_mature: { w: 36, h: 20, draw: planter("mature") },
  grow_lamp_off: { w: 40, h: 8, draw: growLamp(false) },
  grow_lamp_on: { w: 40, h: 8, draw: growLamp(true) },
  valve_closed: { w: 12, h: 13, draw: valve(false) },
  valve_open: { w: 12, h: 13, draw: valve(true) },
  water_proc_off: { w: 28, h: 32, draw: waterProcessor("off") },
  water_proc_on0: { w: 28, h: 32, draw: waterProcessor("on0") },
  water_proc_on1: { w: 28, h: 32, draw: waterProcessor("on1") },
  water_tank: { w: 20, h: 34, draw: tankFrame },
  seismometer_off: { w: 16, h: 16, draw: seismometer(false) },
  seismometer_on: { w: 16, h: 16, draw: seismometer(true) },
  deep_probe_off: { w: 14, h: 24, draw: deepProbe(false) },
  deep_probe_on: { w: 14, h: 24, draw: deepProbe(true) },
  greenhouse_dome: { w: DW, h: DBASE + 7, draw: greenhouseDome },
  dome_plants_1: { w: DW, h: DBASE + 7, draw: domePlants(1) },
  dome_plants_2: { w: DW, h: DBASE + 7, draw: domePlants(2) },
  dome_plants_3: { w: DW, h: DBASE + 7, draw: domePlants(3) },
  dome_plants_4: { w: DW, h: DBASE + 7, draw: domePlants(4) },
  dome_glow: { w: DW, h: DBASE + 7, draw: domeGlow },
  ladder: { w: 14, h: 80, draw: ladder },
  telescope_off: { w: 20, h: 24, draw: telescope(false) },
  telescope_on: { w: 20, h: 24, draw: telescope(true) },
  pipe_off: { w: 16, h: 4, draw: pipe(false) },
  pipe_on: { w: 16, h: 4, draw: pipe(true) },
  wire_off: { w: 16, h: 2, draw: wire(false) },
  wire_on: { w: 16, h: 2, draw: wire(true) },
  vent_stack_off: { w: 12, h: 32, draw: ventStack(false) },
  vent_stack_on: { w: 12, h: 32, draw: ventStack(true) },
  beacon_mast: { w: 8, h: 40, draw: beaconMast },
  sign_shelter: sign("SHELTER", "shield", C.yellow),
  sign_stairs: sign("UP", "arrow", C.cream),
  sign_life: sign("LIFE SUPPORT", "none", C.glass),
  sign_grow: sign("GROW ROOM", "none", "#b8e8a8"),
  sign_water: sign("WATER", "none", C.glass),
  sign_maint: sign("MAINTENANCE", "none", C.cream),
  sign_home: sign("HOME", "none", "#f2c9a0"),
};
