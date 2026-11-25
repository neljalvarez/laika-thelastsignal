/**
 * Contextual interactions, as pure functions of (object, state).
 *
 * getInteraction() answers "what would E do here?" for the prompt.
 * performInteraction() mutates the state and returns presentation Effects that the scene
 * turns into animation, sound, camera moves and HUD messages. Keeping this pure means every
 * rule of the mission is unit-tested without a browser.
 */
import { ITEMS, RECIPES, type Cost, type ItemId } from "../data/items";
import { TIPS } from "../data/story";
import type { WorldObject } from "../data/world";
import { canAfford, collectOnce, count, spend } from "./inventory";
import { allPanelsClean, isPowered, SOLAR_PANELS, type GameState } from "./state";

export type WorldEvent =
  | "hatchOpen"
  | "solarRepaired"
  | "panelClean"
  | "powerOn"
  | "moduleInstalled"
  | "commsOnline"
  | "bridgeExtend"
  | "stationDoorOpen"
  | "thrusters"
  | "demoComplete"
  | "sniffUnlocked"
  | "practiceConsole"
  | "practiceCollected"
  | "practiceRepaired"
  | "echoSensor"
  | "roverBeep";

export type AnimName = "interact" | "dig" | "sweep" | "celebrate" | "repair" | "bark";

export type Effect =
  | { type: "toast"; text: string; tone?: "info" | "good" | "warn" }
  | { type: "item"; item: ItemId; objectId: string; amount: number }
  | { type: "spend"; cost: Cost }
  | { type: "transmission"; id: string }
  | { type: "tip"; key: keyof typeof TIPS }
  | { type: "anim"; name: AnimName }
  | { type: "sound"; name: string }
  | { type: "world"; event: WorldEvent; objectId?: string }
  | { type: "focus"; objectId: string }
  | { type: "read"; title: string; lines: string[] }
  | { type: "save" };

export interface Interaction {
  verb: string;
  /** Extra line: a cost or the reason something cannot be done yet. */
  detail?: string;
}

export interface InteractionContext {
  /** Buried spots currently revealed by the scanner (runtime only, not saved). */
  revealed: ReadonlySet<string>;
}

export function costText(cost: Cost): string {
  return (Object.keys(cost) as ItemId[]).map((k) => `${cost[k]} ${ITEMS[k].short}`).join(" + ");
}

function itemLabel(o: WorldObject): string {
  return o.label ?? ITEMS[o.item ?? "metal"].name;
}

