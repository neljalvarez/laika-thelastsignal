/**
 * Renders the world: tilemap layers with collision, parallax sky, building shells that fade
 * when Laika walks inside, secret walls, decorations, and the doors / bridge that change at
 * runtime. Simulation state lives elsewhere; this only shows it.
 */
import Phaser from "phaser";
import { TILE, VIEW_H, VIEW_W } from "../config/constants";
import { backIndex, special2Index, specialIndex, terrainIndex } from "../art/tiles";
import type { MapDef } from "../data/regions/types";
import { B, BRIDGE_TILES, FLOOR_HATCH_TILES, HATCH_TILES, INTERIORS, STATION_DOOR_TILES, T, type TileRect } from "../data/world";
import type { GameState } from "../systems/state";
import { isSolid, type WorldGrid } from "../systems/worldBuilder";

/** Decor that hangs from the ceiling (origin at the top). */
const HANGING = new Set(["stalactite", "icicles"]);
/** Solid terrain materials that auto-tile against each other. */
const TERRAIN_T = new Set<T>([T.Regolith, T.Rock, T.Hull, T.Cave, T.FloorHatch, T.FrostRock, T.Ice, T.RidgeRock]);

export const DEPTH = {
  sky: -20,
  far: -19,
  mid: -18,
  near: -17,
  spire: -10,
  back: 0,
  propsBack: 4,
  props: 8,
  tiles: 10,
  pickups: 14,
  player: 20,
  shell: 25,
  secret: 26,
  fx: 30,
  ui: 40,
};

