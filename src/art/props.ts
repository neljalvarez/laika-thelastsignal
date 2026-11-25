/**
 * Every world prop, drawn in code with the shared palette. Each entry produces one texture.
 * Machines have "_off" / "_on" (or similar) variants so restoring power visibly changes them.
 */
import { drawText, textWidth } from "./font";
import { C } from "./palette";
import { Painter, rng } from "./painter";

export interface PropDef {
  w: number;
  h: number;
  draw: (p: Painter) => void;
}

const outlineRect = (p: Painter, x: number, y: number, w: number, h: number, fill: string, edge: string = C.out) =>
  p.rect(x, y, w, h, edge).rect(x + 1, y + 1, w - 2, h - 2, fill);

// ---------------------------------------------------------------------------
// Spacecraft
// ---------------------------------------------------------------------------

function shipShell(p: Painter): void {
  const W = 336;
  const H = 160;
  // Rounded capsule body.
  p.rect(6, 0, W - 12, H, C.out).rect(2, 6, W - 4, H - 12, C.out).rect(0, 14, W, H - 28, C.out);
  p.rect(7, 1, W - 14, H - 2, C.hull).rect(3, 7, W - 6, H - 14, C.hull).rect(1, 15, W - 2, H - 30, C.hull);
  // Top highlight and belly shade.
  p.rect(8, 2, W - 16, 3, C.hullL).rect(8, 2, W - 16, 1, C.white);
  p.rect(4, H - 34, W - 8, 24, C.hullD).rect(8, H - 10, W - 16, 6, C.hullD);
  // Panel seams.
  for (let x = 40; x < W - 20; x += 48) p.rect(x, 6, 1, H - 40, C.hullD);
  p.rect(4, 44, W - 8, 1, C.hullD);
  // Red mission stripe.
  p.rect(1, 84, W - 2, 8, C.red).rect(1, 84, W - 2, 1, "#ff7a6e").rect(1, 91, W - 2, 1, C.redDark);
  // Lettering.
  drawText(p, "LAIKA-1", 30, 68, C.steelD);
  drawText(p, "MISSION 57", 30, 96, C.hullD);
  // Big porthole (matches the interior window position).
  const px = 232;
  p.disc(px, 54, 14, C.out).disc(px, 54, 12, C.steel).disc(px, 54, 9, C.glass).disc(px - 3, 50, 3, C.glassL);
  // Hatch outline on the right end.
  p.rect(W - 20, 76, 18, 52, C.out).rect(W - 18, 78, 14, 48, C.hullD).rect(W - 16, 80, 10, 44, C.hull);
  p.rect(W - 13, 98, 4, 6, C.yellow);
  // Rivets.
  const r = rng(5);
  for (let i = 0; i < 60; i++) p.px(10 + Math.floor(r() * (W - 20)), 8 + Math.floor(r() * (H - 20)), C.hullD);
  // Scorch marks from a hard landing.
  for (let i = 0; i < 220; i++) {
    const x = Math.floor(r() * W);
    const y = H - 40 + Math.floor(r() * 36);
    p.px(x, y, r() < 0.5 ? "#6a5a5a" : "#4e4246", 0.6);
  }
}

function shipEngine(p: Painter): void {
  // Engine bell at the rear of the ship.
  p.rect(10, 4, 22, 48, C.out).rect(11, 5, 20, 46, C.steel).rect(11, 5, 20, 3, C.steelL);
  for (let i = 0; i < 6; i++) p.rect(4 - Math.floor(i / 2), 10 + i * 6, 8 + Math.floor(i / 2), 5, C.steelD);
  p.rect(0, 8, 10, 40, C.out).rect(1, 9, 8, 38, C.steelD).rect(2, 12, 3, 32, "#5a3a30");
}

function shipAntenna(p: Painter): void {
  // A bent antenna dish on the roof: the reason the ship's radio cannot reach anyone.
  p.rect(18, 26, 3, 14, C.steel).rect(18, 26, 1, 14, C.steelL);
  p.rect(14, 38, 12, 2, C.steelD);
  for (let i = 0; i < 10; i++) p.px(19 + i, 26 - Math.floor(i * 0.7), C.steelD);
  // Dish hanging off at an angle.
  p.rect(26, 10, 10, 3, C.out).rect(24, 13, 14, 4, C.out).rect(25, 13, 12, 3, C.hull).rect(27, 11, 8, 2, C.hullL);
  p.px(31, 17, C.red);
}

