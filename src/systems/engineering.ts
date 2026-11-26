/**
 * Phase 4: the outpost's power and growth simulation. Pure TypeScript, no Phaser, no DOM.
 *
 * Timing: GameScene feeds real elapsed time into an EngineClock, which advances the simulation in
 * fixed ENGINEERING.stepMs steps (at most maxStepsPerFrame per frame), so the result is identical at
 * 30, 60 or 144 fps and a long hitch never fast-forwards the base. The scene only ticks the clock
 * during active play: never while paused, in menus, during transmissions, the tutorial or
 * cutscenes, or while the tab is hidden, and never while the game is closed (no offline depletion).
 *
 * Every value is clamped: the battery stays in 0..capacity, growth stops at maturity, suit energy
 * stays in 0..max. A shortage only switches optional machines off; it never clears a restoration
 * flag or a mission.
 */
import { CONSUMERS, ENGINEERING, FACILITIES, OPTIONAL_SYSTEMS, type FacilityId, type OptionalSystem, type SurvivalMode } from "../data/engineering";
import { isPowered, SOLAR_PANELS, type GameState } from "./state";

export interface PowerStatus {
  /** Sunlight factor (1 = clear sky; lower during the Lights Out haze). */
  sun: number;
  /** PU generated right now. */
  gen: number;
  /** PU that switched-on machines ask for. */
  requested: number;
  /** PU actually used (after any brownout). */
  use: number;
  /** gen - use: positive charges the battery, negative drains it. */
  net: number;
  battery: number;
  capacity: number;
  storage: boolean;
  /** Which consumers are running right now. */
  powered: Record<FacilityId, boolean>;
  /** Which facilities are restored (permanent). */
  restored: Record<FacilityId, boolean>;
  /** Optional systems switched off by a brownout (battery empty, not enough sun). */
  brownout: OptionalSystem[];
  /** 1 charging, -1 draining, 0 steady / full / empty-and-balanced. */
  trend: -1 | 0 | 1;
  haze: boolean;
}

/** Permanent restoration milestones per facility. */
export function isRestored(s: GameState, id: FacilityId): boolean {
  const f = s.flags;
  switch (id) {
    case "solar":
      return f.solarRepaired;
    case "battery":
      return f.batteryRestored;
    case "habitat":
      return f.batteryRestored;
    case "lifeSupport":
      return f.recyclerOn;
    case "shelter":
      return f.shelterRestored;
    case "water":
      return f.waterRestored;
    case "greenhouse":
      return f.growLightsOn;
    case "research":
      return isPowered(s);
  }
}

/** The six systems Mission 04 restores (solar is Mission 01's). */
export const BASE_SYSTEMS: FacilityId[] = ["battery", "lifeSupport", "water", "greenhouse", "shelter", "habitat"];

export function restorationProgress(s: GameState): { done: number; total: number } {
  const steps = [s.flags.batteryRestored, s.flags.recyclerOn, s.flags.waterRestored, s.flags.seedsPlanted && s.flags.growLightsOn, s.flags.shelterRestored, s.flags.lightsOutDone];
  return { done: steps.filter(Boolean).length, total: steps.length };
}

export function allFacilitiesRestored(s: GameState): boolean {
  const f = s.flags;
  return f.batteryRestored && f.recyclerOn && f.waterRestored && f.seedsPlanted && f.growLightsOn && f.shelterRestored;
}

export function hazeActive(s: GameState): boolean {
  return s.flags.lightsOutStarted && !s.flags.lightsOutBalanced;
}

export function capacity(mode: SurvivalMode): number {
  return ENGINEERING.batteryCapacity[mode];
}

export function sunFactor(s: GameState, mode: SurvivalMode): number {
  return hazeActive(s) ? ENGINEERING.hazeSun[mode] : 1;
}

/** PU from the array: clean panels give full output, Lights Out dust leaves a trickle. */
export function generation(s: GameState, mode: SurvivalMode): number {
  if (!s.flags.solarRepaired) return 0;
  let pu = 0;
  for (const p of SOLAR_PANELS) {
    if (!s.sweptPanels.includes(p)) continue;
    pu += s.eng.dusty.includes(p) ? ENGINEERING.dustyPanelOutput : ENGINEERING.panelOutput;
  }
  return pu * sunFactor(s, mode);
}

function wanted(s: GameState, id: FacilityId): boolean {
  if (!isRestored(s, id)) return false;
  const def = FACILITIES[id];
  if (def.critical) return true;
  return s.eng.alloc[id as OptionalSystem];
}

/** Power use if every switched-on machine runs (what the console's choice asks for). */
export function requestedUse(s: GameState): number {
  return CONSUMERS.filter((id) => wanted(s, id)).reduce((a, id) => a + FACILITIES[id].demand, 0);
}

/** The order optional systems brown out in (the greedy grow lights first, the small water pump last). */
const BROWNOUT_ORDER: OptionalSystem[] = ["greenhouse", "research", "water"];

