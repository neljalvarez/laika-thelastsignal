/**
 * Laika, side view, built from parts (helmet + head, suit, tail, legs) so every animation
 * frame shares exactly the same proportions. Colours and costume (bubble helmet, brown ears,
 * orange and cream fur, white suit with red trim, steel backpack) match the original game's
 * front-view sprite.
 */
import { blank, outline, patch, stamp, type Grid } from "./painter";

export const LAIKA_W = 26;
export const LAIKA_H = 22;

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

type Face = "normal" | "blink" | "happy" | "sniffA" | "sniffB" | "earsUp" | "tilt" | "sleep" | "worried";

function head(face: Face): Grid {
  switch (face) {
    case "normal":
      return HEAD;
    case "blink":
      return patch(HEAD, [[5, 6, "B"]]);
    case "happy":
      return patch(HEAD, [
        [5, 6, "N"],
        [7, 7, "NP"],
        [8, 6, "PP"],
      ]);
    case "sniffA":
      return patch(HEAD, [
        [6, 9, "W"],
        [5, 9, "N"],
        [5, 6, "B"],
      ]);
    case "sniffB":
      return patch(HEAD, [[5, 6, "B"]]);
    case "earsUp":
      return patch(HEAD, [
        [1, 3, "BB"],
        [2, 3, "BB"],
        [3, 3, "GB"],
      ]);
    case "tilt":
      return patch(HEAD, [
        [2, 3, "GG"],
        [3, 3, "GG"],
        [4, 2, "BB"],
        [5, 2, "B"],
        [4, 6, "N"],
        [5, 6, "O"],
      ]);
    case "sleep":
      return patch(HEAD, [
        [5, 6, "B"],
        [2, 3, "GG"],
        [3, 3, "GG"],
        [4, 2, "BB"],
        [5, 2, "B"],
      ]);
    case "worried":
      return patch(HEAD, [
        [2, 3, "GG"],
        [3, 3, "GB"],
        [4, 2, "B"],
      ]);
  }
}

type Tail = "up" | "mid" | "down" | "high" | "sweepA" | "sweepB" | "rest";

const TAILS: Record<Tail, Array<[number, number, string]>> = {
  up: [
    [12, 4, "O"],
    [11, 3, "O"],
    [10, 3, "O"],
    [9, 2, "WW"],
  ],
  mid: [
    [12, 3, "OO"],
    [11, 2, "O"],
    [10, 2, "W"],
  ],
  down: [
    [13, 4, "O"],
    [14, 3, "O"],
    [15, 2, "W"],
  ],
  high: [
    [11, 4, "O"],
    [10, 4, "O"],
    [9, 3, "O"],
    [8, 3, "WW"],
  ],
  sweepA: [
    [14, 3, "OO"],
    [15, 2, "O"],
    [16, 1, "W"],
  ],
  sweepB: [
    [12, 3, "OO"],
    [11, 2, "OO"],
    [10, 1, "W"],
  ],
  rest: [
    [16, 3, "OO"],
    [16, 2, "W"],
  ],
};