function shipBed(p: Painter): void {
  p.rect(0, 6, 28, 6, C.out).rect(1, 7, 26, 4, C.steel);
  p.rect(2, 2, 24, 5, C.out).rect(3, 3, 22, 3, C.red).rect(3, 3, 22, 1, "#ff7a6e");
  p.rect(20, 1, 6, 4, C.out).rect(21, 2, 4, 2, C.cream);
  p.rect(2, 11, 2, 1, C.steelD).rect(24, 11, 2, 1, C.steelD);
}

function foodBowl(p: Painter): void {
  p.rect(0, 2, 14, 5, C.out).rect(1, 2, 12, 4, C.red).rect(2, 2, 10, 1, "#ff7a6e").rect(3, 1, 8, 1, C.out);
  drawText(p, "L", 6, 3, C.white);
}

function poster(p: Painter): void {
  outlineRect(p, 0, 0, 22, 18, C.cream);
  p.rect(2, 2, 18, 9, C.sky1).disc(14, 6, 3, C.red).px(13, 5, "#ff7a6e");
  p.disc(6, 8, 2, C.blueL).px(5, 7, C.white);
  for (let i = 0; i < 8; i++) p.px(7 + i, 8 - Math.floor(i / 2), C.yellow);
  drawText(p, "GO", 3, 12, C.red);
  p.rect(12, 13, 7, 1, C.steel).rect(12, 15, 5, 1, C.steel);
}

function shipWindow(p: Painter): void {
  // Porthole with the Martian landscape outside.
  p.disc(14, 14, 14, C.out).disc(14, 14, 12, C.steel).disc(14, 14, 10, C.sky4);
  p.rect(5, 6, 18, 4, C.sky3);
  p.rect(5, 15, 18, 3, C.mid).rect(4, 18, 20, 3, C.near).rect(5, 21, 18, 3, C.soil);
  p.rect(8, 13, 6, 2, C.mid).px(19, 9, C.yellow);
  p.disc(10, 10, 2, C.glassL, 0.5);
  for (const [x, y] of [
    [14, 1],
    [27, 14],
    [14, 27],
    [1, 14],
  ])
    p.px(x, y, C.steelD);
}

function radio(on: boolean): (p: Painter) => void {
  return (p) => {
    outlineRect(p, 0, 6, 22, 20, C.steel);
    p.rect(1, 7, 20, 2, C.steelL);
    outlineRect(p, 3, 9, 12, 9, C.navy);
    if (on) {
      // Static on the screen.
      const r = rng(9);
      for (let i = 0; i < 28; i++) p.px(4 + Math.floor(r() * 10), 10 + Math.floor(r() * 7), r() < 0.5 ? C.glass : C.steelL);
    } else {
      p.rect(4, 13, 10, 1, C.green);
    }
    p.disc(18, 12, 2, C.steelD).px(18, 12, C.steelL);
    p.rect(16, 18, 4, 2, on ? C.red : C.out);
    p.rect(4, 20, 3, 3, C.steelD).rect(9, 20, 3, 3, C.steelD);
    // Antenna stub.
    p.rect(17, 0, 1, 7, C.steelD).px(17, 0, C.red);
  };
}

// ---------------------------------------------------------------------------
// Outpost machines
// ---------------------------------------------------------------------------

function checkpoint(active: boolean): (p: Painter) => void {
  return (p) => {
    p.rect(5, 6, 3, 24, C.out).rect(6, 7, 1, 22, C.steelL);
    p.rect(1, 27, 11, 3, C.out).rect(2, 28, 9, 1, C.steel);
    if (active) {
      // Extended antenna with a solid light and a little pennant.
      p.rect(5, 0, 3, 7, C.out).rect(6, 1, 1, 6, C.steelL);
      p.disc(6, 6, 3, C.out).disc(6, 6, 2, C.mint).px(5, 5, C.white);
      p.rect(8, 9, 5, 4, C.out).rect(8, 10, 4, 2, C.yellow);
    } else {
      // Hollow, dim light.
      p.disc(6, 8, 3, C.out).disc(6, 8, 2, C.steelD).px(6, 8, C.out);
    }
  };
}

