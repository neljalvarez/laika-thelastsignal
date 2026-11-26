/**
 * Versioned local saves under the "laika-the-last-signal/" namespace (never the original
 * game's keys). Loading is defensive: corrupted JSON is backed up and ignored, unknown fields
 * are dropped, missing fields get defaults, and repairState() guarantees the player can never
 * be stuck because of a broken or hand-edited save.
 */
import { SAVE_BACKUP_KEY, SAVE_KEY } from "../config/constants";
import { ITEM_ORDER, RECIPES, type ItemId } from "../data/items";
import { ALL_OBJECTS, MAP_IDS, MAPS, mapOfObject, type MapId } from "../data/regions/registry";
import { OBJECTS } from "../data/world";
import { STAGE_ORDER, type TutorialStageId } from "../data/tutorial";
import { sectionAt } from "./regions";
import { ENGINEERING, SUIT } from "../data/engineering";
import { SCIENCE_IDS } from "../data/science";
import { syncScience } from "./facilities";
import { ALL_FLAGS, createEngState, createNewState, RELAY_START_AIM, SOLAR_PANELS, STATE_VERSION, type AbilityId, type FlagId, type GameState } from "./state";

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

const CHECKPOINT_IDS = new Set(ALL_OBJECTS.filter((o) => o.kind === "checkpoint").map((o) => o.id));
const OBJECT_IDS = new Set(ALL_OBJECTS.map((o) => o.id));
const SECTION_IDS = new Set(MAP_IDS.flatMap((m) => MAPS[m].sections.map((x) => x.id)));
const LANDMARK_IDS = new Set(MAP_IDS.flatMap((m) => MAPS[m].landmarks.map((x) => x.id)));

/**
 * Upgrades older save formats step by step.
 * v1 -> v2 (Phase 2): Phase 1 players never saw Mission 00. They keep everything and are not
 * forced through it: the tutorial is recorded as "skipped" (they can replay it from Pause), and
 * they gain the Bark ability.
 */