interface Leg {
  dx: number;
  lift: number;
}
interface Legs {
  nh: Leg; // near hind
  fh: Leg; // far hind
  nf: Leg; // near fore
  ff: Leg; // far fore
}
const L = (dx = 0, lift = 0): Leg => ({ dx, lift });
const LEGS = {
  stand: { nh: L(), fh: L(), nf: L(), ff: L() },
  walk0: { nh: L(-1), fh: L(1), nf: L(1), ff: L(-1) },
  walk1: { nh: L(0, 1), fh: L(), nf: L(), ff: L(0, 1) },
  walk2: { nh: L(1), fh: L(-1), nf: L(-1), ff: L(1) },
  walk3: { nh: L(), fh: L(0, 1), nf: L(0, 1), ff: L() },
  run0: { nh: L(-2), fh: L(-1, 1), nf: L(2), ff: L(1, 1) },
  run1: { nh: L(0, 1), fh: L(1, 1), nf: L(0, 1), ff: L(-1, 1) },
  run2: { nh: L(1), fh: L(2, 1), nf: L(-1), ff: L(-2, 1) },
  run3: { nh: L(-1, 1), fh: L(0), nf: L(1, 1), ff: L(0) },
  jump: { nh: L(-2, 1), fh: L(-1, 2), nf: L(2, 2), ff: L(1, 1) },
  fall: { nh: L(-1), fh: L(0), nf: L(1), ff: L(0) },
  land: { nh: L(-1, 1), fh: L(0, 1), nf: L(1, 1), ff: L(0, 1) },
  dig0: { nh: L(), fh: L(), nf: L(1, 2), ff: L(0) },
  dig1: { nh: L(), fh: L(), nf: L(0), ff: L(1, 2) },
  paw: { nh: L(), fh: L(), nf: L(2, 3), ff: L() },
  tuck: { nh: L(0, 1), fh: L(0, 1), nf: L(0, 1), ff: L(0, 1) },
  sleep: { nh: L(0, 3), fh: L(0, 3), nf: L(2, 3), ff: L(1, 3) },
} satisfies Record<string, Legs>;

interface Pose {
  face: Face;
  tail: Tail;
  legs: Legs;
  /** Vertical body offset (negative = up). */
  body: number;
  /** Head offset relative to the body. */
  hx: number;
  hy: number;
  /** Sensor light state. */
  sensor: "Z" | "E";
}

function compose(p: Pose, boots: boolean): Grid {
  let g = blank(LAIKA_W, LAIKA_H);
  const b = p.body;
  const legColor = (far: boolean) => (far ? "D" : "S");
  const cuff = boots ? "E" : "R";
  const paw = boots ? "Y" : "W";
  const drawLeg = (x: number, leg: Leg, far: boolean) => {
    const top = 17 + Math.min(0, b);
    const bottom = 20 - leg.lift;
    const rows: Array<[number, number, string]> = [];
    for (let y = top; y <= bottom; y++) {
      let ch = legColor(far);
      if (y === bottom) ch = paw;
      else if (y === bottom - 1) ch = cuff;
      rows.push([y, x + leg.dx, ch + ch]);
    }
    g = patch(g, rows);
  };
  // Far legs first, then near legs on top.
  drawLeg(8, p.legs.fh, true);
  drawLeg(13, p.legs.ff, true);
  // Torso.
  const torso: Array<[number, number, string]> = [];
  for (let y = 12; y <= 16; y++) {
    const ch = y === 15 ? "R" : y === 16 ? "D" : "S";
    // Rounded back: the top row starts one pixel later.
    torso.push(y === 12 ? [y + b, 6, ch.repeat(12)] : [y + b, 5, ch.repeat(13)]);
  }
  torso.push([11 + b, 7, "YYYYY"], [10 + b, 8, "YYY"], [9 + b, 9, "N"]); // backpack + little antenna
  torso.push([13 + b, 12, "YY"], [14 + b, 12, "Y" + p.sensor]); // scanner unit
  torso.push([12 + b, 13, "RRRR"]); // collar ring
  g = patch(g, torso);
  drawLeg(6, p.legs.nh, false);
  drawLeg(15, p.legs.nf, false);
  // Tail.
  g = patch(
    g,
    TAILS[p.tail].map(([y, x, s]) => [y + b, x, s] as [number, number, string]),
  );
  // Helmet + head on top.
  g = stamp(g, head(p.face), 14 + p.hx, 2 + b + p.hy);
  return outline(g, "N", new Set(["H", "G", "L"]));
}

const P = (face: Face, tail: Tail, legs: Legs, body = 0, hx = 0, hy = 0, sensor: "Z" | "E" = "Z"): Pose => ({
  face,
  tail,
  legs,
  body,
  hx,
  hy,
  sensor,
});