function solarControl(repaired: boolean): (p: Painter) => void {
  return (p) => {
    p.rect(6, 10, 3, 18, C.out).rect(7, 11, 1, 16, C.steelL);
    outlineRect(p, 0, 0, 15, 13, C.steel);
    outlineRect(p, 2, 2, 11, 6, C.navy);
    if (repaired) {
      p.rect(3, 4, 9, 1, C.mint).rect(3, 6, 6, 1, C.mint);
      p.rect(11, 9, 2, 2, C.mint);
    } else {
      p.rect(3, 4, 4, 1, C.red);
      p.rect(11, 9, 2, 2, C.red);
      // Open panel with loose wires.
      p.rect(1, 9, 5, 4, C.steelD).px(2, 13, C.yellow).px(3, 14, C.red).px(4, 13, C.blueL);
    }
    p.rect(3, 26, 9, 2, C.out);
  };
}

function solarPanel(clean: boolean): (p: Painter) => void {
  return (p) => {
    const W = 38;
    // Tilted panel: 3 stepped rows like the original game's panels.
    for (let i = 0; i < 3; i++) {
      const x = 2 + (2 - i) * 2;
      const y = 2 + i * 5;
      p.rect(x - 1, y - 1, W - 6, 6, C.out);
      p.rect(x, y, W - 8, 4, clean ? C.blue : "#9a6a4a");
      p.rect(x, y, W - 8, 1, clean ? C.blueL : "#c08a5a");
      for (let cx = x + 7; cx < x + W - 8; cx += 8) p.rect(cx, y, 1, 4, clean ? C.blueL : "#b07a52");
      if (!clean) {
        const r = rng(30 + i);
        for (let k = 0; k < 18; k++) p.px(x + Math.floor(r() * (W - 8)), y + Math.floor(r() * 4), r() < 0.5 ? C.dust : "#a06a40");
      }
    }
    p.rect(3, 17, W - 8, 1, clean ? C.yellow : C.steelL);
    p.rect(16, 18, 3, 10, C.out).rect(17, 18, 1, 10, C.steel);
    p.rect(11, 27, 14, 2, C.out).rect(12, 27, 12, 1, C.steelD);
  };
}

function battery(on: boolean): (p: Painter) => void {
  return (p) => {
    outlineRect(p, 0, 4, 32, 26, C.steel);
    p.rect(1, 5, 30, 2, C.steelL);
    p.rect(8, 0, 16, 5, C.out).rect(9, 1, 14, 3, C.steelD);
    outlineRect(p, 4, 9, 14, 17, C.navy);
    for (let i = 0; i < 4; i++) {
      const lit = on ? i < 4 : i === 0;
      p.rect(6, 22 - i * 4, 10, 3, lit ? (on ? C.mint : C.red) : C.steelD);
    }
    // Lightning glyph.
    p.rect(23, 11, 3, 2, C.yellow).rect(22, 13, 3, 2, C.yellow).rect(21, 15, 6, 2, C.yellow).rect(23, 17, 3, 2, C.yellow).rect(22, 19, 2, 2, C.yellow);
    p.rect(20, 24, 9, 2, C.steelD);
  };
}

function habitat(on: boolean): (p: Painter) => void {
  return (p) => {
    const W = 112;
    const H = 66;
    p.dome(56, H - 6, 52, C.out).dome(56, H - 6, 51, C.cream);
    // Panel ribs.
    for (const x of [22, 40, 56, 72, 90]) p.rect(x, 18, 1, H - 24, C.creamShade);
    p.rect(8, H - 20, W - 16, 4, C.red).rect(8, H - 20, W - 16, 1, "#ff7a6e");
    p.rect(6, H - 16, W - 12, 10, C.creamShade);
    // Highlights.
    p.rect(30, 14, 12, 1, C.white).rect(24, 17, 4, 1, C.white).rect(20, 21, 2, 2, C.white);
    // Windows.
    for (const x of [18, 88]) {
      p.rect(x, H - 31, 10, 7, C.out).rect(x + 1, H - 30, 8, 5, on ? C.yellow : C.steelD);
      if (on) p.rect(x + 1, H - 30, 3, 1, C.white);
    }
    // Airlock door.
    p.rect(48, H - 30, 17, 24, C.out).rect(49, H - 29, 15, 23, C.steelL).rect(51, H - 27, 11, 6, on ? C.blueL : C.steelD);
    p.rect(60, H - 17, 2, 2, on ? C.mint : C.red);
    // Base ring.
    p.rect(2, H - 6, W - 4, 4, C.out).rect(3, H - 6, W - 6, 2, C.steel).rect(3, H - 6, W - 6, 1, C.steelL);
    // Roof antenna.
    p.rect(55, 0, 2, 9, C.steel).rect(52, 0, 8, 1, C.steelL).px(56, 0, on ? C.red : C.steelD);
    drawText(p, "HAB-1", 46, H - 40, C.creamShade);
  };
}

