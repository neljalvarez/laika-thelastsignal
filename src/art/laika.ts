/**
 * Laika, side view, composed from parts so every frame stays on-model:
 *   helmet + head (11x11), torso (with an optional spine tilt), tail, and four legs.
 *
 * Phase 2 rebuilt the animation set using quadruped locomotion principles: the legs are two
 * pairs of "biped" legs, each hind leg follows one step behind the fore leg of the opposite
 * side, and every leg travels the same distance per cycle. Walk, trot and gallop are generated
 * from leg phases, so they stay consistent and are easy to retime.
 *
 * Colours and costume (bubble helmet, brown ears, orange and cream fur, white suit with red trim,
 * steel backpack) match the original game's front-view sprite. The hitbox never changes with
 * the pose: every frame shares the same 26 x 22 canvas and the same paw line (row 20).
 */
import { blank, outline, patch, stamp, type Grid } from "./painter";

export const LAIKA_W = 26;
export const LAIKA_H = 22;
const PAW_ROW = 20;

const HEAD: Grid = [
  "...HHHHH...",
  ".HHGGGGGHH.",
  ".HGBBGGLGH.",
  "HGGBBGGGLGH",
  "HGOBOOOGGGH",
  "HGOOOONOGGH",
  "HGOOOOWWWNH",
  "HGGOWWWWWGH",
  ".HGOOWWWGH.",
  ".HHGGGGGHH.",
  "...HHHHH...",
];

export type Face =
  | "normal"
  | "blink"
  | "happy"
  | "sniffA"
  | "sniffB"
  | "earsUp"
  | "tilt"
  | "sleep"
  | "worried"
  | "alert"
  | "earTwitch"
  | "bark"
  | "lookBack";

function head(face: Face): { grid: Grid; flip: boolean } {
  const p = (patches: Array<[number, number, string]>) => ({ grid: patch(HEAD, patches), flip: false });
  switch (face) {
    case "normal":
      return { grid: HEAD, flip: false };
    case "blink":
      return p([[5, 6, "B"]]);
    case "happy":
      return p([
        [5, 6, "N"],
        [7, 7, "NP"],
        [8, 6, "PP"],
      ]);
    case "bark":
      return p([
        [5, 6, "N"],
        [6, 9, "N"],
        [7, 7, "NNN"],
        [8, 6, "PPN"],
        [1, 3, "BB"],
        [2, 3, "BB"],
      ]);
    case "sniffA":
      return p([
        [6, 9, "W"],
        [5, 9, "N"],
        [5, 6, "B"],
      ]);
    case "sniffB":
      return p([[5, 6, "B"]]);
    case "earsUp":
      return p([
        [1, 3, "BB"],
        [2, 3, "BB"],
        [3, 3, "GB"],
      ]);
    case "alert":
      return p([
        [1, 3, "BB"],
        [2, 3, "BB"],
        [3, 3, "GB"],
        [4, 6, "N"],
      ]);
    case "earTwitch":
      return p([
        [2, 3, "BG"],
        [2, 5, "B"],
      ]);
    case "tilt":
      return p([
        [2, 3, "GG"],
        [3, 3, "GG"],
        [4, 2, "BB"],
        [5, 2, "B"],
        [4, 6, "N"],
        [5, 6, "O"],
      ]);
    case "sleep":
      return p([
        [5, 6, "B"],
        [2, 3, "GG"],
        [3, 3, "GG"],
        [4, 2, "BB"],
        [5, 2, "B"],
      ]);
    case "worried":
      return p([
        [2, 3, "GG"],
        [3, 3, "GB"],
        [4, 2, "B"],
      ]);
    case "lookBack":
      // Looking back over her shoulder: the head is mirrored.
      return { grid: HEAD, flip: true };
  }
}

function mirror(g: Grid): Grid {
  return g.map((r) => r.split("").reverse().join(""));
}

export type Tail = "up" | "mid" | "down" | "high" | "sweepA" | "sweepB" | "sweepC" | "rest" | "floor" | "wagL" | "wagR";

