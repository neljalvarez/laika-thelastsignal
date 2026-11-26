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
  // Phase 4 mission items.
  regulator: [
    "............",
    "....yyyy....",
    "..dddddddd..",
    ".dmmmmmmmmd.",
    ".dmbbmmyymd.",
    ".dmbbmmyymd.",
    ".dmmmmmmmmd.",
    ".dmrrrrrrmd.",
    ".dmmmmmmmmd.",
    "..dddddddd..",
    "...d....d...",
    "............",
  ],
  recyclerPart: [
    "............",
    "....dddd....",
    "...dssssd...",
    "..dsbbbbsd..",
    "..dsbBBbsd..",
    "..dsbBBbsd..",
    "..dsbbbbsd..",
    "..dssssssd..",
    "...dmmmmd...",
    "....dmmd....",
    ".....dd.....",
    "............",
  ],
  waterCoupling: [
    "............",
    "............",
    ".dd......dd.",
    ".dmd....dmd.",
    ".dmmddddmmd.",
    ".dmbbbbbbmd.",
    ".dmbBBBBbmd.",
    ".dmmddddmmd.",
    ".dmd....dmd.",
    ".dd......dd.",
    "............",
    "............",
  ],
  seeds: [
    "............",
    "...dddddd...",
    "..dccccccd..",
    "..dcgggccd..",
    "..dcgGgccd..",
    "..dccgcccd..",
    "..dckkkkcd..",
    "..dcKkKkcd..",
    "..dckkkkcd..",
    "..dccccccd..",
    "...dddddd...",
    "............",
  ],
  powerCell: [
    "............",
    ".....ss.....",
    "...dddddd...",
    "...dyyyyd...",
    "...dyYYyd...",
    "...dyyYyd...",
    "...dyYyyd...",
    "...dyyyyd...",
    "...dmmmmd...",
    "...dmmmmd...",
    "...dddddd...",
    "............",
  ],
};

/** Phase 4: science journal category icons (same palette and outline as the item icons). */
const SCI_RAW: Record<string, Grid> = {
  sci_geology: ["............", "............", "....pppp....", "...ppPpppp..", "..ppppPPppp.", ".pPppppppPp.", ".ppppPpppppp", ".pppppppPpp.", "..pPpppppp..", "...ppppp....", "............", "............"],
  sci_water: ["............", ".....b......", ".....b......", "....bbb.....", "....bBb.....", "...bbBbb....", "...bBBBb....", "..bbBwBbb...", "..bBBBBBb...", "...bBBBb....", "....bbb.....", "............"],
  sci_solar: ["............", ".....y......", "..y..y..y...", "...yyyyy....", "..yyYYYyy...", "yyyYYYYYyyy.", "..yyYYYyy...", "...yyyyy....", "..y..y..y...", ".....y......", "............", "............"],
  sci_storage: ["............", "....dddd....", "..dddddddd..", "..dggggggd..", "..dggggggd..", "..dGGGGGGd..", "..dGGGGGGd..", "..dmmmmmmd..", "..dmmmmmmd..", "..dddddddd..", "............", "............"],
  sci_life: ["............", "....bbbb....", "...b....b...", "..b..bb..b..", "..b.b..b.b..", "..b.b..b.b..", "..b..bb..b..", "...b....b...", "....bbbb....", "...b......b.", "............", "............"],
  sci_plants: ["............", ".....g......", "....gGg.....", "...gGgGg....", "....gGg.g...", "..g..g.gG...", "..Gg.g.g....", "...gGgg.....", ".....g......", "..kkkkkkk...", "...kKKKk....", "............"],
  sci_radiation: ["............", "...dddddd...", "..dssssssd..", "..dsyyyysd..", "..dsyddysd..", "..dsyddysd..", "..dsyyyysd..", "...dssssd...", "....dssd....", ".....dd.....", "............", "............"],
  sci_comms: ["............", "..........s.", ".........s..", "....ddd.s...", "...dmmmd....", "..dmsssmd...", "..dmsssmd...", "...dmmmd....", "....dmd.....", "....dmd.....", "...ddddd....", "............"],
};

export const SCI_ICONS: Record<string, Grid> = Object.fromEntries(Object.entries(SCI_RAW).map(([k, g]) => [k, outline(g, "N", new Set())]));

export function drawGrid(g: Grid, scale = 1): HTMLCanvasElement {
  const { canvas, ctx } = makeCanvas(g[0].length * scale, g.length * scale);
  const p = new Painter(ctx);
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[y].length; x++) {
      const ch = g[y][x];
      if (ch !== "." && PAL[ch]) p.rect(x * scale, y * scale, scale, scale, PAL[ch]);
    }
  return canvas;
}

/** Data URL of a science category icon, for the HTML journal. */
export function sciIconUrl(key: string): string {
  if (!urlCache.has(key)) urlCache.set(key, drawGrid(SCI_ICONS[key] ?? SCI_ICONS.sci_geology, 1).toDataURL());
  return urlCache.get(key)!;
}

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
