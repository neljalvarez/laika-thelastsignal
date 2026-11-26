/**
 * Phase 4: which texture each base machine shows for a given state. Pure (no Phaser) so the
 * visible transformation of the base is unit-tested, not just the numbers behind it.
 */
import type { WorldObject } from "../data/world";
import { computePower, hazeActive, plantStage, type PowerStatus } from "../systems/engineering";
import type { SurvivalMode } from "../data/engineering";
import type { GameState } from "../systems/state";

/** `frame` alternates 0/1 for running machines (fixed at 0 with reduced motion). */
export function facilityTexture(o: WorldObject, s: GameState, p: PowerStatus, frame: 0 | 1 = 0): string | null {
  const f = s.flags;
  if (o.kind === "recharge") return o.broken && !f.canyonPostFixed ? "recharge_dead" : "recharge_on";
  if (o.kind === "stairs") return "ladder";
  if (o.kind !== "facility") return null;
  const run = (on: boolean, base: string) => (on ? `${base}_on${frame}` : `${base}_off`);
  switch (o.part) {
    case "cargoLocker":
      return s.seen.includes("took:cargo_locker") ? "cargo_locker_open" : "cargo_locker_closed";
    case "baseTerminal":
      return f.m4Briefed ? "base_terminal_on" : "base_terminal_off";
    case "probeOut":
      return f.probeOutRead ? "probe_on" : "probe_off";
    case "probeIn":
      return f.probeInRead ? "probe_on" : "probe_off";
    case "shelterTerminal":
      return f.shelterRestored ? "shelter_monitor_ready" : f.shelterInspected ? "shelter_monitor_awake" : "shelter_monitor_off";
    case "distConsole":
      return !f.batteryRestored ? "dist_console_off" : hazeActive(s) ? "dist_console_alert" : "dist_console_on";
    case "bed":
      return "sleeping_mat";
    case "storage":
      return s.seen.includes("took:habitat_storage") ? "storage_open" : "storage_closed";
    case "recycler":
      if (!f.recyclerFixed) return "recycler_broken";
      return f.recyclerOn && p.powered.lifeSupport ? `recycler_on${frame}` : "recycler_off";
    case "recyclerPower":
      return f.recyclerPowered ? "power_box_on" : "power_box_off";
    case "growPower":
      return f.growPowered ? "power_box_on" : "power_box_off";
    case "planter": {
      const stage = plantStage(s);
      if (stage === 0) return f.growValveOpen && p.powered.water ? "planter_wet" : "planter_dry";
      return ["planter_seeds", "planter_seeds", "planter_sprouts", "planter_small", "planter_mature"][stage];
    }
    case "growValve":
      return f.growValveOpen ? "valve_open" : "valve_closed";
    case "waterProcessor":
      return run(f.waterRestored && p.powered.water, "water_proc");
    case "seismometer":
      return f.seismometerRead ? "seismometer_on" : "seismometer_off";
    case "deepProbe":
      return f.fissureSurveyed ? "deep_probe_on" : "deep_probe_off";
    case "telescopeNorth":
      return f.observatoryReached ? "telescope_on" : "telescope_off";
    default:
      return null;
  }
}

/** Lower-level rooms (cols are inclusive) and whether each one has its lights on. */
export interface Room {
  id: "shelter" | "maint" | "quarters" | "life" | "grow" | "water";
  col0: number;
  col1: number;
  sign: string;
  signCol: number;
}

export const ROOMS: Room[] = [
  { id: "shelter", col0: 42, col1: 47, sign: "sign_shelter", signCol: 45 },
  { id: "maint", col0: 50, col1: 55, sign: "sign_maint", signCol: 53 },
  { id: "quarters", col0: 56, col1: 65, sign: "sign_home", signCol: 57 },
  { id: "life", col0: 66, col1: 72, sign: "sign_life", signCol: 69 },
  { id: "grow", col0: 73, col1: 81, sign: "sign_grow", signCol: 77 },
  { id: "water", col0: 82, col1: 87, sign: "sign_water", signCol: 85 },
];

/** 0 = lit, 1 = dark. The base visibly wakes up room by room as Laika restores it. */
export function roomDarkness(room: Room["id"], s: GameState, p: PowerStatus): number {
  const f = s.flags;
  if (!f.batteryRestored) return room === "shelter" && f.shelterRestored ? 0 : 1;
  switch (room) {
    case "shelter":
      return f.shelterRestored ? 0 : 0.6;
    case "maint":
    case "quarters":
      return p.haze ? 0.35 : 0;
    case "life":
      return f.recyclerOn && p.powered.lifeSupport ? 0 : 0.6;
    case "grow":
      return f.growLightsOn && p.powered.greenhouse ? 0 : 0.6;
    case "water":
      return f.waterRestored && p.powered.water ? 0 : 0.6;
  }
}

/** What the surface shows above the base: a glass dome over the grow room, a vent and a mast. */
export function surfaceLook(s: GameState, p: PowerStatus): { domeStage: number; domeGlow: boolean; vent: boolean; ventSteam: boolean; mastBlink: boolean; haze: boolean } {
  const f = s.flags;
  const grow = f.growLightsOn && p.powered.greenhouse;
  return {
    domeStage: f.seedsPlanted ? plantStage(s) : 0,
    domeGlow: grow,
    vent: f.recyclerFixed,
    ventSteam: f.recyclerOn && p.powered.lifeSupport,
    mastBlink: f.m4Complete,
    haze: p.haze,
  };
}

/** Convenience for callers that only have the state. */
export function powerFor(s: GameState, mode: SurvivalMode): PowerStatus {
  return computePower(s, mode);
}

/** Phase 5: souvenirs in Laika's room, each earned by something she did. */
export function habitatDecor(s: GameState): { shelf: boolean; patch: boolean; photo: boolean; rover: boolean } {
  return {
    shelf: (s.inventory.sample ?? 0) >= 3,
    patch: s.flags.m4Complete,
    photo: (s.inventory.treat ?? 0) >= 1,
    rover: (s.inventory.roverPart ?? 0) >= 2,
  };
}
