/**
 * Phase 5: the adventure is presented as one continuous story in chapters. Internally the mission
 * ids, stages and flags are unchanged; this module only maps stages to chapters, decides the small
 * "milestone" line shown when a chapter ends, and starts the next chapter by itself (no extra trip
 * to a console, no results screen).
 */
import type { Effect } from "./effects";
import { answerStationCall, startChapter5 } from "./facilities";
import type { GameState } from "./state";

export interface Chapter {
  n: number;
  label: string;
  title: string;
  /** A short line shown when this chapter is finished (a toast, never a full-screen card). */
  done: string;
}

export const CHAPTERS: Chapter[] = [
  { n: 0, label: "PROLOGUE", title: "First Pawprints", done: "Ready to explore!" },
  { n: 1, label: "CHAPTER 1", title: "The Lost Signal", done: "Signal traced!" },
  { n: 2, label: "CHAPTER 2", title: "Beneath the Red", done: "Relay cell decoded!" },
  { n: 3, label: "CHAPTER 3", title: "Echoes Above", done: "Tower online!" },
  { n: 4, label: "CHAPTER 4", title: "A Place to Call Home", done: "Base restored!" },
  { n: 5, label: "CHAPTER 5", title: "Built to Explore", done: "Ready for the north!" },
];

const M01 = new Set(["radio", "hatch", "receiver", "restore", "bridge", "station", "beacon"]);

/** Chapter of an objective stage, or null for free exploration between story beats. */
export function chapterOfStage(stage: string): number | null {
  if (M01.has(stage)) return 1;
  if (stage.startsWith("m2_")) return 2;
  if (stage.startsWith("m3_") && stage !== "m3_complete") return 3;
  if (stage.startsWith("m4_")) return 4;
  if (stage.startsWith("m5_")) return 5;
  return null;
}

export function chapter(n: number): Chapter | undefined {
  return CHAPTERS.find((c) => c.n === n);
}

/**
 * Starts the next chapter without asking the player to walk back to a console:
 * - after Chapter 1, the station's relay logs arrive on their own;
 * - after Chapter 3, the station's call for Chapter 4 arrives on its own;
 * - after Chapter 4, the call for Chapter 5 (better gear for the trip north).
 * Returns the effects to present, or [] when nothing is due. Pure: the scene decides when.
 */
export function autoAdvance(s: GameState): Effect[] {
  const f = s.flags;
  if (f.demoComplete && !f.m2Briefed) {
    f.m2Briefed = true;
    return [{ type: "transmission", id: "relayLogs" }, { type: "world", event: "freightUnlocked" }, { type: "save" }];
  }
  if (f.ridgeCableOpen && !f.m4Briefed) return answerStationCall(s);
  if (f.m4Complete && !f.m5Briefed) return startChapter5(s);
  return [];
}
