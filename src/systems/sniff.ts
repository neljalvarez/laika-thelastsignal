/**
 * The suit scanner ("sniff"). Pure detection logic.
 * A sniff finds hidden things within SNIFF_RADIUS and returns their direction and strength,
 * so the scene can draw arrows and play pings. Only spots within SNIFF_REVEAL_RADIUS become
 * diggable: the player still has to walk over and investigate.
 */
import { SNIFF_RADIUS, SNIFF_REVEAL_RADIUS } from "../config/constants";
import { objectPos, type WorldObject } from "../data/world";
import type { GameState } from "./state";

export interface Detection {
  id: string;
  kind: "buried" | "secret";
  dx: number;
  dy: number;
  dist: number;
  /** 1 = right here, 0 = edge of range. */
  strength: number;
  revealed: boolean;
}

export function sniffableObjects(objects: WorldObject[], s: GameState): WorldObject[] {
  return objects.filter(
    (o) => (o.kind === "buried" && !s.collected.includes(o.id)) || (o.kind === "secret" && !s.seen.includes(o.id)),
  );
}

export function sniff(px: number, py: number, objects: WorldObject[], s: GameState, radius = SNIFF_RADIUS, reveal = SNIFF_REVEAL_RADIUS): Detection[] {
  const out: Detection[] = [];
  for (const o of sniffableObjects(objects, s)) {
    const p = objectPos(o);
    const dx = p.x - px;
    // Compare against the item's surface point; vertical distance counts less (things are underfoot).
    const dy = p.y - 8 - py;
    const dist = Math.hypot(dx, dy * 0.75);
    if (dist > radius) continue;
    out.push({
      id: o.id,
      kind: o.kind === "secret" ? "secret" : "buried",
      dx,
      dy,
      dist,
      strength: 1 - dist / radius,
      revealed: dist <= reveal,
    });
  }
  return out.sort((a, b) => a.dist - b.dist);
}