/** Tail pixels relative to the rear of the torso (row 0 = torso top, col 0 = tail base column). */
const TAILS: Record<Tail, Array<[number, number, string]>> = {
  up: [
    [0, 0, "O"],
    [-1, -1, "O"],
    [-2, -1, "O"],
    [-3, -2, "WW"],
  ],
  mid: [
    [0, -1, "OO"],
    [-1, -2, "O"],
    [-2, -2, "W"],
  ],
  down: [
    [1, 0, "O"],
    [2, -1, "O"],
    [3, -2, "W"],
  ],
  high: [
    [-1, 0, "O"],
    [-2, 0, "O"],
    [-3, -1, "O"],
    [-4, -1, "WW"],
  ],
  wagL: [
    [0, 0, "O"],
    [-1, -1, "O"],
    [-2, -2, "O"],
    [-3, -3, "W"],
  ],
  wagR: [
    [0, 0, "O"],
    [-1, 0, "O"],
    [-2, 0, "O"],
    [-3, 0, "W"],
  ],
  sweepA: [
    [2, -1, "OO"],
    [3, -2, "O"],
    [4, -3, "W"],
  ],
  sweepB: [
    [0, -1, "OO"],
    [-1, -2, "OO"],
    [-2, -3, "W"],
  ],
  sweepC: [
    [1, -1, "OOO"],
    [1, -3, "W"],
  ],
  rest: [
    [4, -1, "OO"],
    [4, -2, "W"],
  ],
  floor: [
    [3, -1, "O"],
    [4, -2, "OO"],
    [4, -4, "WW"],
  ],
};

export interface Leg {
  dx: number;
  lift: number;
}
export interface Legs {
  nh: Leg; // near hind
  fh: Leg; // far hind
  nf: Leg; // near fore
  ff: Leg; // far fore
}
const L = (dx = 0, lift = 0): Leg => ({ dx, lift });
const STAND: Legs = { nh: L(), fh: L(), nf: L(), ff: L() };

export interface Pose {
  face: Face;
  tail: Tail;
  legs: Legs;
  /** Whole-body vertical offset (negative = up). */
  body: number;
  /** Spine tilt: positive lowers the rear (sitting), negative raises it (play bow, digging). */
  tilt: number;
  /** Head offset relative to the body. */
  hx: number;
  hy: number;
  sensor: "Z" | "E";
}

const P = (face: Face, tail: Tail, legs: Legs, o: Partial<Omit<Pose, "face" | "tail" | "legs">> = {}): Pose => ({
  face,
  tail,
  legs,
  body: 0,
  tilt: 0,
  hx: 0,
  hy: 0,
  sensor: "Z",
  ...o,
});

function compose(p: Pose, boots: boolean): Grid {
  let g = blank(LAIKA_W, LAIKA_H);
  const b = p.body;
  // Torso top row for a column; the rear (x=5) moves by `tilt`, the front (x=17) stays put.
  const top = (x: number) => 12 + b + Math.round((p.tilt * (17 - x)) / 12);
  const cuff = boots ? "E" : "R";
  const paw = boots ? "Y" : "W";
  const drawLeg = (x: number, leg: Leg, far: boolean) => {
    const col = x + leg.dx;
    const from = top(x) + 5;
    const to = PAW_ROW - leg.lift;
    const rows: Array<[number, number, string]> = [];
    if (to < from) {
      // Folded leg (sitting / lying): just the paw peeking out under the body.
      rows.push([Math.min(PAW_ROW, from), col, paw + paw]);
    } else {
      for (let y = from; y <= to; y++) {
        const ch = y === to ? paw : y === to - 1 ? cuff : far ? "D" : "S";
        rows.push([y, col, ch + ch]);
      }
    }
    g = patch(g, rows);
  };
  drawLeg(8, p.legs.fh, true);
  drawLeg(13, p.legs.ff, true);
  const torso: Array<[number, number, string]> = [];
  for (let x = 5; x <= 17; x++) {
    const t = top(x);
    for (let r = 0; r < 5; r++) {
      if (r === 0 && x === 5) continue; // rounded back
      const ch = r === 3 ? "R" : r === 4 ? "D" : "S";
      torso.push([t + r, x, ch]);
    }
  }
  const tb = top(9);
  torso.push([tb - 1, 7, "YYYYY"], [tb - 2, 8, "YYY"], [tb - 3, 9, "N"]); // backpack + antenna
  const ts = top(12);
  torso.push([ts + 1, 12, "YY"], [ts + 2, 12, "Y" + p.sensor]); // suit sensor ("nose" scanner)
  torso.push([top(14), 13, "RRRR"]); // collar ring
  g = patch(g, torso);
  drawLeg(6, p.legs.nh, false);
  drawLeg(15, p.legs.nf, false);
  const tailY = top(5);
  g = patch(
    g,
    TAILS[p.tail].map(([dy, dx, s]) => [tailY + dy, 4 + dx, s] as [number, number, string]),
  );
  const h = head(p.face);
  const hx = h.flip ? 11 + p.hx : 14 + p.hx;
  g = stamp(g, h.flip ? mirror(h.grid) : h.grid, hx, 2 + b + p.hy);
  return outline(g, "N", new Set(["H", "G", "L"]));
}

