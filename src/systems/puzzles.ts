/**
 * Phase 3 interactions: the Headlamp, the Frozen Depths puzzles and the Echo Ridge relay network.
 * Same contract as systems/interactions.ts: getRegionInteraction() answers "what would E do?",
 * performRegionInteraction() mutates the state and returns Effects. Every function is idempotent:
 * repeating an action never duplicates items or re-triggers a solved puzzle.
 *
 * PUZZLE A (Depths) "Light the way"  - reflective markers (seen only in lamplight) lead to a light
 *   sensor; shining the headlamp on it opens the shutter.
 * PUZZLE B (Depths) "Restore the circuit" - battery bank -> cracked junction (needs the coupling that
 *   is buried in the equipment room) -> lights, ice-chamber door, survey lift, service hatch.
 * PUZZLE C (Depths) "Frozen survey chamber" - the powered core drill yields a water-ice sample and
 *   the relay power cell.
 * PUZZLE A (Ridge) "Align the relay network" - Relay A needs sweeping; Relays B and C must be turned
 *   to match the arrow painted on their plaque; the junction needs the relay cell.
 * PUZZLE B (Ridge) "Follow the strongest signal" - Relay C is hidden; the scanner tracks its signal.
 * PUZZLE C (Ridge) "Bark and response" - the acoustic sensor hears a bark through the suit radio and
 *   extends a bridge to a cache. Optional.
 */
import { ALL_OBJECTS } from "../data/regions/registry";
import type { WorldObject } from "../data/world";
import type { Effect, Interaction, InteractionContext } from "./effects";
import { collectOnce } from "./inventory";
import { performTransit, transitInteraction } from "./regions";
import type { GameState } from "./state";

export const RELAY_SYMBOL: Record<string, string> = { tri: "△", circle: "○", square: "□" };
export const AIM_ARROWS = ["←", "↖", "↑", "↗", "→"];
export const AIM_WORDS = ["left", "up-left", "up", "up-right", "right"];

const RELAYS = ALL_OBJECTS.filter((o) => o.kind === "relay");

export function relayAligned(s: GameState, id: string): boolean {
  const o = RELAYS.find((r) => r.id === id);
  return !!o && s.puzzles.relayAim[id] === (o.aim ?? 0);
}

/** Is each relay reporting in? (A: swept; B: aimed; C: found and aimed.) */
export function relayOnline(s: GameState, id: string): boolean {
  if (id === "relay_a") return s.flags.relayASwept && relayAligned(s, id);
  if (id === "relay_c") return s.flags.relayCFound && relayAligned(s, id);
  return relayAligned(s, id);
}

export function networkReady(s: GameState): boolean {
  return s.flags.cellInstalled && RELAYS.every((r) => relayOnline(s, r.id));
}

/** Network status lines for the junction screen (symbols + words, never colour alone). */
export function networkStatus(s: GameState): string[] {
  const lines = RELAYS.map((r) => {
    const sym = RELAY_SYMBOL[r.symbol ?? "tri"];
    const ok = relayOnline(s, r.id);
    let why = "";
    if (!ok) {
      if (r.id === "relay_a" && !s.flags.relayASwept) why = "dust on the dish";
      else if (r.id === "relay_c" && !s.flags.relayCFound) why = "no response: follow its faint signal with your scanner";
      else why = `dish points ${AIM_WORDS[s.puzzles.relayAim[r.id] ?? 0]}; plaque says ${AIM_WORDS[r.aim ?? 0]}`;
    }
    return `${sym} ${r.label}: ${ok ? "ONLINE ✓" : `OFFLINE ✕ (${why})`}`;
  });
  return [`Relay cell: ${s.flags.cellInstalled ? "INSTALLED ✓" : "MISSING ✕"}`, ...lines];
}

/** Turns the network on the moment its last piece falls into place. Mutates; pushes effects. */
export function checkNetwork(s: GameState, fx: Effect[]): void {
  if (s.flags.relayNetworkOnline || !networkReady(s)) return;
  s.flags.relayNetworkOnline = true;
  fx.push(
    { type: "world", event: "networkOnline" },
    { type: "sound", name: "power" },
    { type: "anim", name: "celebrate" },
    { type: "toast", text: "RELAY NETWORK ONLINE! △ ○ □ all report in. The tower door is open.", tone: "good" },
    { type: "save" },
  );
}

