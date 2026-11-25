/** 12x12 item icons, shared by the world pickups and the HTML HUD (exported as data URLs). */
import type { ItemId } from "../data/items";
import { C } from "./palette";
import { makeCanvas, outline, Painter, type Grid, type Pal } from "./painter";

const PAL: Pal = {
  N: C.out,
  s: C.steelL,
  m: C.steel,
  d: C.steelD,
  w: C.white,
  g: C.green,
  G: "#2f7d45",
  y: C.yellow,
  Y: C.yellowD,
  r: C.red,
  b: C.blueL,
  B: C.blue,
  o: C.orange,
  c: C.cream,
  k: "#6b3b2a",
  K: "#4a2a20",
  p: "#b34a3a",
  P: "#7b2c2a",
  h: "#c8c8d8",
  t: "#e8b04a",
  T: "#b07a22",
};

const RAW: Record<ItemId, Grid> = {
  metal: [
    "............",
    "....ss......",
    "...sswss....",
    "..smmmmws...",
    ".smmdmmmms..",
    ".smmmmdmmms.",
    "..dmmmmmmd..",
    "...ddmmmd...",
    ".....ddd....",
    "............",
    "............",
    "............",
  ],
  electronics: [
    "............",
    ".y.y.y.y.y..",
    "GGGGGGGGGG..",
    "GggggggggG..",
    "GgddddgyyG..",
    "GgddddgyyG..",
    "GgddddgggG..",
    "GgggrggbgG..",
    "GGGGGGGGGG..",
    ".y.y.y.y.y..",
    "............",
    "............",
  ],
  commsModule: [
    "......r.....",
    "......m.....",
    ".....mmm....",
    "...ssssss...",
    "..smmmmmms..",
    "..smbBbBms..",
    "..smBbBbms..",
    "..smmmmmms..",
    "..smyrmmms..",
    "...dddddd...",
    "............",
    "............",
  ],
  sample: [
    "............",
    "............",
    "....ppp.....",
    "...pppPp....",
    "..pphpPPp...",
    "..ppPPPpP...",
    ".pPpppPPPp..",
    ".PPPpPPPPP..",
    "..PPPPPPP...",
    "............",
    "............",
    "............",
  ],
  treat: [
    "............",
    ".tt......tt.",
    "tyyt....tyyt",
    "tyyyttttyyyt",
    ".tyyyyyyyyt.",
    ".tyyyyyyyyt.",
    "tyyyttttyyyt",
    "tyyt....tyyt",
    ".tt......tt.",
    "............",
    "............",
    "............",
  ],
  coupling: [
    "............",
    "...yy..yy...",
    "...yY..yY...",
    "..ssssssss..",
    ".smmmmmmmms.",
    ".smddmmddms.",
    ".smmmmmmmms.",
    "..dddddddd..",
    "...yY..yY...",
    "...yy..yy...",
    "............",
    "............",
  ],
  relayCell: [
    ".....ss.....",
    "...ssssss...",
    "..smmmmmms..",
    "..smbbbbms..",
    "..smBbbBms..",
    "..smbbbbms..",
    "..smBbbBms..",
    "..smbbbbms..",
    "..smmmmmms..",
    "...dddddd...",
    "............",
    "............",
  ],
  recording: [
    "............",
    "............",
    ".dddddddddd.",
    ".dmmmmmmmmd.",
    ".dmwwmmwwmd.",
    ".dmwdmmwdmd.",
    ".dmwwmmwwmd.",
    ".dmmmrmmmmd.",
    ".dddddddddd.",
    "............",
    "............",
    "............",
  ],
  roverPart: [
    "............",
    "...dddddd...",
    "..dmmmmmmd..",
    ".dmmssssmmd.",
    ".dmsdddsmmd.",
    ".dmsdyysmmd.",
    ".dmsdyysmmd.",
    ".dmsdddsmmd.",
    ".dmmssssmmd.",
    "..dmmmmmmd..",
    "...dddddd...",
    "............",
  ],
};

export const ICONS: Record<ItemId, Grid> = Object.fromEntries(
  Object.entries(RAW).map(([k, g]) => [k, outline(g, "N", new Set())]),
) as Record<ItemId, Grid>;

export const ICON_PAL = PAL;

export function drawIcon(id: ItemId, scale = 1): HTMLCanvasElement {
  const g = ICONS[id];
  const { canvas, ctx } = makeCanvas(g[0].length * scale, g.length * scale);
  const p = new Painter(ctx);
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[y].length; x++) {
      const ch = g[y][x];
      if (ch !== "." && PAL[ch]) p.rect(x * scale, y * scale, scale, scale, PAL[ch]);
    }
  return canvas;
}

const urlCache = new Map<string, string>();
/** Data URL for the HTML HUD (drawn at 1x and scaled with image-rendering: pixelated). */
export function iconUrl(id: ItemId): string {
  if (!urlCache.has(id)) urlCache.set(id, drawIcon(id, 1).toDataURL());
  return urlCache.get(id)!;
}
