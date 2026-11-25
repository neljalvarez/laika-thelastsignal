/**
 * Renders the world: tilemap layers with collision, parallax sky, building shells that fade
 * when Laika walks inside, secret walls, decorations, and the doors / bridge that change at
 * runtime. Simulation state lives elsewhere; this only shows it.
 */
import Phaser from "phaser";
import { TILE, VIEW_H } from "../config/constants";
import { backIndex, specialIndex, terrainIndex } from "../art/tiles";
import { B, BRIDGE_TILES, HATCH_TILES, INTERIORS, SECRETS, STATION_DOOR_TILES, T, type TileRect } from "../data/world";
import { isSolid, type WorldGrid } from "../systems/worldBuilder";

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
  /** Fired when Laika first steps into a secret area. */
  onSecretEntered: ((id: string) => void) | null = null;

  constructor(
    private scene: Phaser.Scene,
    grid: WorldGrid,
  ) {
    this.grid = { ...grid, fg: grid.fg.map((r) => r.slice()) };
  }

  get widthPx(): number {
    return this.grid.w * TILE;
  }
  get heightPx(): number {
    return this.grid.h * TILE;
  }

  create(opts: { hatchOpen: boolean; bridge: boolean; stationDoorOpen: boolean; reducedMotion: boolean }): void {
    const s = this.scene;
    this.createParallax();
    this.map = s.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width: this.grid.w, height: this.grid.h });
    const ts = this.map.addTilesetImage("tiles", "tiles", TILE, TILE, 0, 0)!;
    this.bg = this.map.createBlankLayer("bg", ts)!.setDepth(DEPTH.back);
    this.fg = this.map.createBlankLayer("fg", ts)!.setDepth(DEPTH.tiles);
    this.secretLayer = this.map.createBlankLayer("secret", ts)!.setDepth(DEPTH.secret);

    if (opts.hatchOpen) for (const [c, r] of HATCH_TILES) this.grid.fg[r][c] = T.Empty;
    if (opts.stationDoorOpen) for (const [c, r] of STATION_DOOR_TILES) this.grid.fg[r][c] = T.Empty;
    if (opts.bridge) for (const [c, r] of BRIDGE_TILES) this.grid.fg[r][c] = T.Bridge;

    for (let r = 0; r < this.grid.h; r++) {
      for (let c = 0; c < this.grid.w; c++) {
        const b = this.grid.bg[r][c];
        if (b !== B.None) this.bg.putTileAt(backIndex(b, hash(c, r) % 4), c, r);
        this.paintFg(c, r);
      }
    }
    this.refreshCollision();

    // Secret walls: draw rock over the hidden room.
    for (const sec of SECRETS) {
      for (let r = sec.rect.y0; r <= sec.rect.y1; r++)
        for (let c = sec.rect.x0; c <= sec.rect.x1; c++) this.secretLayer.putTileAt(terrainIndex(T.Rock, 0, 3, hash(c, r) % 3), c, r);
      this.secretRects.push({ id: sec.id, rect: sec.rect, inside: false });
    }

    this.createDecor();
  }

  // ---------------- tiles ----------------

  private solidAt(c: number, r: number): boolean {
    if (c < 0 || c >= this.grid.w || r < 0 || r >= this.grid.h) return true;
    const t = this.grid.fg[r][c];
    return t === T.Regolith || t === T.Rock || t === T.Hull || t === T.Cave;
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
        index = c > 200 ? specialIndex("stationDoor") : specialIndex("door");
        break;
      case T.Bridge:
        index = specialIndex("bridge");
        break;
      case T.Ledge:
      case T.Scaffold: {
        const same = (x: number) => this.grid.fg[r]?.[x] === t;
        const kind = t === T.Ledge ? "ledge" : "scaffold";
        const end = !same(c - 1) && !same(c + 1) ? "M" : !same(c - 1) ? "L" : !same(c + 1) ? "R" : "M";
        index = specialIndex(`${kind}${end}` as "ledgeM");
        break;
      }
      default: {
        let mask = 0;
        if (!this.solidAt(c, r - 1)) mask |= 1;
        if (!this.solidAt(c + 1, r)) mask |= 2;
        if (!this.solidAt(c, r + 1)) mask |= 4;
        if (!this.solidAt(c - 1, r)) mask |= 8;
        let depth = 0;
        for (let y = r - 1; y >= 0 && depth < 4 && this.solidAt(c, y); y--) depth++;
        index = terrainIndex(t, mask, depth, hash(c, r) % 3);
      }
    }
    this.fg.putTileAt(index, c, r);
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
    add("bg_sky", DEPTH.sky, 0.02, 0, 0);
    add("bg_far", DEPTH.far, 0.08, 0.08, 4);
    add("bg_mid", DEPTH.mid, 0.2, 0.2, 10);
    add("bg_near", DEPTH.near, 0.4, 0.4, 14);
  }

  updateParallax(cam: Phaser.Cameras.Scene2D.Camera): void {
    const refY = 210;
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

    // Spacecraft: always-visible parts and the fading shell.
    img(48, 24 * TILE - 2, "ship_engine", DEPTH.props, 1, 1);
    img(300, 14 * TILE, "ship_antenna", DEPTH.props, 0.5, 1);
    const ship = INTERIORS.ship;
    this.shells.push({ img: img(ship.x0 * TILE, ship.y0 * TILE, "ship_shell", DEPTH.shell, 0, 0), rect: ship, inside: false });
    // Ship interior props.
    img(5 * TILE + 8, 22 * TILE, "ship_bed", DEPTH.propsBack);
    img(7 * TILE + 12, 22 * TILE, "food_bowl", DEPTH.propsBack);
    img(6 * TILE, 18 * TILE, "poster", DEPTH.propsBack, 0.5, 0.5);
    img(280, 278, "ship_window", DEPTH.propsBack, 0.5, 0.5);
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
    const r = INTERIORS[which];
    return px >= r.x0 * TILE && px < (r.x1 + 1) * TILE && py > r.y0 * TILE && py <= (r.y1 + 1) * TILE + 4;
  }
}