// ---------------------------------------------------------------------------
// Gait generation
// ---------------------------------------------------------------------------

interface Gait {
  frames: number;
  /** Stride half-length in pixels. */
  amp: number;
  /** Fraction of the cycle a paw is on the ground. */
  stance: number;
  lift: number;
  /** Phase offset of each leg (fraction of a cycle). */
  phase: { nf: number; ff: number; nh: number; fh: number };
}

export function legAt(t: number, phase: number, g: Gait): Leg {
  const u = (((t + phase) % 1) + 1) % 1;
  if (u < g.stance) return L(Math.round(g.amp - (2 * g.amp * u) / g.stance), 0);
  const v = (u - g.stance) / (1 - g.stance);
  const lift = v > 0.2 && v < 0.8 ? g.lift : v > 0.05 && v < 0.95 ? 1 : 0;
  return L(Math.round(-g.amp + 2 * g.amp * v), lift);
}

// Walk: lateral sequence, each hind leg one step (a quarter cycle) behind the opposite fore leg.
export const WALK: Gait = { frames: 6, amp: 2, stance: 0.62, lift: 2, phase: { nf: 0, ff: 0.5, fh: 0.75, nh: 0.25 } };
// Trot: diagonal pairs move together.
export const TROT: Gait = { frames: 6, amp: 2, stance: 0.5, lift: 2, phase: { nf: 0, fh: 0, ff: 0.5, nh: 0.5 } };
// Gallop: fore pair, then hind pair, with a flight phase.
export const GALLOP: Gait = { frames: 6, amp: 3, stance: 0.42, lift: 2, phase: { nf: 0, ff: 0.12, nh: 0.5, fh: 0.62 } };

function gaitPoses(prefix: string, g: Gait, extra: (i: number) => Partial<Pose>): Record<string, Pose> {
  const out: Record<string, Pose> = {};
  for (let i = 0; i < g.frames; i++) {
    const t = i / g.frames;
    const legs: Legs = { nf: legAt(t, g.phase.nf, g), ff: legAt(t, g.phase.ff, g), nh: legAt(t, g.phase.nh, g), fh: legAt(t, g.phase.fh, g) };
    out[`${prefix}${i}`] = { ...P("normal", i % 2 ? "mid" : "up", legs), ...extra(i) };
  }
  return out;
}

const SIT: Legs = { nh: L(-1, 9), fh: L(-1, 9), nf: L(), ff: L() };
const LIE: Legs = { nh: L(0, 9), fh: L(0, 9), nf: L(2, 9), ff: L(1, 9) };