function receiver(on: boolean): (p: Painter) => void {
  return (p) => {
    // Lattice mast.
    p.rect(20, 30, 6, 56, C.out).rect(21, 30, 4, 56, C.steel);
    for (let y = 32; y < 84; y += 6) {
      p.px(21, y, C.steelD).px(22, y + 1, C.steelD).px(23, y + 2, C.steelD).px(24, y + 3, C.steelD);
    }
    p.rect(14, 84, 18, 4, C.out).rect(15, 84, 16, 2, C.steelD);
    // Big dish, facing up-right.
    const tilt = on ? 0 : 4;
    for (let i = 0; i < 12; i++) {
      const w = 34 - Math.abs(i - 6) * 3;
      p.rect(23 - w / 2 + i * 0.6, 4 + i * 2 + tilt, w, 2, i < 1 || i > 10 ? C.out : i < 6 ? C.hullL : C.hull);
    }
    p.rect(22, 12 + tilt, 2, 16, C.steelD);
    p.rect(30, 2 + tilt, 2, 10, C.steelL).disc(31, 2 + tilt, 2, on ? C.red : C.steelD);
    // Electronics box with an open slot for the comms module.
    outlineRect(p, 6, 52, 34, 20, C.steel);
    outlineRect(p, 10, 56, 14, 12, on ? C.navy : C.steelDD);
    if (on) {
      p.rect(12, 60, 10, 1, C.mint).rect(12, 63, 7, 1, C.mint).rect(12, 58, 4, 1, C.glass);
    }
    p.rect(28, 56, 8, 3, on ? C.mint : C.red).rect(28, 62, 8, 3, on ? C.yellow : C.steelD);
  };
}

function receiverModule(p: Painter): void {
  // Installed comms module (drawn on top of the receiver box).
  p.rect(0, 0, 14, 12, C.out).rect(1, 1, 12, 10, C.steelL).rect(2, 3, 10, 5, C.blue).rect(3, 4, 2, 1, C.blueL).rect(8, 5, 3, 1, C.blueL);
  p.rect(2, 9, 2, 1, C.yellow).rect(5, 9, 2, 1, C.red);
}

function workstation(on: boolean): (p: Painter) => void {
  return (p) => {
    // Bench.
    p.rect(0, 16, 44, 4, C.out).rect(1, 17, 42, 2, C.steel).rect(1, 17, 42, 1, C.steelL);
    p.rect(3, 20, 3, 12, C.out).rect(38, 20, 3, 12, C.out).rect(4, 20, 1, 12, C.steelL).rect(39, 20, 1, 12, C.steelL);
    // Fabricator arm.
    p.rect(30, 2, 3, 15, C.out).rect(31, 3, 1, 13, C.steelL);
    p.rect(20, 1, 13, 3, C.out).rect(21, 2, 11, 1, C.steelL);
    p.rect(19, 3, 3, 6, C.out).rect(20, 4, 1, 4, C.steelL).rect(18, 9, 5, 2, on ? C.yellow : C.steelD);
    // Monitor.
    outlineRect(p, 2, 3, 15, 12, C.steelD);
    outlineRect(p, 4, 5, 11, 7, on ? C.navy : C.steelDD);
    if (on) p.rect(5, 7, 6, 1, C.mint).rect(5, 9, 8, 1, C.glass).px(12, 7, C.yellow);
    // Tools on the bench.
    p.rect(22, 13, 6, 3, C.red).rect(35, 14, 4, 2, C.yellow);
  };
}

function lamp(on: boolean): (p: Painter) => void {
  return (p) => {
    p.rect(3, 4, 2, 26, C.out).rect(3, 4, 1, 26, C.steelL);
    p.rect(0, 0, 8, 5, C.out).rect(1, 1, 6, 3, on ? C.yellow : C.steelD);
    if (on) p.rect(2, 1, 2, 1, C.white);
    p.rect(1, 29, 6, 2, C.out);
  };
}

