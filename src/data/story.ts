/**
 * Short story beats. Every transmission is shown as subtitles, so nothing depends on audio.
 * Keep lines short: one idea per line, readable by young players.
 */

export interface TransmissionLine {
  speaker: string;
  text: string;
  /** Static / interference styling for this line. */
  static?: boolean;
}

export interface Transmission {
  id: string;
  title: string;
  /** What plays in the game: one or two short lines per bubble (Phase 5 text audit). */
  lines: TransmissionLine[];
  /** The longer original transmission, kept for the journal's radio log (optional reading). */
  full?: TransmissionLine[];
}

export const TRANSMISSIONS: Record<string, Transmission> = {
  wake: {
    id: "wake",
    title: "SUIT COMPUTER",
    lines: [
      { speaker: "SUIT", text: "Good morning, Laika." },
      { speaker: "SUIT", text: "Mission Control is silent." },
    ],
    full: [
      { speaker: "SUIT", text: "Systems rebooting... Pilot: LAIKA. Status: good dog." },
      { speaker: "SUIT", text: "Calling Mission Control... no reply." },
    ],
  },
  shipRadio: {
    id: "shipRadio",
    title: "SHIP RADIO",
    lines: [
      { speaker: "SHIP RADIO", text: "No signal. Antenna broken.", static: true },
      { speaker: "SUIT", text: "Try the outpost's radio." },
    ],
    full: [
      { speaker: "SHIP RADIO", text: "NO CARRIER. Ship antenna damaged in landing.", static: true },
      { speaker: "SUIT", text: "Nearest receiver: a landing outpost, just outside." },
    ],
  },
  receiverInspect: {
    id: "receiverInspect",
    title: "COMMS RECEIVER",
    lines: [
      { speaker: "RADIO", text: "No power. A part is missing.", static: true },
      { speaker: "SUIT", text: "Sniff to find buried parts!" },
    ],
    full: [
      { speaker: "RECEIVER", text: "OFFLINE. No power. Comms module: MISSING.", static: true },
      { speaker: "SUIT", text: "Scanner unlocked! Press SNIFF to search for buried parts." },
    ],
  },
  receiverInspectKnown: {
    id: "receiverInspectKnown",
    title: "COMMS RECEIVER",
    lines: [
      { speaker: "RADIO", text: "No power. A part is missing.", static: true },
      { speaker: "SUIT", text: "Use your nose!" },
    ],
    full: [
      { speaker: "RECEIVER", text: "OFFLINE. No power. Comms module: MISSING.", static: true },
      { speaker: "SUIT", text: "Spare parts must be buried out there. Time to use your nose!" },
    ],
  },
  firstSignal: {
    id: "firstSignal",
    title: "UNKNOWN SIGNAL",
    lines: [
      { speaker: "???", text: "...Ares Station... can anyone hear?...", static: true },
      { speaker: "SUIT", text: "The bridge can open now!" },
    ],
    full: [
      { speaker: "???", text: "...kzzt... Ares Station to any receiver...", static: true },
      { speaker: "???", text: "...power failing... the signal is not ours... repeat, NOT ours...", static: true },
      { speaker: "???", text: "...canyon bridge... sending handshake code... kzzt...", static: true },
      { speaker: "SUIT", text: "Handshake received. The canyon bridge can be extended!" },
    ],
  },
  finalSignal: {
    id: "finalSignal",
    title: "SIGNAL TRACE",
    lines: [
      { speaker: "CONSOLE", text: "Signal source: far north." },
      { speaker: "???", text: "...Laika? Is that you?", static: true },
    ],
    full: [
      { speaker: "CONSOLE", text: "Tracing source... 1,200 km NORTH. Strength: rising." },
      { speaker: "CONSOLE", text: "Pattern repeats every 88 minutes. Origin: unknown." },
      { speaker: "???", text: "...hello? ...is someone there?", static: true },
      { speaker: "???", text: "...Laika? ...is that you, girl?", static: true },
      { speaker: "CONSOLE", text: "SIGNAL LOST." },
    ],
  },
  // ---------------- Phase 3 ----------------
  relayLogs: {
    id: "relayLogs",
    title: "RELAY LOGS",
    lines: [
      { speaker: "CONSOLE", text: "The signal came through a relay tower." },
      { speaker: "SUIT", text: "Its power cell is in the caves below." },
    ],
    full: [
      { speaker: "CONSOLE", text: "Relay map loaded. The 88-minute signal did not come here directly." },
      { speaker: "CONSOLE", text: "It was caught by the ECHO RIDGE relay tower and passed down to this station." },
      { speaker: "CONSOLE", text: "Tower status: DARK. Its relay power cell was moved underground for cold storage." },
      { speaker: "CONSOLE", text: "Freight lift to the survey caves: UNLOCKED." },
      { speaker: "SUIT", text: "Find the relay cell down there, Laika. Then we can wake the tower." },
    ],
  },
  relayAnalysis: {
    id: "relayAnalysis",
    title: "RELAY CELL ANALYSIS",
    lines: [
      { speaker: "RADIO", text: "Cell decoded. North tunnel open." },
      { speaker: "SUIT", text: "Let's light up that tower!" },
    ],
    full: [
      { speaker: "RECEIVER", text: "Relay cell detected. Charge: 84%. Owner: ECHO RIDGE JUNCTION." },
      { speaker: "RECEIVER", text: "Uploading network authorisation... NORTH ACCESS: UNSEALED." },
      { speaker: "RECEIVER", text: "Route: the service tunnel under the survey lift leads to the ridge." },
      { speaker: "SUIT", text: "The tower is up there somewhere. Let's light it up!" },
    ],
  },
  towerTrace: {
    id: "towerTrace",
    title: "TOWER TRACE",
    lines: [
      { speaker: "TOWER", text: "Signal: north. Older than the station." },
      { speaker: "???", text: "...good girl... keep following...", static: true },
    ],
    full: [
      { speaker: "TOWER", text: "Relay network: ONLINE. Tracing at full gain..." },
      { speaker: "TOWER", text: "Source: north, 1,200 km. It has not moved. Window: every 88 minutes." },
      { speaker: "TOWER", text: "Signal age estimate: OLDER THAN THE STATION. Older than the relays." },
      { speaker: "???", text: "...you found the tower... good girl...", static: true },
      { speaker: "???", text: "...we waited where the lights go north... keep following...", static: true },
      { speaker: "TOWER", text: "SIGNAL LOST. Next window: 88 minutes." },
      { speaker: "SUIT", text: "Who has been waiting for you, Laika? And for how long?" },
    ],
  },
  // ---- Phase 4: Mission 04 "A Place to Call Home" ----
  m4Brief: {
    id: "m4Brief",
    title: "ARES STATION // BASE PLANNER",
    lines: [
      { speaker: "STATION", text: "A long trip needs a home base." },
      { speaker: "SUIT", text: "Let's go home and fix the outpost!" },
    ],
    full: [
      { speaker: "CONSOLE", text: "Signal window open. Source: north, 1,200 km. Same 88-minute pattern." },
      { speaker: "CONSOLE", text: "Expedition check: a trip that far needs a working home base." },
      { speaker: "CONSOLE", text: "Landing Outpost: SOLAR OK. Battery, life support, water, greenhouse, shelter: OFFLINE." },
      { speaker: "CONSOLE", text: "Base override sent. Habitat door: UNLOCKED." },
      { speaker: "SUIT", text: "Suit energy meter online. Let's go home and wake the whole outpost, Laika." },
    ],
  },
  m4Final: {
    id: "m4Final",
    title: "OUTPOST // ALL SYSTEMS",
    lines: [
      { speaker: "SUIT", text: "Look at this place, Laika!" },
      { speaker: "???", text: "...good work, little explorer... the signal is getting clearer...", static: true },
    ],
    full: [
      { speaker: "SUIT", text: "Battery charging. Water flowing. Plants growing. Look at this place, Laika!" },
      { speaker: "RECEIVER", text: "Incoming on the 88-minute window... signal strength up from last time." },
      { speaker: "???", text: "...good work, little explorer... the northern signal is getting clearer...", static: true },
      { speaker: "SUIT", text: "Somebody out there is still waiting. And now we have a home to come back to." },
    ],
  },
  // ---- Phase 5: Chapter 5 "Built to Explore" ----
  m5Brief: {
    id: "m5Brief",
    title: "ARES STATION",
    lines: [
      { speaker: "STATION", text: "The trip north needs better gear." },
      { speaker: "SUIT", text: "The workbench has a new plan!" },
    ],
  },
  m5Final: {
    id: "m5Final",
    title: "OUTPOST RADIO",
    lines: [
      { speaker: "RADIO", text: "Beacon linked. The way north is marked." },
      { speaker: "???", text: "...we see your light, Laika...", static: true },
    ],
  },
};

/** Short, optional science tips. Shown once, never block play. */
export const TIPS = {
  dust: "Clean panels make more power.",
  battery: "Batteries save power for later.",
  power: "Panels → battery → machines.",
  radio: "Radio messages take minutes to reach Earth.",
  gravity: "Mars gravity is about 38% of Earth's.",
  circuit: "One broken link stops the whole circuit.",
  // Phase 4 contextual micro-tutorials (shown once, when the player first does the thing).
  storage: "Spare sunlight charges the battery.",
  recycler: "Life support recycles air and water.",
  plants: "Plants need water and light.",
  recharge: "Recharge your suit at ϟ posts.",
  suitLow: "Suit low. Walking and jumping still work.",
  priority: "Life support always gets power first.",
};

export const DEDICATION = [
  "LAIKA: THE LAST SIGNAL is a work of fiction, inspired by Laika,",
  "the first animal to orbit the Earth (Sputnik 2, November 1957).",
  "The real Laika did not survive her flight. This game imagines a kinder journey.",
  "In loving memory of Laika.",
];
