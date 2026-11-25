/**
 * Tiny pixel painter on top of a 2D canvas. Every call draws whole pixels at integer
 * coordinates, so nothing is ever anti-aliased. All game art is generated through this.
 */

export type Grid = string[];
export type Pal = Record<string, string>;

export function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

/** Deterministic PRNG so generated art is identical on every load. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Painter {
  constructor(public ctx: CanvasRenderingContext2D) {}

  rect(x: number, y: number, w: number, h: number, color: string, alpha = 1): this {
    if (w <= 0 || h <= 0) return this;
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    this.ctx.globalAlpha = 1;
    return this;
  }

  px(x: number, y: number, color: string, alpha = 1): this {
    return this.rect(x, y, 1, 1, color, alpha);
  }

  /** Horizontal line from x0 to x1 inclusive. */
  hline(x0: number, x1: number, y: number, color: string): this {
    return this.rect(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, 1, color);
  }

  vline(x: number, y0: number, y1: number, color: string): this {
    return this.rect(x, Math.min(y0, y1), 1, Math.abs(y1 - y0) + 1, color);
  }

  /** Filled pixel circle. */
  disc(cx: number, cy: number, r: number, color: string, alpha = 1): this {
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y) + 0.35);
      this.rect(cx - half, cy + y, half * 2 + 1, 1, color, alpha);
    }
    return this;
  }

  /** Filled half disc sitting on baseY (domes). */
  dome(cx: number, baseY: number, r: number, color: string): this {
    for (let i = 0; i < r; i++) {
      const dy = r - i - 0.5;
      const half = Math.round(Math.sqrt(r * r - dy * dy));
      this.rect(cx - half, baseY - r + i, half * 2, 1, color);
    }
    return this;
  }

  /** Draws a character grid. "." is transparent. flip mirrors horizontally. */
  grid(g: Grid, pal: Pal, ox = 0, oy = 0, flip = false, alphaFor?: (ch: string) => number): this {
    const w = g.reduce((m, r) => Math.max(m, r.length), 0);
    for (let y = 0; y < g.length; y++) {
      const row = g[y];
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === "." || ch === " ") continue;
        const color = pal[ch];
        if (!color) continue;
        const dx = flip ? w - 1 - x : x;
        this.px(ox + dx, oy + y, color, alphaFor ? alphaFor(ch) : 1);
      }
    }
    return this;
  }

  /** 2x2 ordered dither between two colours over a rect (for gradients and texture). */
  dither(x: number, y: number, w: number, h: number, a: string, b: string, density: number): this {
    const m = [
      [0, 2],
      [3, 1],
    ];
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const t = (m[(y + j) & 1][(x + i) & 1] + 0.5) / 4;
        this.px(x + i, y + j, t < density ? b : a);
      }
    }
    return this;
  }
}

/** Builds a grid from a base by writing strings at [row, col]. */
export function patch(base: Grid, patches: Array<[number, number, string]>): Grid {
  const rows = base.map((r) => r.split(""));
  for (const [r, c, chars] of patches) {
    if (!rows[r]) continue;
    for (let i = 0; i < chars.length; i++) {
      if (chars[i] === "_") continue; // "_" = leave unchanged
      if (c + i >= 0 && c + i < rows[r].length) rows[r][c + i] = chars[i];
    }
  }
  return rows.map((r) => r.join(""));
}

/** Adds a 1-pixel outline (char `o`) around every opaque pixel, except chars in `skip`. */
export function outline(g: Grid, o = "N", skip = new Set<string>()): Grid {
  const h = g.length;
  const w = g[0].length;
  const rows = g.map((r) => r.split(""));
  const solid = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const ch = g[y][x];
    return ch !== "." && ch !== o && !skip.has(ch);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (g[y][x] !== ".") continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) rows[y][x] = o;
    }
  }
  return rows.map((r) => r.join(""));
}

/** Empty grid of the given size. */
export function blank(w: number, h: number): Grid {
  return Array.from({ length: h }, () => ".".repeat(w));
}

/** Stamps grid `src` onto `dst` at (ox, oy), skipping transparent pixels. */
export function stamp(dst: Grid, src: Grid, ox: number, oy: number): Grid {
  const rows = dst.map((r) => r.split(""));
  for (let y = 0; y < src.length; y++) {
    for (let x = 0; x < src[y].length; x++) {
      const ch = src[y][x];
      if (ch === ".") continue;
      const ty = oy + y;
      const tx = ox + x;
      if (rows[ty] && tx >= 0 && tx < rows[ty].length) rows[ty][tx] = ch;
    }
  }
  return rows.map((r) => r.join(""));
}