function cable(on: boolean): (p: Painter) => void {
  return (p) => {
    p.rect(0, 1, 16, 2, C.out).rect(0, 1, 16, 1, C.steelD);
    if (on) p.px(4, 1, C.yellow).px(12, 1, C.yellow);
  };
}

function sign(kind: "outpost" | "canyon" | "warn"): (p: Painter) => void {
  return (p) => {
    p.rect(13, 12, 3, 18, C.out).rect(14, 12, 1, 18, C.steelL);
    const fill = kind === "warn" ? C.yellow : C.cream;
    outlineRect(p, 0, 0, 30, 14, fill);
    if (kind === "outpost") {
      drawText(p, "ARES", 15 - Math.floor(textWidth("ARES") / 2), 2, C.red);
      drawText(p, "BASE", 15 - Math.floor(textWidth("BASE") / 2), 8, C.steelD);
    } else if (kind === "canyon") {
      drawText(p, "CANYON", 3, 2, C.redDark);
      p.rect(9, 9, 10, 1, C.steelD).px(18, 8, C.steelD).px(18, 10, C.steelD).px(17, 7, C.steelD).px(17, 11, C.steelD);
    } else {
      for (let i = 0; i < 30; i += 6) p.rect(1 + i, 1, 3, 12, C.out, 0.25);
      drawText(p, "!", 13, 4, C.out);
    }
  };
}

function terminal(on: boolean): (p: Painter) => void {
  return (p) => {
    p.rect(6, 12, 4, 12, C.out).rect(7, 12, 2, 12, C.steel);
    outlineRect(p, 0, 0, 16, 13, C.steelD);
    outlineRect(p, 2, 2, 12, 8, on ? C.navy : C.steelDD);
    if (on) p.rect(3, 4, 7, 1, C.mint).rect(3, 6, 9, 1, C.glass).rect(3, 8, 5, 1, C.mint);
    p.rect(2, 22, 12, 2, C.out);
  };
}

// ---------------------------------------------------------------------------
// Canyon
// ---------------------------------------------------------------------------

function rover(p: Painter): void {
  // Rover R-2, tipped onto one side, a wheel lying loose.
  outlineRect(p, 6, 10, 46, 14, C.hull);
  p.rect(7, 11, 44, 2, C.hullL).rect(7, 20, 44, 3, C.hullD);
  p.rect(8, 15, 40, 2, C.red);
  drawText(p, "R-2", 10, 12, C.steelD);
  // Mast and camera head.
  p.rect(40, 0, 3, 11, C.out).rect(41, 1, 1, 10, C.steelL);
  outlineRect(p, 36, -1, 12, 6, C.steel);
  p.rect(44, 1, 2, 2, C.navy).px(45, 1, C.glass);
  // Solar deck (dusty).
  p.rect(4, 8, 36, 3, C.out).rect(5, 8, 34, 2, "#9a6a4a");
  // Wheels.
  for (const x of [10, 26, 44]) {
    p.disc(x, 27, 5, C.out).disc(x, 27, 4, C.steelD).disc(x, 27, 2, C.steel).px(x, 27, C.out);
  }
  // Loose wheel.
  p.disc(60, 31, 4, C.out).disc(60, 31, 3, C.steelD).px(60, 31, C.steel);
  // Wheel tracks in the dust.
  for (let i = 0; i < 6; i++) p.rect(-2 + i * 2, 34, 1, 1, C.soilD);
}

function mound(revealed: boolean): (p: Painter) => void {
  return (p) => {
    // Disturbed soil: a low lumpy mound with a few darker clods.
    p.rect(2, 6, 14, 2, C.soilD).rect(4, 4, 10, 2, C.soil).rect(6, 3, 6, 1, C.soilL);
    p.px(5, 5, C.pebble).px(11, 4, C.pebble).px(13, 6, C.pebble).px(3, 7, C.soilL);
    if (revealed) {
      p.px(8, 1, C.yellow).px(7, 2, C.yellow).px(9, 2, C.yellow).px(8, 3, C.white);
      p.px(13, 1, C.white);
    }
  };
}