/** Every animation frame, in sheet order. */
export const LAIKA_POSES: Record<string, Pose> = {
  // Idle family
  idle0: P("normal", "up", STAND),
  idle1: P("normal", "mid", STAND),
  blink: P("blink", "up", STAND),
  earTwitch: P("earTwitch", "up", STAND),
  lookBack: P("lookBack", "mid", STAND),
  wag0: P("happy", "wagL", STAND),
  wag1: P("happy", "up", STAND),
  wag2: P("happy", "wagR", STAND),
  alert: P("alert", "high", STAND, { hy: -1 }),
  tilt: P("tilt", "mid", STAND),
  worried: P("worried", "down", STAND),
  // Sitting, lying, sleeping, stretching
  sitDown: P("normal", "down", { nh: L(-1, 2), fh: L(-1, 2), nf: L(), ff: L() }, { tilt: 2 }),
  sit0: P("normal", "floor", SIT, { tilt: 4, hy: -1 }),
  sit1: P("blink", "floor", SIT, { tilt: 4, hy: -1 }),
  sitWag: P("happy", "rest", SIT, { tilt: 4, hy: -1 }),
  lie: P("normal", "rest", LIE, { body: 4, hx: 1, hy: 1 }),
  sleep0: P("sleep", "rest", LIE, { body: 4, hx: 1, hy: 2 }),
  sleep1: P("sleep", "rest", LIE, { body: 4, hx: 1, hy: 1 }),
  stretch0: P("blink", "high", { nh: L(), fh: L(), nf: L(2, 0), ff: L(3, 0) }, { tilt: -4, body: 2, hy: 3, hx: 1 }),
  stretch1: P("happy", "up", { nh: L(-2, 0), fh: L(-3, 0), nf: L(), ff: L() }, { tilt: 1 }),
  // Locomotion
  ...gaitPoses("walk", WALK, (i) => ({ body: i === 1 || i === 4 ? -1 : 0 })),
  ...gaitPoses("trot", TROT, (i) => ({ body: i % 3 === 1 ? -1 : 0 })),
  ...gaitPoses("run", GALLOP, (i) => ({ face: i < 3 ? "earsUp" : "normal", hx: 1, body: i === 2 || i === 3 ? -1 : 0, tilt: i < 3 ? -1 : 1 })),
  turn: P("normal", "mid", { nh: L(1), fh: L(1), nf: L(-1), ff: L(-1) }, { hx: -1 }),
  // Air
  jumpStart: P("earsUp", "up", { nh: L(-1, 0), fh: L(-1, 0), nf: L(1, 0), ff: L(1, 0) }, { body: 2 }),
  rise: P("earsUp", "high", { nh: L(-2, 1), fh: L(-3, 1), nf: L(2, 2), ff: L(1, 2) }, { body: -1, hx: 1, hy: -1, tilt: 1 }),
  apex: P("earsUp", "up", { nh: L(-1, 2), fh: L(-1, 2), nf: L(1, 2), ff: L(1, 2) }, { body: -1 }),
  fall: P("alert", "up", { nh: L(-1), fh: L(0), nf: L(1), ff: L(0) }, { hy: -1, tilt: -1 }),
  land: P("normal", "down", { nh: L(-1, 1), fh: L(0, 1), nf: L(1, 1), ff: L(0, 1) }, { body: 2, hy: 1 }),
  airJump: P("happy", "high", { nh: L(-2, 2), fh: L(-2, 2), nf: L(2, 2), ff: L(2, 2) }, { body: -2 }),
  // Signature actions
  sniff0: P("sniffA", "up", STAND, { hx: 1, hy: 3, sensor: "E", tilt: -1 }),
  sniff1: P("sniffB", "mid", STAND, { hx: 1, hy: 4, sensor: "Z", tilt: -1 }),
  sniff2: P("sniffA", "up", STAND, { hx: 2, hy: 3, sensor: "E", tilt: -1 }),
  digStart: P("blink", "high", { nh: L(), fh: L(), nf: L(1, 0), ff: L(1, 0) }, { tilt: -3, body: 1, hy: 4, hx: 1 }),
  dig0: P("sniffB", "high", { nh: L(), fh: L(), nf: L(2, 3), ff: L(0, 0) }, { tilt: -3, body: 1, hy: 5, hx: 1 }),
  dig1: P("sniffB", "up", { nh: L(), fh: L(), nf: L(0, 0), ff: L(2, 3) }, { tilt: -3, body: 1, hy: 5, hx: 1 }),
  repair0: P("normal", "up", { nh: L(), fh: L(), nf: L(2, 4), ff: L() }, { hy: 1, hx: 1 }),
  repair1: P("blink", "mid", { nh: L(), fh: L(), nf: L(3, 2), ff: L() }, { hy: 1, hx: 1 }),
  sweep0: P("happy", "sweepA", STAND),
  sweep1: P("happy", "sweepB", { ...STAND, nh: L(0, 1) }),
  sweep2: P("happy", "sweepC", STAND),
  celebrate0: P("happy", "high", { nh: L(0, 2), fh: L(0, 2), nf: L(0, 2), ff: L(0, 2) }, { body: -2 }),
  celebrate1: P("happy", "wagL", STAND),
  celebrate2: P("happy", "wagR", STAND),
  bark0: P("alert", "high", STAND, { hx: 1, hy: -1 }),
  bark1: P("bark", "high", { ...STAND, nf: L(1, 0) }, { hx: 1, hy: -1, body: -1 }),
};