export function migrate(raw: Record<string, unknown>): Record<string, unknown> | null {
  let v = typeof raw.version === "number" ? raw.version : NaN;
  let data = { ...raw };
  if (v === 1) {
    const abilities = isObj(data.abilities) ? { ...data.abilities, bark: true } : { bark: true };
    data = { ...data, version: 2, abilities, tutorial: { status: "skipped", stage: "done" } };
    v = 2;
  }
  // v2 -> v3 (Phase 3): new flags, items and the Headlamp default to "not yet"; the world map is
  // back-filled from the checkpoints already visited (repairState); relays start in their default
  // directions. Nothing a Phase 1-2 player achieved changes, and a finished Mission 01 leads
  // straight into Mission 02.
  if (v === 2) {
    const abilities = isObj(data.abilities) ? { ...data.abilities, headlamp: false } : { headlamp: false };
    data = { ...data, version: 3, abilities, discovered: { maps: ["surface"], sections: [], landmarks: [] }, puzzles: { relayAim: { ...RELAY_START_AIM } } };
    v = 3;
  }
  // v3 -> v4 (Phase 4): the outpost's engineering. Nothing a Phase 1-3 player achieved changes:
  // restoration flags start false, the battery starts empty (it only stores power once restored),
  // the suit is full, and the journal is back-filled from what was already achieved (repairState).
  // A player who finished Mission 03 continues straight into Mission 04.
  if (v === 3) {
    data = { ...data, version: 4, eng: createEngState(), science: [] };
    v = 4;
  }
  if (v === STATE_VERSION) return data;
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
  s.visitedCheckpoints = [...new Set(["cp_ship", ...strArray(raw.visitedCheckpoints).filter((c) => CHECKPOINT_IDS.has(c))])];
  // An unknown checkpoint (renamed, hand-edited, from a future build) falls back to the last valid
  // one Laika visited instead of throwing her back to the ship.
  const cp = typeof raw.checkpoint === "string" ? raw.checkpoint : "";
  s.checkpoint = CHECKPOINT_IDS.has(cp) ? cp : (s.visitedCheckpoints[s.visitedCheckpoints.length - 1] ?? "cp_ship");
  const disc = isObj(raw.discovered) ? raw.discovered : {};
  s.discovered = {
    maps: [...new Set(["surface", ...strArray(disc.maps).filter((m) => (MAP_IDS as string[]).includes(m))])],
    sections: [...new Set(strArray(disc.sections).filter((x) => SECTION_IDS.has(x)))],
    landmarks: [...new Set(strArray(disc.landmarks).filter((x) => LANDMARK_IDS.has(x)))],
  };
  const pz = isObj(raw.puzzles) && isObj(raw.puzzles.relayAim) ? raw.puzzles.relayAim : {};
  for (const id of Object.keys(RELAY_START_AIM)) {
    const v = pz[id];
    s.puzzles.relayAim[id] = typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 4 ? v : RELAY_START_AIM[id];
  }
  if (typeof raw.playTimeMs === "number" && Number.isFinite(raw.playTimeMs)) s.playTimeMs = Math.max(0, raw.playTimeMs);
  // Phase 4 operating conditions: every number is clamped, unknown panels and entries are dropped.
  // A corrupt engineering block recovers to safe defaults instead of erasing the campaign.
  const e = isObj(raw.eng) ? raw.eng : {};
  const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  const al = isObj(e.alloc) ? e.alloc : {};
  const base = createEngState();
  s.eng = {
    battery: num(e.battery, 0, Math.max(...Object.values(ENGINEERING.batteryCapacity)), 0),
    alloc: { water: al.water !== false, greenhouse: al.greenhouse !== false, research: al.research !== false },
    growMs: num(e.growMs, 0, ENGINEERING.growStageMs[ENGINEERING.growStageMs.length - 1], 0),
    suit: num(e.suit, 0, SUIT.max, base.suit),
    dusty: [...new Set(strArray(e.dusty).filter((p) => SOLAR_PANELS.includes(p)))],
  };
  s.science = [...new Set(strArray(raw.science).filter((id) => SCIENCE_IDS.has(id)))];
  // Tutorial record: anything unreadable recovers to "skipped" so a broken record can never trap
  // the player in Mission 00 or lock them out of the campaign.
  const t = isObj(raw.tutorial) ? raw.tutorial : null;
  const status = t && (t.status === "active" || t.status === "done" || t.status === "skipped") ? t.status : "skipped";
  const stage = t && typeof t.stage === "string" && STAGE_ORDER.includes(t.stage as TutorialStageId) ? (t.stage as TutorialStageId) : "done";
  s.tutorial = { status, stage: status === "active" ? stage : "done" };
  if (s.tutorial.status === "active" && (s.flags.hatchOpen || s.flags.checkedShipRadio)) s.tutorial = { status: "done", stage: "done" };
  return s;
}

/** How many of an item exist on the SURFACE map and have not been collected yet (the solar repair happens there). */
export function uncollected(s: GameState, item: ItemId): number {
  return OBJECTS.filter((o) => o.item === item && !s.collected.includes(o.id)).length;
}

/** Relay dish targets, from the relay objects' data. */
const RELAY_TARGET: Record<string, number> = Object.fromEntries(ALL_OBJECTS.filter((o) => o.kind === "relay").map((o) => [o.id, o.aim ?? 0]));

/**
 * Enforces invariants that keep the mission completable. Returns a list of what was fixed.
 * - Later milestones imply earlier ones (e.g. comms online implies the module is installed).
 * - The comms module can never be lost: if it was collected but is neither held nor installed, give it back.
 * - If the solar array cannot be repaired with what is held plus what is left in the world, top up the difference.
 */
export function repairState(s: GameState): string[] {
  // Rules feed each other (a Phase 4 milestone can imply a Phase 3 one), so repeat until stable.
  const all: string[] = [];
  for (let i = 0; i < 4; i++) {
    const fixed = repairOnce(s);
    all.push(...fixed);
    if (fixed.length === 0) break;
  }
  return all;
}