export function getInteraction(o: WorldObject, s: GameState, ctx: InteractionContext): Interaction | null {
  const powered = isPowered(s);
  switch (o.kind) {
    case "shipRadio":
      return { verb: "Check radio" };
    case "hatch":
      return s.flags.hatchOpen ? null : { verb: "Open hatch" };
    case "pickup":
      return s.collected.includes(o.id) ? null : { verb: `Pick up ${itemLabel(o)}` };
    case "buried":
      if (s.collected.includes(o.id) || !s.abilities.sniff || !ctx.revealed.has(o.id)) return null;
      return { verb: "Dig" };
    case "solarControl":
      if (!s.flags.solarRepaired) {
        return canAfford(s, RECIPES.solarRepair)
          ? { verb: "Repair solar array", detail: `Uses ${costText(RECIPES.solarRepair)}` }
          : { verb: "Inspect solar array", detail: `Needs ${costText(RECIPES.solarRepair)}` };
      }
      return { verb: "Check solar array" };
    case "solarPanel":
      return s.sweptPanels.includes(o.id) ? null : { verb: "Sweep dust", detail: "Tail sweep!" };
    case "battery":
      return { verb: "Check battery" };
    case "habitat":
      return { verb: "Check habitat" };
    case "receiver":
      if (!s.flags.inspectedReceiver) return { verb: "Inspect receiver" };
      if (!s.flags.moduleInstalled) {
        return count(s, "commsModule") > 0
          ? { verb: "Install comms module" }
          : { verb: "Inspect receiver", detail: "Comms module missing" };
      }
      if (!s.flags.commsOnline) {
        return powered ? { verb: "Tune receiver" } : { verb: "Inspect receiver", detail: "No power" };
      }
      return { verb: "Replay signal" };
    case "workstation":
      if (!powered) return { verb: "Inspect workstation", detail: "No power" };
      if (!s.abilities.thrusters) {
        return canAfford(s, RECIPES.thrusterBoots)
          ? { verb: "Build Thruster Boots", detail: `Uses ${costText(RECIPES.thrusterBoots)}` }
          : { verb: "Inspect workstation", detail: `Boots need ${costText(RECIPES.thrusterBoots)}` };
      }
      return { verb: "Inspect workstation" };
    case "sign":
      return { verb: "Read sign" };
    case "log":
      return { verb: `Read ${o.label ?? "log"}` };
    case "rover":
      return { verb: "Read rover log" };
    case "bridgeControl":
      if (s.flags.bridgeExtended) return null;
      return s.flags.commsOnline ? { verb: "Extend bridge" } : { verb: "Use bridge control", detail: "No handshake code" };
    case "stationDoor":
      if (s.flags.stationDoorOpen) return null;
      return { verb: "Open door", detail: s.flags.commsOnline ? undefined : "Sealed" };
    case "beacon":
      return { verb: s.flags.demoComplete ? "Replay the signal" : "Trace the signal" };
    case "echoSensor":
      return { verb: "Bark", detail: "Say hello to the sensor" };
    case "checkpoint":
    case "secret":
    case "practiceConsole":
    case "practiceBuried":
    case "trainingMachine":
      return null; // practice objects are handled by systems/tutorial.ts
  }
}

function unlockSniff(s: GameState, fx: Effect[]): void {
  if (s.abilities.sniff) return;
  s.abilities.sniff = true;
  fx.push({ type: "world", event: "sniffUnlocked" });
}

function tipOnce(s: GameState, key: keyof typeof TIPS, fx: Effect[]): void {
  const id = `tip:${key}`;
  if (s.seen.includes(id)) return;
  s.seen.push(id);
  fx.push({ type: "tip", key });
}

function powerCheck(s: GameState, wasPowered: boolean, fx: Effect[]): void {
  if (!wasPowered && isPowered(s)) {
    fx.push({ type: "world", event: "powerOn" }, { type: "focus", objectId: "receiver" }, { type: "anim", name: "celebrate" });
    fx.push({ type: "toast", text: "POWER RESTORED! The outpost is waking up.", tone: "good" });
    tipOnce(s, "power", fx);
  }
}