function bridgeControl(on: boolean): (p: Painter) => void {
  return (p) => {
    p.rect(7, 12, 3, 18, C.out).rect(8, 12, 1, 18, C.steelL);
    outlineRect(p, 0, 0, 17, 14, C.yellow);
    for (let i = 0; i < 17; i += 4) p.rect(i, 12, 2, 2, C.out);
    outlineRect(p, 3, 3, 11, 6, on ? C.navy : C.steelDD);
    if (on) p.rect(4, 5, 4, 2, C.mint).rect(9, 5, 4, 2, C.mint);
    else p.rect(4, 5, 4, 2, C.red);
    p.rect(3, 28, 11, 2, C.out);
  };
}

function spire(p: Painter): void {
  // The Red Spire: a tall eroded rock pillar seen behind the canyon.
  const r = rng(77);
  const W = 64;
  const H = 200;
  for (let y = 0; y < H; y++) {
    const t = y / H;
    const half = Math.round(10 + t * t * 22 + Math.sin(y * 0.15) * 2 + (y < 18 ? 4 : 0));
    const cx = 32 + Math.round(Math.sin(y * 0.04) * 3);
    p.rect(cx - half, y, half * 2, 1, "#6a2630");
    p.rect(cx - half, y, 2, 1, "#82303a");
    p.rect(cx + half - 3, y, 3, 1, "#521c26");
  }
  for (let y = 10; y < H; y += 9) for (let x = 0; x < W; x++) if (r() < 0.25) p.px(x, y, "#5a2028", 0.8);
}

function warnSign(p: Painter): void {
  sign("warn")(p);
}

// ---------------------------------------------------------------------------
// Research station
// ---------------------------------------------------------------------------

function stationShell(p: Painter): void {
  const W = 320;
  const H = 176;
  const wall = "#7f8ea0";
  const wallL = "#a3b1c2";
  const wallD = "#5a6878";
  p.rect(0, 10, W, H - 10, C.out).rect(1, 11, W - 2, H - 12, wall);
  // Curved roof.
  for (let i = 0; i < 12; i++) p.rect(8 - Math.floor(i / 2) + i, i, W - 16 + Math.floor(i / 2) * 2 - i * 2, 1, i === 0 ? C.out : wallL);
  p.rect(1, 11, W - 2, 3, wallL);
  for (let x = 32; x < W; x += 40) p.rect(x, 14, 1, H - 20, wallD);
  // Orange band and lettering.
  p.rect(1, 60, W - 2, 10, C.orange).rect(1, 60, W - 2, 1, C.yellow).rect(1, 69, W - 2, 1, "#a8602a");
  drawText(p, "ARES RESEARCH STATION", 90, 62, C.out);
  // Windows (dark: nobody home).
  for (const x of [40, 120, 200, 260]) {
    p.rect(x, 30, 26, 16, C.out).rect(x + 1, 31, 24, 14, C.navy).rect(x + 2, 32, 8, 2, "#2c3a5a");
  }
  // Door frame on the west wall (the door itself is a tile).
  p.rect(0, H - 52, 6, 52, C.out).rect(1, H - 50, 4, 48, C.yellow);
  // Dust drifts at the base.
  const r = rng(3);
  for (let x = 0; x < W; x++) {
    const h = 4 + Math.floor(Math.sin(x * 0.05) * 3 + r() * 3);
    p.rect(x, H - h, 1, h, x % 3 === 0 ? C.soilL : C.soil);
  }
  for (let i = 0; i < 40; i++) p.px(Math.floor(r() * W), 14 + Math.floor(r() * 40), wallD);
}

function stationDish(p: Painter): void {
  p.rect(30, 30, 4, 22, C.out).rect(31, 30, 2, 22, C.steelL);
  for (let i = 0; i < 12; i++) {
    const w = 56 - Math.abs(i - 6) * 5;
    p.rect(32 - w / 2, 6 + i * 2, w, 2, i === 0 || i === 11 ? C.out : i < 6 ? C.hullL : C.hull);
  }
  p.rect(31, 0, 2, 14, C.steelD).disc(32, 0, 2, C.red);
}

function beacon(on: boolean): (p: Painter) => void {
  return (p) => {
    outlineRect(p, 2, 18, 30, 30, C.steelD);
    outlineRect(p, 5, 21, 24, 14, on ? C.navy : C.steelDD);
    if (on) {
      // Signal waveform.
      for (let x = 0; x < 22; x++) p.px(6 + x, 28 + Math.round(Math.sin(x * 0.9) * 3), C.mint);
    } else {
      p.rect(6, 28, 22, 1, C.steel);
    }
    p.rect(6, 39, 6, 4, C.red).rect(14, 39, 6, 4, C.yellow).rect(22, 39, 6, 4, C.blue);
    // Antenna ring on top.
    p.rect(16, 6, 2, 13, C.out).disc(17, 6, 6, C.out).disc(17, 6, 4, on ? C.mint : C.steel).disc(17, 6, 2, C.out);
  };
}