function repairOnce(s: GameState): string[] {
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

  // ---- Phase 3: Missions 02-03. Later milestones imply earlier ones. ----
  // Being saved in a map implies being allowed there (protects hand-edited or interrupted saves).
  const where: MapId = mapOfObject(s.checkpoint) ?? "surface";
  if (where === "depths") imply(true, "depthsReached", "saved in the depths");
  if (where === "ridge") imply(true, "ridgeReached", "saved on the ridge");
  imply(f.ridgeCableOpen, "signalTraced", "cable car implies signal traced");
  imply(f.signalTraced, "towerReached", "trace implies tower reached");
  imply(f.towerReached, "relayNetworkOnline", "tower implies relay network online");
  if (f.relayNetworkOnline) {
    for (const k of ["relayASwept", "cellInstalled", "relayCFound"] as FlagId[]) imply(true, k as keyof typeof f, "network implies its parts");
    for (const [id, aim] of Object.entries(RELAY_TARGET)) {
      if (s.puzzles.relayAim[id] !== aim) {
        s.puzzles.relayAim[id] = aim;
        fixed.push(`aligned ${id}`);
      }
    }
  }
  imply(f.relayASwept || f.cellInstalled || f.relayCFound || f.ridgeBridgeOut, "ridgeReached", "ridge progress implies ridge reached");
  imply(f.ridgeReached, "relayAnalyzed", "ridge reached implies relay analysed");
  imply(f.relayAnalyzed, "iceChamberReached", "relay analysed implies ice chamber");
  imply(f.depthsLiftOpen, "circuitRestored", "lift implies circuit");
  imply(f.iceChamberReached, "circuitRestored", "ice chamber implies circuit");
  imply(f.circuitRestored, "junctionInspected", "circuit implies junction inspected");
  imply(f.junctionInspected, "passageOpen", "junction implies passage open");
  imply(f.passageOpen || f.lockerOpened, "depthsReached", "depths progress implies depths reached");
  if (f.passageOpen && !s.abilities.headlamp) {
    s.abilities.headlamp = true;
    fixed.push("headlamp unlocked");
  }
  imply(f.depthsReached, "m2Briefed", "depths reached implies briefing");
  imply(f.m2Briefed, "demoComplete", "Mission 02 implies Mission 01 complete");
  // Re-run the Mission 01 chain now that Phase 3 flags may have implied demoComplete.
  imply(f.demoComplete, "reachedStation", "demo complete implies station reached");
  imply(f.reachedStation, "stationDoorOpen", "station reached implies door open");
  imply(f.stationDoorOpen, "commsOnline", "door open implies comms online");
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
  for (const m of MAP_IDS) {
    const been = m === "surface" || (m === "depths" && f.depthsReached) || (m === "ridge" && f.ridgeReached);
    if (been && !s.discovered.maps.includes(m)) s.discovered.maps.push(m);
  }

  // Mission-critical Phase 3 items: exactly one each, never lost, gone once installed.
  const critical = (item: "coupling" | "relayCell", source: string, usedUp: boolean, gotIt: boolean) => {
    if (usedUp) {
      if (s.inventory[item] > 0) {
        s.inventory[item] = 0;
        fixed.push(`removed spent ${item}`);
      }
    } else if (gotIt && s.inventory[item] < 1) {
      s.inventory[item] = 1;
      fixed.push(`restored lost ${item}`);
    }
    if (s.inventory[item] > 1) {
      s.inventory[item] = 1;
      fixed.push(`capped ${item}`);
    }
    if (gotIt && !s.collected.includes(source)) s.collected.push(source);
  };
  critical("coupling", "coupling_cache", f.circuitRestored, s.collected.includes("coupling_cache") || s.inventory.coupling > 0);
  critical("relayCell", "sampler", f.cellInstalled, s.collected.includes("sampler") || s.inventory.relayCell > 0 || f.relayAnalyzed);

  // Phase 4: later restoration milestones imply earlier ones (hand-edited or interrupted saves stay completable).
  imply(f.m4Complete, "lightsOutDone", "mission 04 complete implies lights out done");
  imply(f.lightsOutDone, "lightsOutBalanced", "lights out done implies balanced");
  imply(f.lightsOutBalanced, "lightsOutStarted", "balanced implies lights out started");
  for (const k of ["batteryRestored", "recyclerOn", "waterRestored", "seedsPlanted", "growLightsOn", "shelterRestored"] as const) {
    imply(f.lightsOutStarted, k, `lights out implies ${k}`);
  }
  imply(f.recyclerOn, "recyclerPowered", "recycler on implies powered");
  imply(f.recyclerOn, "recyclerFixed", "recycler on implies fixed");
  imply(f.recyclerFixed || f.recyclerPowered, "recyclerInspected", "recycler work implies inspected");
  imply(f.growLightsOn, "growPowered", "grow lights imply grow power");
  imply(f.growLightsOn || f.cropHarvested, "seedsPlanted", "grow lights imply planted");
  imply(f.seedsPlanted, "growValveOpen", "planted implies watered");
  imply(f.growValveOpen, "waterRestored", "valve open implies water restored");
  imply(f.shelterRestored, "probeOutRead", "shelter implies outside reading");
  imply(f.shelterRestored, "probeInRead", "shelter implies inside reading");
  imply(f.probeOutRead || f.probeInRead || f.shelterRestored, "shelterInspected", "readings imply monitor awake");
  for (const k of ["recyclerPowered", "waterRestored", "growPowered", "shelterInspected"] as const) {
    imply(f[k], "batteryRestored", `${k} implies the battery bus`);
  }
  imply(f.batteryRestored || f.baseSurveyed || f.baseReturned, "m4Briefed", "base work implies mission 04 started");
  imply(f.m4Briefed, "ridgeCableOpen", "mission 04 implies mission 03 complete");
  imply(f.seismometerRead, "canyonPostFixed", "seismometer read implies post fixed");
  // Phase 4 mission items: one each, never lost while still needed, gone once installed.
  const marker = (id: string) => s.seen.includes(`took:${id}`);
  const unique = (item: "regulator" | "recyclerPart" | "waterCoupling" | "seeds" | "powerCell", usedUp: boolean, gotIt: boolean) => {
    if (usedUp && s.inventory[item] > 0) {
      s.inventory[item] = 0;
      fixed.push(`removed spent ${item}`);
    } else if (!usedUp && gotIt && s.inventory[item] < 1) {
      s.inventory[item] = 1;
      fixed.push(`restored lost ${item}`);
    }
    if (s.inventory[item] > 1) s.inventory[item] = 1;
  };
  unique("regulator", f.batteryRestored, marker("cargo_locker"));
  unique("recyclerPart", f.recyclerFixed, s.collected.includes("buried_cartridge"));
  unique("waterCoupling", f.waterRestored, marker("drill_coupling"));
  unique("seeds", f.seedsPlanted, marker("habitat_storage"));
  unique("powerCell", f.canyonPostFixed, s.collected.includes("buried_cell"));
  // An installed part's source is empty: the world never offers a second one (no free duplicates).
  const taken = (used: boolean, kind: "collected" | "seen", id: string) => {
    const list = kind === "collected" ? s.collected : s.seen;
    if (used && !list.includes(id)) {
      list.push(id);
      fixed.push(`marked ${id} as taken`);
    }
  };
  taken(f.batteryRestored, "seen", "took:cargo_locker");
  taken(f.recyclerFixed, "collected", "buried_cartridge");
  taken(f.waterRestored, "seen", "took:drill_coupling");
  taken(f.seedsPlanted, "seen", "took:habitat_storage");
  taken(f.canyonPostFixed, "collected", "buried_cell");
  // Operating conditions that must agree with the milestones.
  if (!f.batteryRestored) s.eng.battery = 0;
  if (!f.lightsOutBalanced || f.lightsOutDone) s.eng.dusty = [];
  if (!f.seedsPlanted) s.eng.growMs = 0;
  // Science journal: back-fill entries for everything already achieved (Phase 1-3 saves).
  syncScience(s);

  // World map: back-fill sections from checkpoints already visited (Phase 1-2 saves have none).
  for (const id of s.visitedCheckpoints) {
    const o = ALL_OBJECTS.find((x) => x.id === id);
    const m = mapOfObject(id);
    if (!o || !m) continue;
    const sec = sectionAt(m, o.col, o.row - 1);
    if (sec && !s.discovered.sections.includes(sec.id)) s.discovered.sections.push(sec.id);
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