/** Applies E on an object. Mutates `s`. Returns effects for presentation (empty if nothing happened). */
export function performInteraction(o: WorldObject, s: GameState, ctx: InteractionContext): Effect[] {
  const fx: Effect[] = [];
  if (!getInteraction(o, s, ctx)) return fx;
  const wasPowered = isPowered(s);
  const markSeen = () => {
    if (!s.seen.includes(o.id)) s.seen.push(o.id);
  };

  switch (o.kind) {
    case "shipRadio":
      s.flags.checkedShipRadio = true;
      fx.push({ type: "anim", name: "interact" }, { type: "sound", name: "static" }, { type: "transmission", id: "shipRadio" });
      break;

    case "hatch":
      s.flags.hatchOpen = true;
      fx.push({ type: "anim", name: "interact" }, { type: "world", event: "hatchOpen" }, { type: "save" });
      break;

    case "pickup":
    case "buried": {
      const item = o.item ?? "metal";
      if (!collectOnce(s, o.id, item)) return [];
      if (o.kind === "buried") fx.push({ type: "anim", name: "dig" });
      else fx.push({ type: "anim", name: "interact" });
      fx.push({ type: "item", item, objectId: o.id, amount: 1 });
      if (o.fact) fx.push({ type: "read", title: o.label ?? ITEMS[item].name, lines: [o.fact] });
      if (item === "commsModule") {
        fx.push({ type: "anim", name: "celebrate" }, { type: "toast", text: "Found the comms module! Take it to the receiver.", tone: "good" });
      }
      if (item === "treat") fx.push({ type: "anim", name: "celebrate" });
      fx.push({ type: "save" });
      break;
    }

    case "solarControl":
      unlockSniff(s, fx);
      if (!s.flags.solarRepaired && canAfford(s, RECIPES.solarRepair)) {
        spend(s, RECIPES.solarRepair);
        s.flags.solarRepaired = true;
        fx.push({ type: "anim", name: "repair" }, { type: "spend", cost: RECIPES.solarRepair });
        fx.push({ type: "world", event: "solarRepaired" }, { type: "sound", name: "repair" });
        fx.push({
          type: "toast",
          text: allPanelsClean(s) ? "Array repaired!" : "Array repaired! Now sweep the dust off the panels.",
          tone: "good",
        });
        powerCheck(s, wasPowered, fx);
        fx.push({ type: "save" });
      } else if (!s.flags.solarRepaired) {
        fx.push({ type: "anim", name: "interact" }, { type: "sound", name: "error" });
        fx.push({ type: "toast", text: `Frame bent, regulator missing. Needs ${costText(RECIPES.solarRepair)}.`, tone: "warn" });
      } else if (!allPanelsClean(s)) {
        fx.push({ type: "toast", text: "Repaired, but dusty. Sweep each panel with your tail!" });
      } else {
        fx.push({ type: "toast", text: "Array output: 100%. Sunny day on Mars!", tone: "good" });
      }
      break;

    case "solarPanel":
      s.sweptPanels.push(o.id);
      fx.push({ type: "anim", name: "sweep" }, { type: "world", event: "panelClean", objectId: o.id });
      tipOnce(s, "dust", fx);
      if (!s.flags.solarRepaired && allPanelsClean(s)) {
        fx.push({ type: "toast", text: "Panels clean! The array still needs repairs." });
      }
      powerCheck(s, wasPowered, fx);
      fx.push({ type: "save" });
      break;

    case "battery":
      unlockSniff(s, fx);
      fx.push({ type: "anim", name: "interact" });
      fx.push({ type: "toast", text: wasPowered ? "Battery charging: 87% and rising." : "Battery: 3%. Waiting for solar power." });
      tipOnce(s, "battery", fx);
      break;

    case "habitat":
      fx.push({ type: "anim", name: "interact" });
      fx.push({
        type: "toast",
        text: wasPowered ? "Habitat lights on. Warm inside... but nobody home." : "Habitat sealed. No power.",
      });
      break;

    case "receiver":
      unlockSniff(s, fx);
      fx.push({ type: "anim", name: "interact" });
      if (!s.flags.inspectedReceiver) {
        s.flags.inspectedReceiver = true;
        // Players who learned to sniff in Mission 00 get a line that doesn't re-teach it.
        const knew = !fx.some((e) => e.type === "world" && e.event === "sniffUnlocked");
        fx.push({ type: "sound", name: "static" }, { type: "transmission", id: knew ? "receiverInspectKnown" : "receiverInspect" }, { type: "save" });
      } else if (!s.flags.moduleInstalled) {
        if (count(s, "commsModule") > 0) {
          s.inventory.commsModule -= 1;
          s.flags.moduleInstalled = true;
          fx.push({ type: "anim", name: "repair" });
          fx.push({ type: "spend", cost: { commsModule: 1 } }, { type: "world", event: "moduleInstalled" }, { type: "sound", name: "repair" });
          fx.push({
            type: "toast",
            text: wasPowered ? "Module installed! Now tune the receiver." : "Module installed! The receiver still needs power.",
            tone: "good",
          });
          fx.push({ type: "save" });
        } else {
          fx.push({ type: "sound", name: "error" }, { type: "toast", text: "The comms module is missing. Try sniffing in the canyon.", tone: "warn" });
        }
      } else if (!s.flags.commsOnline) {
        if (wasPowered) {
          s.flags.commsOnline = true;
          fx.push({ type: "world", event: "commsOnline" }, { type: "transmission", id: "firstSignal" });
          tipOnce(s, "radio", fx);
          fx.push({ type: "save" });
        } else {
          fx.push({ type: "sound", name: "error" }, { type: "toast", text: "No power. Repair and clean the solar array.", tone: "warn" });
        }
      } else {
        fx.push({ type: "transmission", id: "firstSignal" });
      }
      break;

    case "workstation":
      fx.push({ type: "anim", name: "interact" });
      if (!wasPowered) {
        fx.push({ type: "sound", name: "error" }, { type: "toast", text: "Fabricator offline. No power.", tone: "warn" });
      } else if (!s.abilities.thrusters && canAfford(s, RECIPES.thrusterBoots)) {
        spend(s, RECIPES.thrusterBoots);
        s.abilities.thrusters = true;
        fx.push({ type: "anim", name: "repair" });
        fx.push({ type: "spend", cost: RECIPES.thrusterBoots }, { type: "world", event: "thrusters" }, { type: "anim", name: "celebrate" });
        fx.push({ type: "toast", text: "THRUSTER BOOTS! Press JUMP again in mid-air.", tone: "good" }, { type: "save" });
      } else if (!s.abilities.thrusters) {
        fx.push({ type: "toast", text: `Fabricator ready. Thruster Boots need ${costText(RECIPES.thrusterBoots)}.` });
      } else {
        fx.push({ type: "toast", text: "Boots fitted. The fabricator hums happily." });
      }
      break;

    case "sign":
    case "log":
    case "rover":
      markSeen();
      fx.push({ type: "read", title: o.text?.[0] ?? "", lines: o.text?.slice(1) ?? [] });
      break;

    case "bridgeControl":
      fx.push({ type: "anim", name: "interact" });
      if (s.flags.commsOnline) {
        s.flags.bridgeExtended = true;
        fx.push({ type: "world", event: "bridgeExtend" }, { type: "focus", objectId: "bridgeControl" }, { type: "save" });
      } else {
        fx.push({ type: "sound", name: "error" }, { type: "toast", text: "NO HANDSHAKE CODE. The outpost radio must be online.", tone: "warn" });
      }
      break;

    case "stationDoor":
      fx.push({ type: "anim", name: "interact" });
      if (s.flags.commsOnline) {
        s.flags.stationDoorOpen = true;
        fx.push({ type: "world", event: "stationDoorOpen" }, { type: "save" });
      } else {
        fx.push({ type: "sound", name: "error" }, { type: "toast", text: "SEALED. Awaiting handshake code.", tone: "warn" });
      }
      break;

    case "beacon":
      fx.push({ type: "anim", name: "interact" }, { type: "transmission", id: "finalSignal" });
      if (!s.flags.demoComplete) {
        s.flags.demoComplete = true;
        fx.push({ type: "world", event: "demoComplete" }, { type: "save" });
      }
      break;

    case "echoSensor":
      fx.push(...barkEffects(o, s));
      break;
    case "checkpoint":
    case "secret":
    case "practiceConsole":
    case "practiceBuried":
    case "trainingMachine":
      break;
  }
  return fx;
}

/**
 * Bark: a lightweight, optional dog ability. Barking near the echo sensor makes it answer (and
 * teaches a sound fact the first time); near the rover, R-2's camera mast perks up. Anywhere
 * else it is just Laika being a happy dog. Never required for the mission.
 */
export function barkEffects(near: WorldObject | null, s: GameState): Effect[] {
  const fx: Effect[] = [{ type: "anim", name: "bark" }, { type: "sound", name: "woof" }];
  if (near?.kind === "echoSensor") {
    fx.push({ type: "world", event: "echoSensor", objectId: near.id });
    if (!s.seen.includes(near.id)) {
      s.seen.push(near.id);
      if (near.fact) fx.push({ type: "read", title: "ECHO SENSOR", lines: ["Bark detected! Playing it back...", near.fact] });
      fx.push({ type: "save" });
    }
  } else if (near?.kind === "rover") {
    fx.push({ type: "world", event: "roverBeep", objectId: near.id });
  }
  return fx;
}

/** Re-export for the scene's "every panel" checks. */
export { SOLAR_PANELS };
