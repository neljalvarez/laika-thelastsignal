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
import { allPanelsClean, gearReady, isPowered, SOLAR_PANELS, type GameState } from "./state";

export type { AnimName, Effect, Interaction, InteractionContext, WorldEvent } from "./effects";
import type { Effect, Interaction, InteractionContext } from "./effects";
import { acousticBark, getRegionInteraction, performRegionInteraction } from "./puzzles";
import { performPhase4, phase4Interaction, syncScience } from "./facilities";

export function costText(cost: Cost): string {
  return (Object.keys(cost) as ItemId[]).map((k) => `${cost[k]} ${ITEMS[k].short}`).join(" + ");
}

export function getInteraction(o: WorldObject, s: GameState, ctx: InteractionContext): Interaction | null {
  // Phase 4 first: new kinds, plus Mission 04 behaviour of a few older objects (battery, habitat...).
  const p4 = phase4Interaction(o, s, ctx);
  if (p4 !== undefined) return p4;
  const powered = isPowered(s);
  switch (o.kind) {
    case "shipRadio":
      return { verb: "Check radio" };
    case "hatch":
      return s.flags.hatchOpen ? null : { verb: "Open hatch" };
    case "pickup":
      return s.collected.includes(o.id) || !gearReady(s, o.needs) ? null : { verb: `Take ${ITEMS[o.item ?? "metal"].name}` };
    case "buried":
      if (s.collected.includes(o.id) || !s.abilities.sniff || !ctx.revealed.has(o.id) || !gearReady(s, o.needs)) return null;
      return { verb: "Dig" };
    case "solarControl":
      if (!s.flags.solarRepaired) {
        return canAfford(s, RECIPES.solarRepair)
          ? { verb: "Fix solar box", detail: costText(RECIPES.solarRepair) }
          : { verb: "Check solar box", detail: `Needs ${costText(RECIPES.solarRepair)}` };
      }
      return { verb: "Solar box" };
    case "solarPanel":
      return s.sweptPanels.includes(o.id) ? null : { verb: "Sweep" };
    case "battery":
      return { verb: "Check battery" };
    case "habitat":
      return { verb: "Check habitat" };
    case "receiver":
      if (!s.flags.inspectedReceiver) return { verb: "Check radio" };
      if (!s.flags.moduleInstalled) {
        return count(s, "commsModule") > 0
          ? { verb: "Fix radio" }
          : { verb: "Check radio", detail: "Part missing" };
      }
      if (!s.flags.commsOnline) {
        return powered ? { verb: "Tune radio" } : { verb: "Check radio", detail: "No power" };
      }
      // Phase 3: Mission 02 ends here, when Laika brings the relay cell up from the depths.
      if (!s.flags.relayAnalyzed && s.inventory.relayCell > 0) return { verb: "Decode cell" };
      return { verb: "Radio" };
    case "workstation":
      if (!powered) return { verb: "Workbench", detail: "No power" };
      if (!s.abilities.thrusters) {
        return canAfford(s, RECIPES.thrusterBoots)
          ? { verb: "Build Thruster Boots", detail: `Uses ${costText(RECIPES.thrusterBoots)}` }
          : { verb: "Inspect workstation", detail: `Boots need ${costText(RECIPES.thrusterBoots)}` };
      }
      return { verb: "Inspect workstation" };
    case "sign":
      return { verb: "Read" };
    case "log":
      return { verb: "Read" };
    case "rover":
      return { verb: "Read" };
    case "bridgeControl":
      if (s.flags.bridgeExtended) return null;
      return s.flags.commsOnline ? { verb: "Extend bridge" } : { verb: "Bridge", detail: "Locked" };
    case "stationDoor":
      if (s.flags.stationDoorOpen) return null;
      return { verb: "Open door", detail: s.flags.commsOnline ? undefined : "Locked" };
    case "beacon":
      if (s.flags.demoComplete && !s.flags.m2Briefed) return { verb: "Read logs" };
      return { verb: s.flags.demoComplete ? "Listen" : "Trace signal" };
    case "echoSensor":
      return { verb: "Bark" };
    case "checkpoint":
    case "secret":
    case "practiceConsole":
    case "practiceBuried":
    case "trainingMachine":
      return null; // practice objects are handled by systems/tutorial.ts
    default:
      return getRegionInteraction(o, s, ctx); // Phase 3 kinds (systems/puzzles.ts)
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
    fx.push({ type: "toast", text: "Power on!", tone: "good" });
    tipOnce(s, "power", fx);
  }
}

/** Applies E on an object. Mutates `s`. Returns effects for presentation (empty if nothing happened). */
export function performInteraction(o: WorldObject, s: GameState, ctx: InteractionContext): Effect[] {
  const fx = performInteractionInner(o, s, ctx);
  // Phase 4: the science journal follows achievements (a quiet caption, never a pop-up).
  for (const id of syncScience(s)) fx.push({ type: "science", id });
  return fx;
}

