/**
 * Phase 4: suit energy, a forgiving, fictional rechargeable supply for OPTIONAL powered equipment.
 *
 * - Walking, jumping, interacting, Bark and the Headlamp never cost energy.
 * - Thruster Boots' air jump and the suit-boosted second air jump cost energy; with too little
 *   energy they simply do not fire (every mandatory route works without them: see the tests).
 * - Scanner pulses cost a little; at zero the scanner still works at short range, and the reveal
 *   radius is unchanged, so no dig spot can become unreachable.
 * - A reserve cell trickles energy back after a few seconds without powered equipment, up to a
 *   mode-dependent level, so Laika is never stuck far from a recharge station.
 * - Suit energy only matters once Mission 04 has started (`m4Briefed`); Missions 00-03 play exactly
 *   as before. In Relaxed mode nothing costs energy at all.
 */
import { SUIT, type SurvivalMode } from "../data/engineering";
import { GEAR } from "../data/equipment";
import { gearReady, type GameState } from "./state";

/** Phase 5: the Reserve Battery raises the suit's capacity. */
export function suitMaxOf(s: GameState): number {
  return gearReady(s, "reserveBattery") ? GEAR.reserveSuitMax : SUIT.max;
}

/** Phase 5: what a use costs THIS Laika (the Thruster Upgrade halves thruster and boost costs). */
export function costFor(s: GameState, use: SuitUse, mode: SurvivalMode): number {
  const base = suitCost(use, mode);
  return use !== "scan" && gearReady(s, "efficientBoots") ? base * GEAR.efficientCostFactor : base;
}

export type SuitUse = "thrust" | "boost" | "scan";

export function suitActive(s: GameState): boolean {
  return s.flags.m4Briefed;
}

export function suitCost(use: SuitUse, mode: SurvivalMode): number {
  return use === "thrust" ? SUIT.thrustCost[mode] : use === "boost" ? SUIT.boostCost[mode] : SUIT.scanCost[mode];
}

export function canUse(s: GameState, use: SuitUse, mode: SurvivalMode): boolean {
  if (!suitActive(s)) return use !== "boost"; // the boost is a Phase 4 suit feature
  return s.eng.suit >= costFor(s, use, mode);
}

/** Spends energy for a use if possible. Returns false (and changes nothing) if there is not enough. */
export function spend(s: GameState, use: SuitUse, mode: SurvivalMode): boolean {
  if (!canUse(s, use, mode)) return false;
  if (suitActive(s)) s.eng.suit = clampSuit(s.eng.suit - costFor(s, use, mode), suitMaxOf(s));
  return true;
}

/**
 * How many air jumps the movement controller may allow, given how many were already used in this
 * jump. 0 without Thruster Boots. Before Mission 04 the boots give one air jump, exactly as in
 * Phases 1-3. From Mission 04 the suit adds a boosted second air jump. Each further jump is only
 * allowed if the suit can pay for it right now; the scene pays when the "airJump" event fires.
 */
export function airJumpLimit(s: GameState, mode: SurvivalMode, used: number): number {
  if (!s.abilities.thrusters) return 0;
  const maxJumps = suitActive(s) ? 2 : 1;
  if (used >= maxJumps) return maxJumps;
  return canUse(s, used === 0 ? "thrust" : "boost", mode) ? used + 1 : used;
}

/** The suit use an air jump number (1 = first, 2 = second) costs. */
export function airJumpUse(n: number): SuitUse {
  return n <= 1 ? "thrust" : "boost";
}

/** Scanner radius multiplier (Expedition gear is a little less efficient; empty suit = short range). */
export function scanRadiusFactor(s: GameState, mode: SurvivalMode): number {
  if (!suitActive(s)) return 1;
  let f = mode === "expedition" ? 0.85 : 1;
  if (s.eng.suit < costFor(s, "scan", mode)) f *= SUIT.scanFallbackRadius;
  return f;
}

export function recharge(s: GameState): void {
  s.eng.suit = suitMaxOf(s);
}

/** Runtime-only reserve-cell timer (not saved). */
export class SuitReserve {
  sinceUseMs = 0;
  used(): void {
    this.sinceUseMs = 0;
  }
  /** Call with active-play time only. Returns true if energy changed. */
  tick(s: GameState, mode: SurvivalMode, dtMs: number): boolean {
    if (!suitActive(s)) return false;
    this.sinceUseMs += dtMs;
    const max = suitMaxOf(s);
    const cap = mode === "relaxed" ? max : SUIT.reserveLevel[mode] + (gearReady(s, "reserveBattery") ? GEAR.reserveFloorBonus : 0);
    if (mode === "relaxed") {
      if (s.eng.suit < max) {
        s.eng.suit = max;
        return true;
      }
      return false;
    }
    if (s.eng.suit >= cap || this.sinceUseMs < SUIT.reserveDelayMs) return false;
    s.eng.suit = Math.min(cap, s.eng.suit + (SUIT.reservePerSecond * dtMs) / 1000);
    return true;
  }
}

export function clampSuit(v: number, max: number = SUIT.max): number {
  return Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : max;
}

export const SURVIVAL_LABELS: Record<SurvivalMode, { name: string; help: string }> = {
  relaxed: { name: "Relaxed", help: "No suit energy to watch." },
  adventure: { name: "Adventure", help: "Thrusters use some energy." },
  expedition: { name: "Expedition", help: "Plan your energy." },
};