export const LAIKA_FRAME_NAMES = Object.keys(LAIKA_POSES);

export function laikaFrames(boots: boolean): Array<{ name: string; grid: Grid }> {
  return LAIKA_FRAME_NAMES.map((name) => ({ name, grid: compose(LAIKA_POSES[name], boots) }));
}

const seqN = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

/** Animation definitions: frame names + frames per second + loop. */
export const LAIKA_ANIMS: Record<string, { frames: string[]; fps: number; loop: boolean }> = {
  idle: { frames: ["idle0", "idle0", "idle1", "idle0", "idle0", "idle1"], fps: 3, loop: true },
  blink: { frames: ["blink"], fps: 8, loop: false },
  earTwitch: { frames: ["earTwitch", "idle0", "earTwitch"], fps: 10, loop: false },
  lookBack: { frames: ["lookBack", "lookBack", "lookBack", "idle0"], fps: 3, loop: false },
  wag: { frames: ["wag0", "wag1", "wag2", "wag1"], fps: 14, loop: true },
  alert: { frames: ["alert"], fps: 1, loop: true },
  tilt: { frames: ["tilt"], fps: 1, loop: true },
  worried: { frames: ["worried"], fps: 1, loop: true },
  sitDown: { frames: ["sitDown", "sit0"], fps: 8, loop: false },
  sit: { frames: ["sit0", "sit0", "sit0", "sit1", "sit0", "sitWag", "sit0"], fps: 3, loop: true },
  lieDown: { frames: ["sitDown", "lie"], fps: 6, loop: false },
  lie: { frames: ["lie"], fps: 1, loop: true },
  sleep: { frames: ["sleep0", "sleep0", "sleep1", "sleep1"], fps: 2, loop: true },
  stretch: { frames: ["stretch0", "stretch0", "stretch0", "stretch1", "stretch1", "idle0"], fps: 5, loop: false },
  walk: { frames: seqN("walk", 6), fps: 9, loop: true },
  trot: { frames: seqN("trot", 6), fps: 12, loop: true },
  run: { frames: seqN("run", 6), fps: 15, loop: true },
  turn: { frames: ["turn"], fps: 1, loop: false },
  jumpStart: { frames: ["jumpStart"], fps: 1, loop: false },
  rise: { frames: ["rise"], fps: 1, loop: true },
  apex: { frames: ["apex"], fps: 1, loop: true },
  fall: { frames: ["fall"], fps: 1, loop: true },
  land: { frames: ["land"], fps: 1, loop: false },
  airJump: { frames: ["airJump", "apex"], fps: 8, loop: false },
  sniff: { frames: ["sniff0", "sniff1", "sniff2", "sniff1", "sniff0"], fps: 11, loop: false },
  dig: { frames: ["digStart", "digStart", "dig0", "dig1", "dig0", "dig1", "dig0", "dig1"], fps: 13, loop: false },
  interact: { frames: ["repair0", "repair1"], fps: 8, loop: false },
  repair: { frames: ["repair0", "repair1", "repair0", "repair1", "repair0"], fps: 10, loop: false },
  celebrate: { frames: ["celebrate0", "celebrate1", "celebrate2", "celebrate1", "celebrate2"], fps: 9, loop: false },
  sweep: { frames: ["sweep0", "sweep1", "sweep2", "sweep1", "sweep0", "sweep2"], fps: 11, loop: false },
  bark: { frames: ["bark0", "bark1", "bark1", "bark0"], fps: 10, loop: false },
};
