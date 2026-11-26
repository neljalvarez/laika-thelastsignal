/**
 * The suit scanner ("sniff"). Pure detection logic.
 *
 * A sniff finds hidden things within range and returns their direction and strength. After a
 * sniff the scene keeps TRACKING the nearest signal for a few seconds, so the player can follow
 * it ("warmer / colder") without pressing the button again. Only spots within the reveal radius
 * become diggable: the player still has to walk over and investigate.
 *
 * Fiction: Mars has almost no air, so Laika's suit carries a scientific sensor that "sniffs"
 * for buried metal, electronics and radio signals on her behalf.
 */
import { SNIFF_RADIUS, SNIFF_REVEAL_RADIUS } from "../config/constants";
import { objectPos, type WorldObject } from "../data/world";
import { gearReady, type GameState } from "./state";

export interface SniffTarget {
  id: string;
  kind: "buried" | "secret" | "practice";
  x: number;
  y: number;
  /** Mission-critical: gets a longer range when the player is struggling. */
  critical: boolean;
}

export interface Detection {
  id: string;
  kind: SniffTarget["kind"];
  dx: number;
  dy: number;
  dist: number;
  /** 1 = right here, 0 = edge of range. */
  strength: number;
  revealed: boolean;
}

export type SignalLevel = "none" | "weak" | "strong" | "located";

export const STRONG_RADIUS = 100;

const CRITICAL_ITEMS = new Set(["commsModule", "metal", "electronics"]);

export function sniffableObjects(objects: WorldObject[], s: GameState): WorldObject[] {
  return objects.filter(
    (o) => gearReady(s, o.needs) && ((o.kind === "buried" && !s.collected.includes(o.id)) || (o.kind === "secret" && !s.seen.includes(o.id))),
  );
}

/** Builds the list of hidden targets. `practice` adds Mission 00's buried component. */
export function sniffTargets(objects: WorldObject[], s: GameState, practice?: { id: string; active: boolean }): SniffTarget[] {
  const out: SniffTarget[] = sniffableObjects(objects, s).map((o) => {
    const p = objectPos(o);
    return { id: o.id, kind: o.kind === "secret" ? "secret" : "buried", x: p.x, y: p.y, critical: CRITICAL_ITEMS.has(o.item ?? "") };
  });
  if (practice?.active) {
    const o = objects.find((x) => x.id === practice.id);
    if (o) {
      const p = objectPos(o);
      out.push({ id: o.id, kind: "practice", x: p.x, y: p.y, critical: true });
    }
  }
  return out;
}

/** Detects targets around (px, py). `boost` widens the range for critical targets (adaptive help). */
export function detect(px: number, py: number, targets: SniffTarget[], radius = SNIFF_RADIUS, reveal = SNIFF_REVEAL_RADIUS, boost = 1): Detection[] {
  const out: Detection[] = [];
  for (const t of targets) {
    const dx = t.x - px;
    // Compare against the item's surface point; vertical distance counts less (things are underfoot).
    const dy = t.y - 8 - py;
    const dist = Math.hypot(dx, dy * 0.75);
    const r = t.critical ? radius * boost : radius;
    if (dist > r) continue;
    out.push({ id: t.id, kind: t.kind, dx, dy, dist, strength: 1 - dist / r, revealed: dist <= reveal });
  }
  return out.sort((a, b) => a.dist - b.dist);
}

/** Classic API (used by Phase 1 code and tests). */
export function sniff(px: number, py: number, objects: WorldObject[], s: GameState, radius = SNIFF_RADIUS, reveal = SNIFF_REVEAL_RADIUS): Detection[] {
  return detect(px, py, sniffTargets(objects, s), radius, reveal);
}

/** Four distinguishable feedback states (shown as bars + words, never colour alone). */
export function signalLevel(dist: number | null, reveal = SNIFF_REVEAL_RADIUS, radius = SNIFF_RADIUS): SignalLevel {
  if (dist === null || dist > radius) return "none";
  if (dist <= reveal) return "located";
  if (dist <= STRONG_RADIUS) return "strong";
  return "weak";
}

/** "warmer" / "colder" / "steady" between two distance readings. */
export function trend(prev: number | null, now: number | null): "warmer" | "colder" | "steady" {
  if (prev === null || now === null) return "steady";
  if (now < prev - 2) return "warmer";
  if (now > prev + 2) return "colder";
  return "steady";
}