export function getRegionInteraction(o: WorldObject, s: GameState, ctx: InteractionContext): Interaction | null {
  switch (o.kind) {
    case "transit":
      return transitInteraction(o, s);
    case "headlampKit":
      return s.abilities.headlamp ? null : { verb: "Fix the survey lamp", detail: "Clip it to your helmet" };
    case "lightSensor":
      if (s.flags.passageOpen) return null;
      return s.abilities.headlamp ? { verb: "Shine your headlamp", detail: "Light sensor" } : { verb: "Inspect light sensor", detail: "It needs a bright light" };
    case "powerSource":
      return { verb: "Check battery bank" };
    case "junction":
      if (s.flags.circuitRestored) return { verb: "Check junction" };
      if (s.inventory.coupling > 0) return { verb: "Install power coupling", detail: "Reconnects the circuit" };
      return { verb: "Inspect junction", detail: s.flags.junctionInspected ? "Needs a power coupling" : undefined };
    case "sampler":
      if (!s.flags.circuitRestored) return { verb: "Inspect core drill", detail: "No power" };
      return s.collected.includes("sampler") ? { verb: "Check core drill" } : { verb: "Run the core drill" };
    case "locker":
      return s.flags.lockerOpened ? null : { verb: "Open salvage locker" };
    case "relay":
      if (o.id === "relay_a" && !s.flags.relayASwept) return { verb: "Sweep the dish", detail: "Tail sweep!" };
      if (relayAligned(s, o.id)) return { verb: `Check ${o.label}`, detail: `${RELAY_SYMBOL[o.symbol ?? "tri"]} locked on` };
      return { verb: "Turn the dish", detail: `Plaque arrow: ${AIM_ARROWS[o.aim ?? 0]}` };
    case "commsJunction":
      if (s.flags.cellInstalled) return { verb: "Check relay network" };
      return s.inventory.relayCell > 0 ? { verb: "Install relay cell" } : { verb: "Inspect junction", detail: "Needs a relay power cell" };
    case "towerConsole":
      return { verb: s.flags.signalTraced ? "Replay the trace" : "Trace the signal" };
    case "acousticSensor":
      return { verb: "Bark", detail: "Say hello to the sensor" };
    default:
      void ctx;
      return null;
  }
}

