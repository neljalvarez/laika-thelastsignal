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
  lines: TransmissionLine[];
}

export const TRANSMISSIONS: Record<string, Transmission> = {
  wake: {
    id: "wake",
    title: "SUIT COMPUTER",
    lines: [
      { speaker: "SUIT", text: "Systems rebooting... Pilot: LAIKA. Status: good dog." },
      { speaker: "SUIT", text: "Calling Mission Control... no reply." },
    ],
  },
  shipRadio: {
    id: "shipRadio",
    title: "SHIP RADIO",
    lines: [
      { speaker: "SHIP RADIO", text: "NO CARRIER. Ship antenna damaged in landing.", static: true },
      { speaker: "SUIT", text: "Nearest receiver: a landing outpost, just outside." },
    ],
  },
  receiverInspect: {
    id: "receiverInspect",
    title: "COMMS RECEIVER",
    lines: [
      { speaker: "RECEIVER", text: "OFFLINE. No power. Comms module: MISSING.", static: true },
      { speaker: "SUIT", text: "Scanner unlocked! Press SNIFF to search for buried parts." },
    ],
  },
  receiverInspectKnown: {
    id: "receiverInspectKnown",
    title: "COMMS RECEIVER",
    lines: [
      { speaker: "RECEIVER", text: "OFFLINE. No power. Comms module: MISSING.", static: true },
      { speaker: "SUIT", text: "Spare parts must be buried out there. Time to use your nose!" },
    ],
  },
  firstSignal: {
    id: "firstSignal",
    title: "UNKNOWN SIGNAL",
    lines: [
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
      { speaker: "SUIT", text: "Battery charging. Water flowing. Plants growing. Look at this place, Laika!" },
      { speaker: "RECEIVER", text: "Incoming on the 88-minute window... signal strength up from last time." },
      { speaker: "???", text: "...good work, little explorer... the northern signal is getting clearer...", static: true },
      { speaker: "SUIT", text: "Somebody out there is still waiting. And now we have a home to come back to." },
    ],
  },
};

/** Short, optional science tips. Shown once, never block play. */
export const TIPS = {
  dust: "Dust blocks sunlight. Clean panels make more power!",
  battery: "Batteries store solar power for night and dusty days.",
  power: "Power flows from the panels to the battery, then to every machine.",
  radio: "Radio needs power and an antenna. Mars is minutes away from Earth by radio!",
  gravity: "Mars has about 38% of Earth's gravity, so you can jump much higher.",
  circuit: "A circuit needs every link: one broken connector, and nothing after it gets power.",
  // Phase 4 contextual micro-tutorials (shown once, when the player first does the thing).
  storage: "Extra solar power charges the battery. The battery covers the gap when the Sun is weak.",
  recycler: "The recycler helps recover water, so the base wastes almost none.",
  plants: "Plants need water and light. The grow lamps are their sunshine.",
  recharge: "Recharge here to restore suit energy. Look for the lightning symbol.",
  suitLow: "Suit energy is low: Thruster Boots need a recharge. Walking, jumping and Bark always work.",
  priority: "Life support is protected: it always gets power first. The console shares out the rest.",
};

export const DEDICATION = [
  "LAIKA: THE LAST SIGNAL is a work of fiction, inspired by Laika,",
  "the first animal to orbit the Earth (Sputnik 2, November 1957).",
  "The real Laika did not survive her flight. This game imagines a kinder journey.",
  "In loving memory of Laika.",
];