function shelf(p: Painter): void {
  outlineRect(p, 0, 0, 24, 30, "#5a6878");
  for (const y of [9, 18]) p.rect(1, y, 22, 2, C.out);
  p.rect(3, 3, 4, 6, C.red).rect(8, 4, 3, 5, C.blueL).rect(13, 12, 6, 6, C.yellow).rect(4, 21, 8, 7, C.steelL).rect(15, 23, 5, 5, C.mint);
}

function desk(p: Painter): void {
  p.rect(0, 6, 30, 3, C.out).rect(1, 6, 28, 2, "#8a6a4a");
  p.rect(2, 9, 3, 9, C.out).rect(25, 9, 3, 9, C.out);
  outlineRect(p, 6, 0, 10, 7, C.steelD);
  p.rect(18, 3, 6, 3, C.cream).rect(19, 4, 4, 1, C.steelL);
}

function plant(p: Painter): void {
  // A dried-out experiment plant: nobody has watered it in a long time.
  p.rect(2, 10, 8, 6, C.out).rect(3, 10, 6, 5, C.red);
  p.vline(6, 2, 10, "#7a6a3a").px(5, 4, "#9a8a4a").px(4, 3, "#9a8a4a").px(7, 6, "#9a8a4a").px(8, 5, "#9a8a4a");
}

function locker(p: Painter): void {
  outlineRect(p, 0, 0, 14, 30, C.steel);
  p.rect(6, 1, 1, 28, C.steelD).rect(3, 12, 2, 3, C.steelD).rect(9, 12, 2, 3, C.steelD);
  p.rect(2, 3, 3, 1, C.steelD).rect(9, 3, 3, 1, C.steelD);
}

// ---------------------------------------------------------------------------
// Small decor and effects
// ---------------------------------------------------------------------------

function rock(size: "s" | "m" | "l", seed: number): (p: Painter) => void {
  return (p) => {
    const r = rng(seed);
    const [w, h] = size === "s" ? [10, 6] : size === "m" ? [18, 10] : [30, 16];
    for (let x = 0; x < w; x++) {
      const t = x / (w - 1);
      const top = Math.round(h * (0.25 + 0.75 * Math.pow(2 * Math.abs(t - 0.45), 1.8))) + Math.floor(r() * 2);
      p.rect(x, top, 1, h - top, C.rock);
      p.px(x, top, x < w * 0.5 ? C.rockL : C.strata);
      p.px(x, h - 1, C.rockDD);
    }
    p.rect(Math.floor(w * 0.6), Math.floor(h * 0.4), Math.max(1, Math.floor(w * 0.2)), Math.max(1, Math.floor(h * 0.4)), C.rockD);
  };
}

function crystal(p: Painter): void {
  p.rect(2, 1, 2, 7, "#6fe0d0").px(2, 0, C.white).rect(0, 4, 2, 4, "#3fb0a8").rect(4, 3, 2, 5, "#3fb0a8").px(4, 3, "#b8fff4");
}

function glow(p: Painter): void {
  // Dithered soft glow (drawn with additive blending in game).
  for (let r = 15; r > 0; r -= 1) p.disc(16, 16, r, "#ffffff", 0.035 + (15 - r) * 0.004);
}

function arrow(p: Painter): void {
  // Chevron pointing right (rotated in game).
  p.rect(0, 0, 3, 2, C.out);
  for (let i = 0; i < 4; i++) {
    p.rect(i, i, 3, 1, C.white);
    p.rect(i, 7 - i, 3, 1, C.white);
  }
}

function marker(p: Painter): void {
  // Down-pointing interaction marker.
  p.rect(0, 0, 9, 2, C.out).rect(1, 2, 7, 1, C.out).rect(2, 3, 5, 1, C.out).rect(3, 4, 3, 1, C.out).rect(4, 5, 1, 1, C.out);
  p.rect(1, 0, 7, 1, C.white).rect(2, 1, 5, 1, C.white).rect(3, 2, 3, 1, C.white).rect(4, 3, 1, 1, C.white);
}

