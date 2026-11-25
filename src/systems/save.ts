/**
 * Versioned local saves under the "laika-the-last-signal/" namespace (never the original
 * game's keys). Loading is defensive: corrupted JSON is backed up and ignored, unknown fields
 * are dropped, missing fields get defaults, and repairState() guarantees the player can never
 * be stuck because of a broken or hand-edited save.
 */
import { SAVE_BACKUP_KEY, SAVE_KEY } from "../config/constants";
import { ITEM_ORDER, RECIPES, type ItemId } from "../data/items";
import { OBJECTS } from "../data/world";
import { ALL_FLAGS, createNewState, SOLAR_PANELS, STATE_VERSION, type AbilityId, type GameState } from "./state";

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function browserStore(): KeyValueStore | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const probe = `${SAVE_KEY}/probe`;
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

export type LoadResult =
  | { status: "none" }
  | { status: "ok"; state: GameState; repaired: string[] }
  | { status: "corrupt"; reason: string };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const strArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

const CHECKPOINT_IDS = new Set(OBJECTS.filter((o) => o.kind === "checkpoint").map((o) => o.id));
const OBJECT_IDS = new Set(OBJECTS.map((o) => o.id));

/** Upgrades older save formats. Version 1 is the first; future versions add steps here. */
export function migrate(raw: Record<string, unknown>): Record<string, unknown> | null {
  const v = typeof raw.version === "number" ? raw.version : NaN;
  if (v === STATE_VERSION) return raw;
  return null; // unknown / future version: incompatible
}

/** Builds a valid state from untrusted data. */
export function sanitize(raw: Record<string, unknown>): GameState {
  const s = createNewState();
  if (isObj(raw.flags)) {
    for (const f of ALL_FLAGS) s.flags[f] = raw.flags[f] === true;
  }
  if (isObj(raw.inventory)) {
    for (const k of ITEM_ORDER) {
      const n = raw.inventory[k];
      s.inventory[k] = typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.min(99, Math.floor(n))) : 0;
    }
  }
  s.collected = [...new Set(strArray(raw.collected).filter((id) => OBJECT_IDS.has(id)))];
  if (isObj(raw.abilities)) {
    for (const a of Object.keys(s.abilities) as AbilityId[]) {
      if (typeof raw.abilities[a] === "boolean") s.abilities[a] = raw.abilities[a] as boolean;
    }
  }
  s.abilities.sweep = true;
  s.sweptPanels = [...new Set(strArray(raw.sweptPanels).filter((p) => SOLAR_PANELS.includes(p)))];
  s.seen = [...new Set(strArray(raw.seen))].slice(0, 200);
  const cp = typeof raw.checkpoint === "string" ? raw.checkpoint : "";
  s.checkpoint = CHECKPOINT_IDS.has(cp) ? cp : "cp_ship";
  s.visitedCheckpoints = [...new Set(["cp_ship", ...strArray(raw.visitedCheckpoints).filter((c) => CHECKPOINT_IDS.has(c))])];
  if (typeof raw.playTimeMs === "number" && Number.isFinite(raw.playTimeMs)) s.playTimeMs = Math.max(0, raw.playTimeMs);
  return s;
}

/** How many of an item exist in the world and have not been collected yet. */
export function uncollected(s: GameState, item: ItemId): number {
  return OBJECTS.filter((o) => o.item === item && !s.collected.includes(o.id)).length;
}

/**
 * Enforces invariants that keep the mission completable. Returns a list of what was fixed.
 * - Later milestones imply earlier ones (e.g. comms online implies the module is installed).
 * - The comms module can never be lost: if it was collected but is neither held nor installed, give it back.
 * - If the solar array cannot be repaired with what is held plus what is left in the world, top up the difference.
 */
export function repairState(s: GameState): string[] {
  const fixed: string[] = [];
  const f = s.flags;
  const imply = (cond: boolean, flag: keyof typeof f, why: string) => {
    if (cond && !f[flag]) {
      f[flag] = true;
      fixed.push(why);
    }
  };
  imply(f.demoComplete, "reachedStation", "demo complete implies station reached");
  imply(f.reachedStation, "stationDoorOpen", "station reached implies door open");
  imply(f.stationDoorOpen, "commsOnline", "door open implies comms online");
  imply(f.bridgeExtended, "commsOnline", "bridge implies comms online");
  imply(f.commsOnline, "moduleInstalled", "comms online implies module installed");
  imply(f.commsOnline, "solarRepaired", "comms online implies solar repaired");
  imply(f.moduleInstalled || f.solarRepaired, "inspectedReceiver", "repairs imply receiver inspected");
  imply(f.inspectedReceiver, "hatchOpen", "outpost visited implies hatch open");
  if (f.commsOnline && s.sweptPanels.length < SOLAR_PANELS.length) {
    s.sweptPanels = [...SOLAR_PANELS];
    fixed.push("comms online implies clean panels");
  }
  if (f.inspectedReceiver && !s.abilities.sniff) {
    s.abilities.sniff = true;
    fixed.push("sniff unlocked");
  }

  // Comms module: exactly one, never lost.
  if (f.moduleInstalled) {
    if (s.inventory.commsModule > 0) {
      s.inventory.commsModule = 0;
      fixed.push("removed duplicate comms module");
    }
  } else if (s.collected.includes("comms_module") && s.inventory.commsModule < 1) {
    s.inventory.commsModule = 1;
    fixed.push("restored lost comms module");
  }
  if (s.inventory.commsModule > 1) {
    s.inventory.commsModule = 1;
    fixed.push("capped comms module");
  }

  // Solar parts: make sure the repair is always reachable.
  if (!f.solarRepaired) {
    for (const k of ["metal", "electronics"] as const) {
      const need = RECIPES.solarRepair[k] ?? 0;
      const reachable = s.inventory[k] + uncollected(s, k);
      if (reachable < need) {
        s.inventory[k] += need - reachable;
        fixed.push(`topped up ${k}`);
      }
    }
  }
  return fixed;
}

export function loadGame(store: KeyValueStore | null): LoadResult {
  if (!store) return { status: "none" };
  let text: string | null = null;
  try {
    text = store.getItem(SAVE_KEY);
  } catch {
    return { status: "none" };
  }
  if (!text) return { status: "none" };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    backup(store, text);
    return { status: "corrupt", reason: "The save file could not be read." };
  }
  if (!isObj(raw)) {
    backup(store, text);
    return { status: "corrupt", reason: "The save file was not valid." };
  }
  const migrated = migrate(raw);
  if (!migrated) {
    backup(store, text);
    return { status: "corrupt", reason: "The save file is from an incompatible version." };
  }
  const state = sanitize(migrated);
  const repaired = repairState(state);
  return { status: "ok", state, repaired };
}

function backup(store: KeyValueStore, text: string): void {
  try {
    store.setItem(SAVE_BACKUP_KEY, text);
    store.removeItem(SAVE_KEY);
  } catch {
    /* storage full or blocked: nothing else to do */
  }
}

export function saveGame(store: KeyValueStore | null, s: GameState): boolean {
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function deleteSave(store: KeyValueStore | null): void {
  try {
    store?.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export function hasSave(store: KeyValueStore | null): boolean {
  try {
    return !!store?.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}
