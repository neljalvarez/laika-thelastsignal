/** Parallax background layers, generated as 480-pixel-wide seamless strips. */
import { VIEW_H, VIEW_W } from "../config/constants";
import { C } from "./palette";
import { makeCanvas, Painter, rng } from "./painter";

export function drawSky(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(VIEW_W, VIEW_H);
  const p = new Painter(ctx);
  const bands = [C.sky0, C.sky1, C.sky2, C.sky3, C.sky4, C.sky5];
  const stops = [0, 46, 88, 124, 152, 176, VIEW_H];
  for (let i = 0; i < bands.length; i++) {
    const y0 = stops[i];
    const y1 = stops[i + 1];
    p.rect(0, y0, VIEW_W, y1 - y0, bands[i]);
    // Dithered seam into the next band.
    if (i < bands.length - 1) p.dither(0, y1 - 4, VIEW_W, 4, bands[i], bands[i + 1], 0.5);
  }
  const r = rng(42);
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(r() * VIEW_W);
    const y = Math.floor(r() * 80);
    const a = y < 40 ? 0.9 : 0.45;
    p.px(x, y, r() < 0.2 ? C.yellow : C.white, a * (0.4 + r() * 0.6));
  }
  // Small, pale Sun (Mars is farther from the Sun, so it looks smaller).
  p.disc(388, 132, 7, "#f6d6a0", 0.35).disc(388, 132, 5, "#fbe7c0", 0.8).disc(388, 132, 3, "#fff6e0");
  // Phobos: a lumpy little moon.
  p.disc(96, 36, 4, "#8e7a7a").rect(94, 33, 3, 2, "#a99191").px(98, 38, "#6e5c5e").px(93, 37, "#6e5c5e");
  return canvas;
}

/** A ridge line made of a few overlapping sine waves (seamless over the width). */
function ridge(x: number, waves: Array<[amp: number, period: number, phase: number]>): number {
  let y = 0;
  for (const [a, per, ph] of waves) y += a * Math.sin(((x / VIEW_W) * Math.PI * 2 * VIEW_W) / per + ph);
  return y;
}

export function drawFar(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(VIEW_W, VIEW_H);
  const p = new Painter(ctx);
  for (let x = 0; x < VIEW_W; x++) {
    // A broad shield volcano centred at x=150 plus rolling peaks.
    const d = (x - 150) / 120;
    const volcano = Math.abs(d) < 1 ? -34 * (1 - d * d) : 0;
    const y = Math.round(150 + volcano + ridge(x, [[6, 160, 0.5], [4, 96, 1.7], [2, 48, 0.2]]));
    p.rect(x, y, 1, VIEW_H - y, C.far);
    p.px(x, y, C.farL);
    if (Math.abs(d) < 1) p.px(x, y + 1, C.farL);
  }
  return canvas;
}

export function drawMid(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(VIEW_W, VIEW_H);
  const p = new Painter(ctx);
  const r = rng(7);
  // Flat-topped mesas and buttes.
  const mesas = [
    [10, 70, 160],
    [95, 40, 172],
    [170, 110, 150],
    [300, 60, 166],
    [380, 90, 156],
  ];
  const tops: number[] = [];
  for (let x = 0; x < VIEW_W; x++) {
    let y = 196 + Math.round(ridge(x, [[3, 120, 0.3], [2, 60, 1.1]]));
    for (const [mx, mw, top] of mesas) {
      const dx = (x - mx + VIEW_W) % VIEW_W;
      if (dx < mw) {
        const slope = Math.min(dx, mw - dx);
        y = Math.min(y, Math.max(top, 196 - slope * 2));
      }
    }
    tops.push(y);
    p.rect(x, y, 1, VIEW_H - y, C.mid);
    p.px(x, y, C.midL);
    if (r() < 0.3) p.px(x, y + 1, C.midL);
  }
  // Horizontal strata, only inside the rock (never in the sky).
  for (let y = 160; y < 214; y += 7) {
    for (let x = 0; x < VIEW_W; x++) if (y > tops[x] + 2 && r() < 0.5) p.px(x, y, C.midD);
  }
  return canvas;
}

export function drawNear(): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(VIEW_W, VIEW_H);
  const p = new Painter(ctx);
  const r = rng(11);
  for (let x = 0; x < VIEW_W; x++) {
    const y = Math.round(214 + ridge(x, [[5, 240, 0.0], [3, 120, 2.0], [1, 40, 0.7]]));
    p.rect(x, y, 1, VIEW_H - y, C.near);
    p.px(x, y, C.nearL);
    if (r() < 0.15) p.px(x, y - 1, C.nearL, 0.6);
  }
  for (let i = 0; i < 40; i++) p.px(Math.floor(r() * VIEW_W), 222 + Math.floor(r() * 40), C.soilL);
  return canvas;
}