export function computePower(s: GameState, mode: SurvivalMode): PowerStatus {
  const gen = generation(s, mode);
  const storage = s.flags.batteryRestored;
  const cap = capacity(mode);
  const battery = storage ? Math.min(s.eng.battery, cap) : 0;
  const running = new Set(CONSUMERS.filter((id) => wanted(s, id)));
  const requested = [...running].reduce((a, id) => a + FACILITIES[id].demand, 0);
  let use = requested;
  const brownout: OptionalSystem[] = [];
  // Machines on the lower level draw from the battery bus: without a restored battery they cannot run.
  for (const id of [...running]) {
    if (id !== "research" && !storage) {
      running.delete(id);
      use -= FACILITIES[id].demand;
    }
  }
  // Empty battery and not enough sun: optional systems switch off until the rest fits.
  if (use > gen && battery <= 0) {
    for (const id of BROWNOUT_ORDER) {
      if (use <= gen) break;
      if (running.has(id)) {
        running.delete(id);
        use -= FACILITIES[id].demand;
        brownout.push(id);
      }
    }
  }
  const powered = Object.fromEntries(CONSUMERS.map((id) => [id, running.has(id)])) as Record<FacilityId, boolean>;
  powered.solar = s.flags.solarRepaired;
  powered.battery = storage;
  const restored = Object.fromEntries((Object.keys(FACILITIES) as FacilityId[]).map((id) => [id, isRestored(s, id)])) as Record<FacilityId, boolean>;
  const net = gen - use; // without storage this is informational only (nothing is stored)
  let trend: -1 | 0 | 1 = 0;
  if (storage) {
    if (net > 0.05 && battery < cap) trend = 1;
    else if (net < -0.05 && battery > 0) trend = -1;
  }
  return { sun: sunFactor(s, mode), gen, requested, use, net, battery, capacity: cap, storage, powered, restored, brownout, trend, haze: hazeActive(s) };
}

/** Plant stage: 0 empty tray, 1 seeds, 2 sprouts, 3 small plants, 4 mature. */
export function plantStage(s: GameState): number {
  if (!s.flags.seedsPlanted) return 0;
  const t = ENGINEERING.growStageMs;
  return 1 + t.filter((ms) => s.eng.growMs >= ms).length;
}

export function plantsGrowing(s: GameState, p: PowerStatus): boolean {
  return s.flags.seedsPlanted && s.flags.growLightsOn && s.flags.growValveOpen && p.powered.greenhouse && p.powered.water && plantStage(s) < 4;
}

export const STAGE_NAMES = ["Empty tray", "Seeds planted", "Sprouts", "Small plants", "Mature plants"];

export type EngineEvent = "batteryEmpty" | "batteryFull" | `stage:${number}` | `brownout:${string}` | `restored:${string}`;

/**
 * One fixed simulation step. Mutates `s.eng` only (never flags). Returns notable events for the
 * scene (captions, sounds, visuals).
 */
export function stepEngineering(s: GameState, mode: SurvivalMode, dtMs: number = ENGINEERING.stepMs): { status: PowerStatus; events: EngineEvent[] } {
  const events: EngineEvent[] = [];
  const before = computePower(s, mode);
  const cap = before.capacity;
  if (before.storage) {
    const prev = s.eng.battery;
    s.eng.battery = clamp(prev + (before.net * ENGINEERING.batteryRate * dtMs) / 1000, 0, cap);
    if (prev > 0 && s.eng.battery <= 0) events.push("batteryEmpty");
    if (prev < cap && s.eng.battery >= cap) events.push("batteryFull");
  } else {
    s.eng.battery = 0;
  }
  if (plantsGrowing(s, before)) {
    const st0 = plantStage(s);
    const maxMs = ENGINEERING.growStageMs[ENGINEERING.growStageMs.length - 1];
    s.eng.growMs = clamp(s.eng.growMs + dtMs, 0, maxMs);
    const st1 = plantStage(s);
    if (st1 !== st0) events.push(`stage:${st1}`);
  }
  const status = computePower(s, mode);
  for (const id of status.brownout) if (!before.brownout.includes(id)) events.push(`brownout:${id}`);
  for (const id of before.brownout) if (!status.brownout.includes(id)) events.push(`restored:${id}`);
  return { status, events };
}

/**
 * Fixed-step clock. `advance` takes real elapsed ms (any frame rate), clamps huge gaps, and runs
 * whole steps only. Runtime only: never saved, so nothing is simulated while the game is closed.
 */
export class EngineClock {
  private acc = 0;
  advance(dtMs: number, step: (dt: number) => void): number {
    const maxGap = ENGINEERING.stepMs * ENGINEERING.maxStepsPerFrame;
    this.acc += Math.max(0, Math.min(dtMs, maxGap));
    let n = 0;
    while (this.acc >= ENGINEERING.stepMs && n < ENGINEERING.maxStepsPerFrame) {
      this.acc -= ENGINEERING.stepMs;
      step(ENGINEERING.stepMs);
      n++;
    }
    return n;
  }
  reset(): void {
    this.acc = 0;
  }
}

/** Would this console choice run without draining the battery? (critical systems always count) */
export function allocationFits(s: GameState, mode: SurvivalMode, alloc: Record<OptionalSystem, boolean>): boolean {
  const trial = { ...s, eng: { ...s.eng, alloc: { ...alloc } } };
  return requestedUse(trial) <= generation(s, mode) + 1e-6;
}

/** The console's recommended choice: keep critical systems, then add optional systems while they fit. */
export function recommendedAllocation(s: GameState, mode: SurvivalMode): Record<OptionalSystem, boolean> {
  const alloc = { water: false, greenhouse: false, research: false };
  for (const id of ["water", "research", "greenhouse"] as OptionalSystem[]) {
    const tryAlloc = { ...alloc, [id]: true };
    if (allocationFits(s, mode, tryAlloc)) Object.assign(alloc, tryAlloc);
  }
  return alloc;
}

export function clampEng(s: GameState, mode: SurvivalMode): void {
  s.eng.battery = clamp(s.eng.battery, 0, capacity(mode));
}

function clamp(v: number, lo: number, hi: number): number {
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo;
}

export { OPTIONAL_SYSTEMS };