function dot(color: string, size: number): (p: Painter) => void {
  return (p) => {
    p.rect(0, 0, size, size, color);
  };
}

export const PROPS: Record<string, PropDef> = {
  ship_shell: { w: 336, h: 160, draw: shipShell },
  ship_engine: { w: 34, h: 56, draw: shipEngine },
  ship_antenna: { w: 40, h: 42, draw: shipAntenna },
  ship_bed: { w: 28, h: 12, draw: shipBed },
  food_bowl: { w: 14, h: 7, draw: foodBowl },
  poster: { w: 22, h: 18, draw: poster },
  ship_window: { w: 29, h: 29, draw: shipWindow },
  radio_off: { w: 22, h: 26, draw: radio(false) },
  radio_on: { w: 22, h: 26, draw: radio(true) },
  checkpoint_off: { w: 13, h: 30, draw: checkpoint(false) },
  checkpoint_on: { w: 13, h: 30, draw: checkpoint(true) },
  solar_control_broken: { w: 15, h: 28, draw: solarControl(false) },
  solar_control_ok: { w: 15, h: 28, draw: solarControl(true) },
  panel_dusty: { w: 38, h: 29, draw: solarPanel(false) },
  panel_clean: { w: 38, h: 29, draw: solarPanel(true) },
  battery_off: { w: 32, h: 30, draw: battery(false) },
  battery_on: { w: 32, h: 30, draw: battery(true) },
  habitat_off: { w: 112, h: 66, draw: habitat(false) },
  habitat_on: { w: 112, h: 66, draw: habitat(true) },
  receiver_off: { w: 46, h: 88, draw: receiver(false) },
  receiver_on: { w: 46, h: 88, draw: receiver(true) },
  receiver_module: { w: 14, h: 12, draw: receiverModule },
  workstation_off: { w: 44, h: 32, draw: workstation(false) },
  workstation_on: { w: 44, h: 32, draw: workstation(true) },
  lamp_off: { w: 8, h: 31, draw: lamp(false) },
  lamp_on: { w: 8, h: 31, draw: lamp(true) },
  cable_off: { w: 16, h: 4, draw: cable(false) },
  cable_on: { w: 16, h: 4, draw: cable(true) },
  sign_outpost: { w: 30, h: 30, draw: sign("outpost") },
  sign_canyon: { w: 30, h: 30, draw: sign("canyon") },
  sign_warn: { w: 30, h: 30, draw: warnSign },
  terminal_off: { w: 16, h: 24, draw: terminal(false) },
  terminal_on: { w: 16, h: 24, draw: terminal(true) },
  rover: { w: 66, h: 36, draw: rover },
  mound: { w: 18, h: 8, draw: mound(false) },
  mound_revealed: { w: 18, h: 8, draw: mound(true) },
  bridge_control_off: { w: 17, h: 30, draw: bridgeControl(false) },
  bridge_control_on: { w: 17, h: 30, draw: bridgeControl(true) },
  spire: { w: 64, h: 200, draw: spire },
  station_shell: { w: 320, h: 176, draw: stationShell },
  station_dish: { w: 64, h: 52, draw: stationDish },
  beacon_off: { w: 34, h: 48, draw: beacon(false) },
  beacon_on: { w: 34, h: 48, draw: beacon(true) },
  shelf: { w: 24, h: 30, draw: shelf },
  desk: { w: 30, h: 18, draw: desk },
  plant: { w: 12, h: 16, draw: plant },
  locker: { w: 14, h: 30, draw: locker },
  rock_s: { w: 10, h: 6, draw: rock("s", 1) },
  rock_m: { w: 18, h: 10, draw: rock("m", 2) },
  rock_l: { w: 30, h: 16, draw: rock("l", 3) },
  crystal: { w: 6, h: 8, draw: crystal },
  glow: { w: 32, h: 32, draw: glow },
  arrow: { w: 7, h: 8, draw: arrow },
  marker: { w: 9, h: 6, draw: marker },
  px_dust: { w: 1, h: 1, draw: dot(C.dust, 1) },
  px_soil: { w: 2, h: 2, draw: dot(C.soilL, 2) },
  px_spark: { w: 1, h: 1, draw: dot(C.yellow, 1) },
  px_white: { w: 2, h: 2, draw: dot(C.white, 2) },
  px_thrust: { w: 2, h: 2, draw: dot(C.orange, 2) },
};