const hash = (c: number, r: number) => {
  let h = (c * 374761393 + r * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return h;
};

interface Parallax {
  sprite: Phaser.GameObjects.TileSprite;
  fx: number;
  fy: number;
  baseY: number;
}

export class WorldView {
  map!: Phaser.Tilemaps.Tilemap;
  fg!: Phaser.Tilemaps.TilemapLayer;
  private bg!: Phaser.Tilemaps.TilemapLayer;
  private secretLayer!: Phaser.Tilemaps.TilemapLayer;
  private parallax: Parallax[] = [];
  private shells: Array<{ img: Phaser.GameObjects.Image; rect: TileRect; inside: boolean }> = [];
  private secretRects: Array<{ id: string; rect: TileRect; inside: boolean }> = [];
  private grid: WorldGrid;
  private deckDark!: Phaser.GameObjects.Rectangle;
  private deckLamps: Phaser.GameObjects.Image[] = [];
  private prints: Phaser.GameObjects.Image[] = [];
  private printIndex = 0;
  /** Fired when Laika first steps into a secret area. */
  onSecretEntered: ((id: string) => void) | null = null;
  /** Phase 3: reflective decor (sits above the darkness; Lighting sets its alpha). */
  reflective: Phaser.GameObjects.Image[] = [];
  private particles: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private doorState = new Map<string, boolean>();

  constructor(
    private scene: Phaser.Scene,
    grid: WorldGrid,
    readonly mapDef: MapDef,
  ) {
    this.grid = { ...grid, fg: grid.fg.map((r) => r.slice()) };
  }

  get isSurface(): boolean {
    return this.mapDef.id === "surface";
  }

  get widthPx(): number {
    return this.grid.w * TILE;
  }
  get heightPx(): number {
    return this.grid.h * TILE;
  }

  create(opts: { hatchOpen: boolean; bridge: boolean; stationDoorOpen: boolean; floorHatchOpen: boolean; reducedMotion: boolean }): void {
    const s = this.scene;
    this.createParallax();
    for (const [id, d] of Object.entries(this.mapDef.doors)) this.doorState.set(`door:${id}`, d.tiles.every(([c, r]) => this.grid.fg[r][c] === T.Empty));
    for (const [id, b] of Object.entries(this.mapDef.bridges)) this.doorState.set(`bridge:${id}`, b.tiles.every(([c, r]) => this.grid.fg[r][c] === T.Bridge));
    this.map = s.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width: this.grid.w, height: this.grid.h });
    const ts = this.map.addTilesetImage("tiles", "tiles", TILE, TILE, 0, 0)!;
    this.bg = this.map.createBlankLayer("bg", ts)!.setDepth(DEPTH.back);
    this.fg = this.map.createBlankLayer("fg", ts)!.setDepth(DEPTH.tiles);
    this.secretLayer = this.map.createBlankLayer("secret", ts)!.setDepth(DEPTH.secret);

    if (this.isSurface) {
      if (opts.hatchOpen) for (const [c, r] of HATCH_TILES) this.grid.fg[r][c] = T.Empty;
      if (opts.stationDoorOpen) for (const [c, r] of STATION_DOOR_TILES) this.grid.fg[r][c] = T.Empty;
      if (opts.bridge) for (const [c, r] of BRIDGE_TILES) this.grid.fg[r][c] = T.Bridge;
      if (opts.floorHatchOpen) for (const [c, r] of FLOOR_HATCH_TILES) this.grid.fg[r][c] = T.Empty;
    }

    // Secret rooms count as solid rock for auto-tiling, so the rock around a hidden room shows no edge
    // outline that would give it away (the room's own clue is its "loose rock" / reflective mark).
    this.secretCells.clear();
    for (const sec of this.mapDef.secrets)
      for (let r = sec.rect.y0; r <= sec.rect.y1; r++) for (let c = sec.rect.x0; c <= sec.rect.x1; c++) this.secretCells.add(r * this.grid.w + c);
    for (let r = 0; r < this.grid.h; r++) {
      for (let c = 0; c < this.grid.w; c++) {
        const b = this.grid.bg[r][c];
        if (b !== B.None) this.bg.putTileAt(backIndex(b, hash(c, r) % 4), c, r);
        this.paintFg(c, r);
      }
    }
    this.refreshCollision();

    // Secret walls: draw the map's rock over the hidden room.
    const wall = this.mapDef.id === "depths" ? T.FrostRock : this.mapDef.id === "ridge" ? T.RidgeRock : T.Rock;
    for (const sec of this.mapDef.secrets) {
      for (let r = sec.rect.y0; r <= sec.rect.y1; r++)
        for (let c = sec.rect.x0; c <= sec.rect.x1; c++) this.secretLayer.putTileAt(this.rockIndex(wall, c, r), c, r);
      this.secretRects.push({ id: sec.id, rect: sec.rect, inside: false });
    }

    if (this.isSurface) this.createDecor();
    else this.createRegionDecor(opts.reducedMotion);
  }

  // ---------------- tiles ----------------

  private solidAt(c: number, r: number): boolean {
    if (c < 0 || c >= this.grid.w || r < 0 || r >= this.grid.h) return true;
    return TERRAIN_T.has(this.grid.fg[r][c]);
  }

  private paintFg(c: number, r: number): void {
    const t = this.grid.fg[r][c];
    if (t === T.Empty) {
      this.fg.removeTileAt(c, r);
      return;
    }
    let index: number;
    switch (t) {
      case T.Crate:
        index = specialIndex("crate");
        break;
      case T.Door:
        index = this.isSurface && c > 200 ? specialIndex("stationDoor") : specialIndex("door");
        break;
      case T.Shutter:
        index = special2Index("shutter");
        break;
      case T.IceLedge: {
        const same = (x: number) => this.grid.fg[r]?.[x] === t;
        const end = !same(c - 1) && !same(c + 1) ? "M" : !same(c - 1) ? "L" : !same(c + 1) ? "R" : "M";
        index = special2Index(`iceLedge${end}`);
        break;
      }
      case T.Bridge:
        index = specialIndex("bridge");
        break;
      case T.FloorHatch:
        index = specialIndex("floorHatch");
        break;
      case T.Ledge:
      case T.Scaffold: {
        const same = (x: number) => this.grid.fg[r]?.[x] === t;
        const kind = t === T.Ledge ? "ledge" : "scaffold";
        const end = !same(c - 1) && !same(c + 1) ? "M" : !same(c - 1) ? "L" : !same(c + 1) ? "R" : "M";
        index = specialIndex(`${kind}${end}` as "ledgeM");
        break;
      }
      default:
        index = this.rockIndex(t, c, r);
    }
    this.fg.putTileAt(index, c, r);
  }

  private readonly secretCells = new Set<number>();

  /** Solid for auto-tiling purposes: real solid tiles plus hidden secret rooms. */
  private looksSolid(c: number, r: number): boolean {
    return this.solidAt(c, r) || this.secretCells.has(r * this.grid.w + c);
  }

  /** Auto-tiled index for a terrain tile: edges on exposed sides, deeper shading under more rock. */
  private rockIndex(t: T, c: number, r: number): number {
    let mask = 0;
    if (!this.looksSolid(c, r - 1)) mask |= 1;
    if (!this.looksSolid(c + 1, r)) mask |= 2;
    if (!this.looksSolid(c, r + 1)) mask |= 4;
    if (!this.looksSolid(c - 1, r)) mask |= 8;
    let depth = 0;
    for (let y = r - 1; y >= 0 && depth < 4 && this.looksSolid(c, y); y--) depth++;
    return terrainIndex(t, mask, depth, hash(c, r) % 3);
  }

  /**
   * Sets collision flags and computes collision faces ourselves, so that one-way ledges never
   * hide the side faces of neighbouring solid tiles (which would let Laika clip into walls).
   */
  refreshCollision(): void {
    for (let r = 0; r < this.grid.h; r++) {
      for (let c = 0; c < this.grid.w; c++) {
        const tile = this.fg.getTileAt(c, r);
        if (!tile) continue;
        const t = this.grid.fg[r][c];
        if (isSolid(t)) {
          tile.setCollision(true, true, true, true, false);
          const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < this.grid.w && y < this.grid.h && isSolid(this.grid.fg[y][x]);
          tile.faceTop = !solid(c, r - 1);
          tile.faceBottom = !solid(c, r + 1);
          tile.faceLeft = !solid(c - 1, r);
          tile.faceRight = !solid(c + 1, r);
        } else {
          tile.setCollision(false, false, true, false, false);
          tile.faceTop = !(r > 0 && isSolid(this.grid.fg[r - 1][c]));
          tile.faceBottom = false;
          tile.faceLeft = false;
          tile.faceRight = false;
        }
      }
    }
  }

  private repaintAround(cells: Array<[number, number]>): void {
    const seen = new Set<string>();
    for (const [c, r] of cells) {
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const k = `${c + dx},${r + dy}`;
          if (seen.has(k)) continue;
          seen.add(k);
          if (c + dx >= 0 && r + dy >= 0 && c + dx < this.grid.w && r + dy < this.grid.h) this.paintFg(c + dx, r + dy);
        }
    }
    this.refreshCollision();
  }

  setTiles(cells: Array<[number, number]>, t: T): void {
    for (const [c, r] of cells) this.grid.fg[r][c] = t;
    this.repaintAround(cells);
  }

  isSolidPx(x: number, y: number): boolean {
    const c = Math.floor(x / TILE);
    const r = Math.floor(y / TILE);
    if (c < 0 || c >= this.grid.w || r < 0 || r >= this.grid.h) return false;
    return isSolid(this.grid.fg[r][c]);
  }

  // ---------------- parallax ----------------

  private createParallax(): void {
    const s = this.scene;
    const add = (key: string, depth: number, fx: number, fy: number, baseY: number) => {
      const sprite = s.add.tileSprite(0, 0, s.scale.width, VIEW_H, key).setOrigin(0, 0).setScrollFactor(0).setDepth(depth);
      this.parallax.push({ sprite, fx, fy, baseY });
    };
    const theme = this.mapDef.theme.backdrop;
    if (theme === "surface") {
      add("bg_sky", DEPTH.sky, 0.02, 0, 0);
      add("bg_far", DEPTH.far, 0.08, 0.08, 4);
      add("bg_mid", DEPTH.mid, 0.2, 0.2, 10);
      add("bg_near", DEPTH.near, 0.4, 0.4, 14);
    } else if (theme === "depths") {
      add("bgd_sky", DEPTH.sky, 0.02, 0, 0);
      add("bgd_far", DEPTH.far, 0.1, 0.05, 0);
      add("bgd_mid", DEPTH.mid, 0.25, 0.12, 0);
      add("bgd_near", DEPTH.near, 0.45, 0.2, 0);
    } else {
      // Echo Ridge is tall: small vertical factors keep the layers on screen at every height.
      add("bgr_sky", DEPTH.sky, 0.01, 0, 0);
      add("bgr_far", DEPTH.far, 0.05, 0.04, 6);
      add("bgr_mid", DEPTH.mid, 0.15, 0.08, 16);
      add("bgr_near", DEPTH.near, 0.35, 0.14, 26);
    }
  }

  updateParallax(cam: Phaser.Cameras.Scene2D.Camera): void {
    const refY = this.mapDef.theme.refY;
    for (const p of this.parallax) {
      p.sprite.tilePositionX = Math.round(cam.scrollX * p.fx);
      p.sprite.y = Math.round(p.baseY - (cam.scrollY - refY) * p.fy);
    }
  }

  // ---------------- shells, secrets, decor ----------------

  private createDecor(): void {
    const s = this.scene;
    const img = (x: number, y: number, key: string, depth: number, ox = 0.5, oy = 1) => s.add.image(x, y, key).setOrigin(ox, oy).setDepth(depth);

    // Distant landmark: the Red Spire behind the canyon.
    img(104 * TILE, 28 * TILE + 8, "spire", DEPTH.spire).setScrollFactor(0.92, 1);
    img(170 * TILE, 28 * TILE + 30, "spire", DEPTH.spire).setScrollFactor(0.9, 1).setScale(0.7, 0.55).setAlpha(0.85);

    // Spacecraft: always-visible parts and the fading shell (two decks).
    img(48, 24 * TILE - 2, "ship_engine", DEPTH.props, 1, 1);
    img(300, 6 * TILE, "ship_antenna", DEPTH.props, 0.5, 1);
    const ship = INTERIORS.ship;
    this.shells.push({ img: img(ship.x0 * TILE, ship.y0 * TILE, "ship_shell", DEPTH.shell, 0, 0), rect: ship, inside: false });
    // Upper deck: Laika's quarters and the training bay (Mission 00).
    img(5 * TILE + 8, 14 * TILE, "ship_bed", DEPTH.propsBack);
    img(7 * TILE + 12, 14 * TILE, "food_bowl", DEPTH.propsBack);
    img(6 * TILE, 10 * TILE, "poster", DEPTH.propsBack, 0.5, 0.5);
    img(9 * TILE + 8, 14 * TILE, "shelf", DEPTH.propsBack);
    img(280, 150, "ship_window", DEPTH.propsBack, 0.5, 0.5);
    img(12 * TILE + 2, 14 * TILE, "landing_marker", DEPTH.propsBack + 1, 0, 1);
    img(18 * TILE + 4, 14 * TILE, "soil_tray", DEPTH.propsBack, 0.5, 1);
    for (const c of [8, 17]) {
      const lamp = img(c * TILE + 8, 8 * TILE, "tunnel_lamp", DEPTH.propsBack, 0.5, 0).setTint(0x888888);
      const glow = img(c * TILE + 8, 8 * TILE + 10, "glow", DEPTH.fx, 0.5, 0.5).setTint(0xffe0a0).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.deckLamps.push(lamp, glow);
    }
    // The training bay starts dim: repairing the fan in Mission 00 brings the lights back.
    this.deckDark = s.add.rectangle(4 * TILE, 8 * TILE, 19 * TILE, 6 * TILE, 0x0a0610, 0.42).setOrigin(0, 0).setDepth(DEPTH.props + 1);
    // Lower deck: cockpit and cargo bay (Mission 01 starts here).
    img(5 * TILE + 8, 22 * TILE, "cockpit_panel", DEPTH.propsBack);
    img(280, 278, "ship_window", DEPTH.propsBack, 0.5, 0.5);
    img(18 * TILE + 8, 22 * TILE, "storage_box", DEPTH.propsBack);
    img(18 * TILE + 8, 22 * TILE - 13, "storage_box", DEPTH.propsBack).setFlipX(true);
    img(13 * TILE, 17 * TILE, "glow", DEPTH.propsBack, 0.5, 0.5).setTint(0xff8a6e).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD);

    // Research station.
    const st = INTERIORS.station;
    img(226 * TILE, st.y0 * TILE + 6, "station_dish", DEPTH.props, 0.5, 1);
    this.shells.push({ img: img(st.x0 * TILE, st.y0 * TILE, "station_shell", DEPTH.shell, 0, 0), rect: st, inside: false });
    img(224 * TILE, 24 * TILE, "shelf", DEPTH.propsBack);
    img(229 * TILE + 8, 24 * TILE, "desk", DEPTH.propsBack);
    img(233 * TILE + 8, 24 * TILE, "locker", DEPTH.propsBack);
    img(228 * TILE, 20 * TILE, "plant", DEPTH.propsBack);

    // Outpost lamps (lit by GameScene when power returns) are created by ObjectsView.

    // Rocks scattered with intent: framing landmarks, never blocking paths (decor only).
    const rocks: Array<[number, number, string]> = [
      [29, 24, "rock_m"],
      [35, 24, "rock_s"],
      [50, 24, "rock_s"],
      [67, 24, "rock_m"],
      [81, 24, "rock_s"],
      [91, 24, "rock_l"],
      [103, 28, "rock_m"],
      [110, 28, "rock_s"],
      [125, 28, "rock_l"],
      [139, 24, "rock_s"],
      [155, 28, "rock_m"],
      [163, 28, "rock_s"],
      [172, 28, "rock_l"],
      [183, 28, "rock_s"],
      [194, 24, "rock_m"],
      [213, 24, "rock_m"],
      [237, 24, "rock_s"],
    ];
    for (const [c, r, key] of rocks) img(c * TILE + 8, r * TILE + 1, key, DEPTH.propsBack);
    // Cave crystals with a soft glow (atmospheric lighting underground).
    for (const [c, r] of [
      [126, 31],
      [134, 31],
      [143, 31],
      [108, 31],
      [204, 33],
    ]) {
      img(c * TILE + 8, r * TILE, "crystal", DEPTH.propsBack);
      const g = img(c * TILE + 8, r * TILE - 4, "glow", DEPTH.propsBack, 0.5, 0.5).setTint(0x6fe0d0).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
      s.tweens.add({ targets: g, alpha: 0.15, duration: 1800, yoyo: true, repeat: -1, ease: "Sine.easeInOut", delay: c * 37 });
    }
    // Chasm warning sign.
    img(198 * TILE + 8, 24 * TILE, "sign_warn", DEPTH.propsBack);

    // ---- Phase 2 environmental guidance (signs, light and tracks, never giant arrows) ----
    // The pit: a sign says both routes are fine; the tunnel is lit and its exit glows.
    img(110 * TILE + 8, 28 * TILE, "sign_pit", DEPTH.propsBack);
    img(121 * TILE + 8, 31 * TILE, "sign_tunnel", DEPTH.propsBack);
    for (const c of [125, 131, 137, 143, 148]) {
      const row = c >= 133 && c <= 146 ? 27 : 29;
      img(c * TILE + 8, row * TILE, "tunnel_lamp", DEPTH.propsBack, 0.5, 0);
      const g = img(c * TILE + 8, row * TILE + 12, "glow", DEPTH.propsBack, 0.5, 0.5).setTint(0xffd27a).setAlpha(0.45).setBlendMode(Phaser.BlendModes.ADD);
      s.tweens.add({ targets: g, alpha: 0.3, duration: 1400 + c * 7, yoyo: true, repeat: -1 });
    }
    // Daylight spilling into the exit shaft.
    img(151 * TILE, 29 * TILE, "glow", DEPTH.propsBack, 0.5, 0.5).setTint(0xffc890).setScale(1.6, 2.2).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD);
    // Rover R-2's wheel tracks lead from the tunnel exit to the wreck.
    s.add.tileSprite(152 * TILE, 28 * TILE + 2, 22 * TILE, 3, "rover_tracks").setOrigin(0, 0).setDepth(DEPTH.tiles + 1).setAlpha(0.8);

    // Footprint pool (reused, never allocates during play).
    for (let i = 0; i < 40; i++) this.prints.push(s.add.image(0, 0, "pawprint").setDepth(DEPTH.tiles + 1).setVisible(false));
  }

  /** Leaves a pawprint in soft ground (regolith, rock, frost or ridge dust), which fades after a few seconds. */
  addFootprint(x: number, feetY: number): void {
    const c = Math.floor(x / TILE);
    const r = Math.floor((feetY + 2) / TILE);
    const t = this.grid.fg[r]?.[c];
    if (t !== T.Regolith && t !== T.Rock && t !== T.FrostRock && t !== T.RidgeRock) return;
    if (this.prints.length === 0) return;
    const img = this.prints[this.printIndex++ % this.prints.length];
    this.scene.tweens.killTweensOf(img);
    img.setPosition(Math.round(x), Math.round(feetY) + 1).setVisible(true).setAlpha(0.85);
    this.scene.tweens.add({ targets: img, alpha: 0, delay: 5000, duration: 2000, onComplete: () => img.setVisible(false) });
  }

  /** Mission 00: dark until the fan is repaired. */
  setUpperDeckLit(lit: boolean, animated: boolean): void {
    if (!this.isSurface || !this.deckDark) return;
    this.scene.tweens.killTweensOf(this.deckDark);
    if (animated) this.scene.tweens.add({ targets: this.deckDark, alpha: lit ? 0 : 0.42, duration: 900 });
    else this.deckDark.setAlpha(lit ? 0 : 0.42);
    for (let i = 0; i < this.deckLamps.length; i += 2) {
      const lamp = this.deckLamps[i];
      const glow = this.deckLamps[i + 1];
      if (lit) lamp.clearTint();
      else lamp.setTint(0x888888);
      this.scene.tweens.killTweensOf(glow);
      if (animated && lit) this.scene.tweens.add({ targets: glow, alpha: 0.5, duration: 600, delay: 200 + i * 150 });
      else glow.setAlpha(lit ? 0.5 : 0);
    }
  }

  setFloorHatch(open: boolean): void {
    if (!this.isSurface) return;
    this.setTiles(FLOOR_HATCH_TILES, open ? T.Empty : T.FloorHatch);
  }

  /** Inside a tunnel or cave (used by the camera). */
  isUnderground(x: number, y: number): boolean {
    if (this.mapDef.id === "depths") return true;
    if (this.mapDef.id === "ridge") return false;
    const c = Math.floor(x / TILE);
    const r = Math.floor(y / TILE);
    return this.grid.bg[r]?.[c] === B.Cave && r > 24;
  }

  /** Fades building shells and secret walls depending on where Laika is. */
  updateFades(px: number, py: number, reducedMotion: boolean): void {
    const inRect = (r: TileRect, pad = 0) => px >= r.x0 * TILE - pad && px < (r.x1 + 1) * TILE + pad && py > r.y0 * TILE && py <= (r.y1 + 1) * TILE + 4;
    for (const sh of this.shells) {
      const inside = inRect(sh.rect);
      if (inside === sh.inside) continue;
      sh.inside = inside;
      this.scene.tweens.killTweensOf(sh.img);
      if (reducedMotion) sh.img.setAlpha(inside ? 0 : 1);
      else this.scene.tweens.add({ targets: sh.img, alpha: inside ? 0 : 1, duration: 260 });
    }
    for (const sec of this.secretRects) {
      const inside = inRect(sec.rect);
      if (inside === sec.inside) continue;
      sec.inside = inside;
      const target = inside ? 0.12 : 1;
      if (reducedMotion) this.secretLayer.setAlpha(target);
      else this.scene.tweens.add({ targets: this.secretLayer, alpha: target, duration: 300 });
      if (inside) this.onSecretEntered?.(sec.id);
    }
  }

  isInside(which: "ship" | "station", px: number, py: number): boolean {
    if (!this.isSurface) return false;
    const r = INTERIORS[which];
    return px >= r.x0 * TILE && px < (r.x1 + 1) * TILE && py > r.y0 * TILE && py <= (r.y1 + 1) * TILE + 4;
  }

  // ---------------- Phase 3: region decor, doors and bridges ----------------

  private createRegionDecor(reducedMotion: boolean): void {
    const s = this.scene;
    for (const d of this.mapDef.decor) {
      const hang = HANGING.has(d.key);
      const img = s.add
        .image(d.col * TILE + 8 + (d.dx ?? 0), d.row * TILE + (d.dy ?? 0) + (hang ? 0 : 1), d.key)
        .setOrigin(0.5, hang ? 0 : 1)
        .setDepth(d.reflective ? DEPTH.player + 3 : d.front ? DEPTH.props + 1 : DEPTH.propsBack - 1);
      if (d.flip) img.setFlipX(true);
      if (d.scroll) img.setScrollFactor(d.scroll[0], d.scroll[1]);
      if (d.alpha !== undefined) img.setAlpha(d.alpha);
      if (d.scale) img.setScale(d.scale);
      if (d.key === "tower_frame") img.setDepth(DEPTH.back + 1);
      if (d.reflective) {
        img.setAlpha(0);
        this.reflective.push(img);
      }
    }
    if (this.mapDef.id === "ridge") {
      // The relay tower, far away but always in view: the destination is visible before it is reached.
      // Screen x = 400 - scrollX * 0.3: upper right of the first screen, drifting left as Laika climbs east.
      s.add.image(400, 380, "tower_far").setOrigin(0.5, 1).setScrollFactor(0.3, 0.3).setDepth(DEPTH.spire).setAlpha(0.95);
      const blink = s.add.image(400, 262, "glow").setScrollFactor(0.3, 0.3).setDepth(DEPTH.spire + 1).setTint(0xff5040).setBlendMode(Phaser.BlendModes.ADD).setScale(0.35);
      if (!reducedMotion) s.tweens.add({ targets: blink, alpha: 0.15, duration: 700, yoyo: true, repeat: -1 });
    }
    // Atmosphere: drifting frost motes underground, wind-blown dust on the ridge.
    const theme = this.mapDef.theme.particles;
    if (theme && !reducedMotion) {
      const dust = theme === "dust";
      this.particles = s.add.particles(0, 0, dust ? "px_dust" : "px_frost", {
        x: { min: 0, max: VIEW_W },
        y: { min: 0, max: VIEW_H },
        speedX: dust ? { min: 30, max: 70 } : { min: -4, max: 4 },
        speedY: dust ? { min: -4, max: 6 } : { min: 3, max: 9 },
        lifespan: dust ? 5000 : 7000,
        alpha: { start: dust ? 0.6 : 0.5, end: 0 },
        frequency: dust ? 160 : 260,
        quantity: 1,
      });
      this.particles.setScrollFactor(0).setDepth(DEPTH.fx - 1);
    }
    for (let i = 0; i < 40; i++) this.prints.push(s.add.image(0, 0, "pawprint").setDepth(DEPTH.tiles + 1).setVisible(false));
  }

  /**
   * Opens doors / extends bridges whose state changed. Returns the groups that changed, so the
   * scene can add sound and camera beats. `animate` builds bridges tile by tile.
   */
  syncGroups(st: GameState, animate: boolean, onTile?: (c: number, r: number, i: number, n: number) => void): string[] {
    const changed: string[] = [];
    for (const [id, d] of Object.entries(this.mapDef.doors)) {
      const open = d.when(st);
      if (open === this.doorState.get(`door:${id}`)) continue;
      this.doorState.set(`door:${id}`, open);
      this.setTiles(d.tiles, open ? T.Empty : T.Shutter);
      changed.push(`door:${id}`);
    }
    for (const [id, b] of Object.entries(this.mapDef.bridges)) {
      const out = b.when(st);
      if (out === this.doorState.get(`bridge:${id}`)) continue;
      this.doorState.set(`bridge:${id}`, out);
      changed.push(`bridge:${id}`);
      if (!animate || !out) this.setTiles(b.tiles, out ? T.Bridge : T.Empty);
      else
        b.tiles.forEach(([c, r], i) =>
          this.scene.time.delayedCall(200 + i * 110, () => {
            this.setTiles([[c, r]], T.Bridge);
            onTile?.(c, r, i, b.tiles.length);
          }),
        );
    }
    return changed;
  }
}