export function performRegionInteraction(o: WorldObject, s: GameState, ctx: InteractionContext): Effect[] {
  const fx: Effect[] = [];
  if (!getRegionInteraction(o, s, ctx)) return fx;
  switch (o.kind) {
    case "transit":
      return performTransit(o, s);

    case "headlampKit":
      s.abilities.headlamp = true;
      fx.push(
        { type: "anim", name: "repair" },
        { type: "world", event: "headlamp", objectId: o.id },
        { type: "sound", name: "repair" },
        { type: "toast", text: "HEADLAMP! It lights the way and makes survey markings shine.", tone: "good" },
      );
      if (o.fact) fx.push({ type: "read", title: "SURVEY LAMP", lines: [o.fact] });
      fx.push({ type: "save" });
      break;

    case "lightSensor":
      fx.push({ type: "anim", name: "interact" });
      if (s.abilities.headlamp) {
        s.flags.passageOpen = true;
        fx.push({ type: "world", event: "passageOpen", objectId: o.id }, { type: "toast", text: "Click! The sensor sees your lamp and the shutter slides open.", tone: "good" }, { type: "save" });
      } else {
        fx.push({ type: "sound", name: "error" }, { type: "toast", text: "The sensor stays dark. It needs a strong light.", tone: "warn" });
      }
      break;

    case "powerSource":
      fx.push({ type: "anim", name: "interact" });
      fx.push({
        type: "toast",
        text: s.flags.circuitRestored ? "Battery bank: 61%. Feeding the whole facility." : "Battery bank: charged, but its cable runs into a broken junction.",
      });
      break;

    case "junction":
      s.flags.junctionInspected = true;
      if (s.flags.circuitRestored) {
        fx.push({ type: "anim", name: "interact" }, { type: "toast", text: "Circuit closed. Power flowing: lights, ice-chamber door, survey lift." });
      } else if (s.inventory.coupling > 0) {
        s.inventory.coupling -= 1;
        s.flags.circuitRestored = true;
        fx.push(
          { type: "anim", name: "repair" },
          { type: "spend", cost: { coupling: 1 } },
          { type: "world", event: "circuitOn", objectId: o.id },
          { type: "sound", name: "repair" },
          { type: "toast", text: "CIRCUIT RESTORED! Power is flowing to the lights, the chamber door and the lift.", tone: "good" },
          { type: "tip", key: "circuit" },
          { type: "save" },
        );
      } else {
        fx.push(
          { type: "anim", name: "interact" },
          { type: "sound", name: "error" },
          { type: "toast", text: "The coupling is cracked. A crew note mentioned a spare in the equipment room above.", tone: "warn" },
          { type: "save" },
        );
      }
      break;

    case "sampler":
      fx.push({ type: "anim", name: "interact" });
      if (!s.flags.circuitRestored) {
        fx.push({ type: "sound", name: "error" }, { type: "toast", text: "No power.", tone: "warn" });
      } else if (collectOnce(s, "sampler", "relayCell")) {
        // The same one-time drill run also gives the water-ice sample (never twice: guarded above).
        s.inventory.sample += 1;
        fx.push(
          { type: "anim", name: "repair" },
          { type: "world", event: "drill", objectId: o.id },
          { type: "item", item: "sample", objectId: "sampler", amount: 1 },
          { type: "item", item: "relayCell", objectId: "sampler", amount: 1 },
          { type: "anim", name: "celebrate" },
          { type: "toast", text: "Water-ice core AND the relay power cell! Now get the cell back to the surface.", tone: "good" },
        );
        if (o.fact) fx.push({ type: "read", title: "WATER ICE (optional)", lines: [o.fact, "Tap anywhere to close."] });
        fx.push({ type: "save" });
      } else {
        fx.push({ type: "toast", text: "Core drill idle. Its sample tray is empty." });
      }
      break;

    case "locker":
      s.flags.lockerOpened = true;
      if (collectOnce(s, o.id, "metal", 2)) {
        s.inventory.electronics += 1;
        fx.push(
          { type: "anim", name: "interact" },
          { type: "world", event: "locker", objectId: o.id },
          { type: "item", item: "metal", objectId: o.id, amount: 2 },
          { type: "item", item: "electronics", objectId: o.id, amount: 1 },
          { type: "toast", text: s.abilities.thrusters ? "Spare parts! Handy." : "Spare parts: enough for Thruster Boots at the outpost workstation.", tone: "good" },
          { type: "save" },
        );
      }
      break;

    case "relay": {
      const sym = RELAY_SYMBOL[o.symbol ?? "tri"];
      if (o.id === "relay_a" && !s.flags.relayASwept) {
        s.flags.relayASwept = true;
        fx.push(
          { type: "anim", name: "sweep" },
          { type: "world", event: "relayOn", objectId: o.id },
          { type: "toast", text: `${sym} Relay A is clean and online! Two more to go.`, tone: "good" },
          { type: "save" },
        );
      } else if (relayAligned(s, o.id)) {
        fx.push({ type: "anim", name: "interact" }, { type: "toast", text: `${sym} ${o.label}: locked on.` });
      } else {
        s.puzzles.relayAim[o.id] = ((s.puzzles.relayAim[o.id] ?? 0) + 1) % 5;
        fx.push({ type: "anim", name: "interact" }, { type: "world", event: "relayTurn", objectId: o.id }, { type: "sound", name: "mech" });
        if (relayAligned(s, o.id)) {
          fx.push({ type: "world", event: "relayOn", objectId: o.id }, { type: "toast", text: `${sym} ${o.label} locked on! The dish matches the plaque.`, tone: "good" });
        } else {
          fx.push({ type: "toast", text: `Dish turned ${AIM_ARROWS[s.puzzles.relayAim[o.id]]}. The plaque shows ${AIM_ARROWS[o.aim ?? 0]}.` });
        }
        fx.push({ type: "save" });
      }
      checkNetwork(s, fx);
      break;
    }

    case "commsJunction":
      if (!s.flags.cellInstalled && s.inventory.relayCell > 0) {
        s.inventory.relayCell -= 1;
        s.flags.cellInstalled = true;
        fx.push({ type: "anim", name: "repair" }, { type: "spend", cost: { relayCell: 1 } }, { type: "world", event: "junctionOn", objectId: o.id }, { type: "sound", name: "repair" });
        fx.push({ type: "read", title: "RIDGE JUNCTION: RELAY NETWORK", lines: networkStatus(s) }, { type: "save" });
      } else {
        fx.push({ type: "anim", name: "interact" });
        if (!s.flags.cellInstalled) fx.push({ type: "sound", name: "error" });
        fx.push({ type: "read", title: "RIDGE JUNCTION: RELAY NETWORK", lines: networkStatus(s) });
      }
      checkNetwork(s, fx);
      break;

    case "towerConsole":
      fx.push({ type: "anim", name: "interact" }, { type: "transmission", id: "towerTrace" });
      if (!s.flags.signalTraced) {
        s.flags.signalTraced = true;
        fx.push({ type: "world", event: "towerTrace", objectId: o.id }, { type: "save" });
      }
      break;

    case "acousticSensor":
      fx.push(...acousticBark(o, s));
      break;
  }
  return fx;
}

/** Ridge PUZZLE C: a bark, carried by the suit radio, wakes the sensor; it extends the cache bridge. */
export function acousticBark(o: WorldObject, s: GameState): Effect[] {
  const fx: Effect[] = [{ type: "anim", name: "bark" }, { type: "sound", name: "woof" }, { type: "world", event: "echoSensor", objectId: o.id }];
  if (!s.flags.ridgeBridgeOut) {
    s.flags.ridgeBridgeOut = true;
    fx.push({ type: "world", event: "bridgeOut", objectId: o.id });
    fx.push({ type: "read", title: "ACOUSTIC SENSOR", lines: ["Suit radio link: bark received!", o.fact ?? "", "A little bridge unfolds towards the cache."] });
    fx.push({ type: "save" });
  }
  return fx;
}