function performInteractionInner(o: WorldObject, s: GameState, ctx: InteractionContext): Effect[] {
  const p4 = performPhase4(o, s, ctx);
  if (p4 !== undefined) return p4;
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
      if (item === "navBeacon") {
        s.flags.beaconFound = true;
        fx.push({ type: "world", event: "beaconFound", objectId: o.id }, { type: "save" });
      }
      if (o.fact) fx.push({ type: "read", title: o.label ?? ITEMS[item].name, lines: [o.fact] });
      else if (o.text) fx.push({ type: "read", title: o.text[0], lines: o.text.slice(1) });
      // (item toast says it all)
      if (item === "commsModule") {
        fx.push({ type: "anim", name: "celebrate" });
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
          text: "Solar box fixed!",
          tone: "good",
        });
        powerCheck(s, wasPowered, fx);
        fx.push({ type: "save" });
      } else if (!s.flags.solarRepaired) {
        fx.push({ type: "anim", name: "interact" }, { type: "sound", name: "error" });
        fx.push({ type: "toast", text: `Needs ${costText(RECIPES.solarRepair)}`, tone: "warn" });
      } else if (!allPanelsClean(s)) {
        fx.push({ type: "toast", text: "Sweep the panels" });
      } else {
        fx.push({ type: "toast", text: "Working" });
      }
      break;

    case "solarPanel":
      s.sweptPanels.push(o.id);
      fx.push({ type: "anim", name: "sweep" }, { type: "world", event: "panelClean", objectId: o.id });
      tipOnce(s, "dust", fx);
      if (!s.flags.solarRepaired && allPanelsClean(s)) {
        fx.push({ type: "toast", text: "Panels clean" });
      }
      powerCheck(s, wasPowered, fx);
      fx.push({ type: "save" });
      break;

    case "battery":
      unlockSniff(s, fx);
      fx.push({ type: "anim", name: "interact" });
      fx.push({ type: "toast", text: wasPowered ? "Battery charging" : "No power" });
      tipOnce(s, "battery", fx);
      break;

    case "habitat":
      fx.push({ type: "anim", name: "interact" });
      fx.push({
        type: "toast",
        text: wasPowered ? "Warm inside" : "No power",
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
            text: wasPowered ? "Radio fixed!" : "Part in. Needs power",
            tone: "good",
          });
          fx.push({ type: "save" });
        } else {
          fx.push({ type: "sound", name: "error" }, { type: "toast", text: "Part missing. Sniff east!", tone: "warn" });
        }
      } else if (!s.flags.commsOnline) {
        if (wasPowered) {
          s.flags.commsOnline = true;
          fx.push({ type: "world", event: "commsOnline" }, { type: "transmission", id: "firstSignal" });
          tipOnce(s, "radio", fx);
          fx.push({ type: "save" });
        } else {
          fx.push({ type: "sound", name: "error" }, { type: "toast", text: "No power. Fix the solar panels", tone: "warn" });
        }
      } else if (!s.flags.relayAnalyzed && s.inventory.relayCell > 0) {
        s.flags.relayAnalyzed = true;
        fx.push({ type: "anim", name: "repair" }, { type: "transmission", id: "relayAnalysis" }, { type: "world", event: "mission02Complete" }, { type: "save" });
      } else {
        fx.push({ type: "transmission", id: "firstSignal" });
      }
      break;

    case "workstation":
      fx.push({ type: "anim", name: "interact" });
      if (!wasPowered) {
        fx.push({ type: "sound", name: "error" }, { type: "toast", text: "No power", tone: "warn" });
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
        fx.push({ type: "sound", name: "error" }, { type: "toast", text: "Locked. Fix the radio first", tone: "warn" });
      }
      break;

    case "stationDoor":
      fx.push({ type: "anim", name: "interact" });
      if (s.flags.commsOnline) {
        s.flags.stationDoorOpen = true;
        fx.push({ type: "world", event: "stationDoorOpen" }, { type: "save" });
      } else {
        fx.push({ type: "sound", name: "error" }, { type: "toast", text: "Locked", tone: "warn" });
      }
      break;

    case "beacon":
      if (s.flags.demoComplete && !s.flags.m2Briefed) {
        s.flags.m2Briefed = true;
        fx.push({ type: "anim", name: "interact" }, { type: "transmission", id: "relayLogs" }, { type: "world", event: "freightUnlocked" }, { type: "save" });
        break;
      }
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
    default:
      return performRegionInteraction(o, s, ctx);
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
      if (near.fact) fx.push({ type: "read", title: "ECHO SENSOR", lines: ["Woof... woof!", near.fact] });
      fx.push({ type: "save" });
    }
  } else if (near?.kind === "rover") {
    fx.push({ type: "world", event: "roverBeep", objectId: near.id });
  } else if (near?.kind === "acousticSensor") {
    return acousticBark(near, s);
  }
  return fx;
}

/** Re-export for the scene's "every panel" checks. */
export { SOLAR_PANELS };