/** Every animation frame, in sheet order. Animations reference frames by name. */
export const LAIKA_POSES: Record<string, Pose> = {
  idle0: P("normal", "up", LEGS.stand),
  idle1: P("normal", "mid", LEGS.stand),
  idle2: P("blink", "up", LEGS.stand),
  idle3: P("normal", "down", LEGS.stand, 0, 0, 0),
  tilt: P("tilt", "mid", LEGS.stand),
  worried: P("worried", "down", LEGS.stand),
  walk0: P("normal", "mid", LEGS.walk0),
  walk1: P("normal", "up", LEGS.walk1, -1),
  walk2: P("normal", "mid", LEGS.walk2),
  walk3: P("normal", "up", LEGS.walk3, -1),
  run0: P("earsUp", "mid", LEGS.run0, -1, 1),
  run1: P("normal", "mid", LEGS.run1, 0, 1),
  run2: P("earsUp", "mid", LEGS.run2, -1, 1),
  run3: P("normal", "up", LEGS.run3, 0, 1),
  jump: P("earsUp", "high", LEGS.jump, -1, 1, -1),
  fall: P("earsUp", "up", LEGS.fall, 0, 0, -1),
  land: P("normal", "down", LEGS.land, 1, 0, 1),
  sniff0: P("sniffA", "up", LEGS.stand, 0, 1, 3, "E"),
  sniff1: P("sniffB", "mid", LEGS.stand, 0, 1, 2, "Z"),
  dig0: P("sniffB", "up", LEGS.dig0, 0, 1, 3),
  dig1: P("blink", "mid", LEGS.dig1, 0, 1, 4),
  interact: P("normal", "up", LEGS.paw, 0, 0, -1),
  celebrate0: P("happy", "high", LEGS.tuck, -2, 0, 0),
  celebrate1: P("happy", "up", LEGS.stand, 0, 0, 0),
  sweep0: P("happy", "sweepA", LEGS.stand),
  sweep1: P("happy", "sweepB", LEGS.walk1),
  sleep: P("sleep", "rest", LEGS.sleep, 3, 1, 1),
};

export const LAIKA_FRAME_NAMES = Object.keys(LAIKA_POSES);

export function laikaFrames(boots: boolean): Array<{ name: string; grid: Grid }> {
  return LAIKA_FRAME_NAMES.map((name) => ({ name, grid: compose(LAIKA_POSES[name], boots) }));
}

/** Animation definitions: frame names + frames per second + loop. */
export const LAIKA_ANIMS: Record<string, { frames: string[]; fps: number; loop: boolean }> = {
  idle: { frames: ["idle0", "idle1", "idle0", "idle1", "idle0", "idle0", "idle2", "idle0", "idle1", "idle0"], fps: 5, loop: true },
  wag: { frames: ["idle0", "idle1", "idle3", "idle1"], fps: 12, loop: true },
  tilt: { frames: ["tilt"], fps: 1, loop: true },
  walk: { frames: ["walk0", "walk1", "walk2", "walk3"], fps: 9, loop: true },
  run: { frames: ["run0", "run1", "run2", "run3"], fps: 13, loop: true },
  jump: { frames: ["jump"], fps: 1, loop: true },
  fall: { frames: ["fall"], fps: 1, loop: true },
  land: { frames: ["land"], fps: 1, loop: false },
  sniff: { frames: ["sniff0", "sniff1", "sniff0", "sniff1"], fps: 8, loop: false },
  dig: { frames: ["dig0", "dig1", "dig0", "dig1", "dig0", "dig1"], fps: 10, loop: false },
  interact: { frames: ["interact"], fps: 1, loop: false },
  celebrate: { frames: ["celebrate0", "celebrate1", "celebrate0", "celebrate1"], fps: 6, loop: false },
  sweep: { frames: ["sweep0", "sweep1", "sweep0", "sweep1", "sweep0"], fps: 9, loop: false },
  sleep: { frames: ["sleep"], fps: 1, loop: true },
  worried: { frames: ["worried"], fps: 1, loop: true },
};
