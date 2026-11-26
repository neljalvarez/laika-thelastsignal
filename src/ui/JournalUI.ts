/**
 * Phase 5: the Journal (Pause → Journal). Everything optional lives here instead of on screen:
 * Gear (equipment and looks), Science, Radio (the full transmissions) and Progress (collectibles).
 */
import { eqIconUrl } from "../art/icons";
import { COSMETIC_ORDER, COSMETICS, EQUIPMENT, EQUIPMENT_ORDER, type CosmeticId } from "../data/equipment";
import type { ScienceCategory } from "../data/science";
import { TRANSMISSIONS } from "../data/story";
import { cosmeticUnlocked, hasGear, knowsBlueprint } from "../systems/crafting";
import { journal } from "../systems/mission";
import type { GameState } from "../systems/state";
import { scienceCard } from "./BaseUI";

export type JournalTab = "gear" | "science" | "radio" | "progress";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function btn(label: string, onClick: () => void, cls: string): HTMLButtonElement {
  const b = el("button", cls, label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

/** Story order of the transmissions, for the radio log. */
const RADIO_ORDER = ["wake", "shipRadio", "receiverInspect", "receiverInspectKnown", "firstSignal", "finalSignal", "relayLogs", "relayAnalysis", "towerTrace", "m4Brief", "m4Final", "m5Brief", "m5Final"];

export interface JournalView {
  tab: JournalTab;
  sciCategory: ScienceCategory;
  sciOpen: string | null;
}

export function journalCard(
  s: GameState,
  v: JournalView,
  on: { tab: (t: JournalTab) => void; sciCategory: (c: ScienceCategory) => void; sciOpen: (id: string | null) => void; wear: (id: CosmeticId) => void; close: () => void },
): HTMLElement {
  const card = el("div", "menu-card px-panel journal-card");
  card.append(el("h2", "", "Journal"));
  const tabs = el("div", "settings-tabs");
  tabs.setAttribute("role", "tablist");
  for (const [id, label] of [
    ["gear", "Gear"],
    ["science", "Science"],
    ["radio", "Radio"],
    ["progress", "Progress"],
  ] as Array<[JournalTab, string]>) {
    const b = btn(label, () => on.tab(id), `tab-btn${v.tab === id ? " on" : ""}`);
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(v.tab === id));
    tabs.append(b);
  }
  card.append(tabs);
  const body = el("div", "journal-body");
  if (v.tab === "gear") {
    const grid = el("div", "gear-grid");
    for (const id of EQUIPMENT_ORDER) {
      const def = EQUIPMENT[id];
      const built = hasGear(s, id);
      const known = knowsBlueprint(s, id);
      const item = el("div", `gear-item${built ? " built" : known ? " known" : " unknown"}`);
      const img = el("img");
      img.src = eqIconUrl(def.icon, 3);
      img.alt = "";
      item.append(img, el("span", "nm", known ? def.name : "???"), el("span", "st", built ? "✔ Built" : known ? "Blueprint" : "Not found yet"));
      if (built) item.title = def.benefit;
      grid.append(item);
    }
    body.append(el("h3", "", "Equipment"), grid, el("h3", "", "Looks"));
    const looks = el("div", "look-grid");
    for (const id of COSMETIC_ORDER) {
      const c = COSMETICS[id];
      const unlocked = cosmeticUnlocked(s, id);
      const on2 = s.gear.wear.includes(id);
      if (unlocked) {
        const b = btn("", () => on.wear(id), `look-btn${on2 ? " on" : ""}`);
        b.append(el("span", "", c.name), el("span", "fine", on2 ? "✔ Wearing" : "Tap to wear"));
        b.setAttribute("aria-pressed", String(on2));
        looks.append(b);
      } else {
        const d = el("div", "look-btn locked");
        d.append(el("span", "", "🔒 ???"), el("span", "fine", c.how));
        looks.append(d);
      }
    }
    body.append(looks);
  } else if (v.tab === "science") {
    body.append(scienceCard(s, v.sciCategory, v.sciOpen, on.sciCategory, on.sciOpen, on.close, true));
  } else if (v.tab === "radio") {
    const heard = RADIO_ORDER.filter((id) => s.seen.includes(`tx:${id}`) && TRANSMISSIONS[id]);
    if (!heard.length) body.append(el("p", "fine", "Nothing yet."));
    for (const id of heard) {
      const t = TRANSMISSIONS[id];
      const entry = el("div", "radio-entry");
      entry.append(el("h3", "", t.title));
      for (const l of t.full ?? t.lines) entry.append(el("p", l.static ? "static" : "", `${l.speaker}: ${l.text}`));
      body.append(entry);
    }
  } else {
    const ul = el("ul", "base-list");
    for (const j of journal(s)) {
      const li = el("li", j.have >= j.total ? "ok" : "");
      li.append(el("span", "sym", j.have >= j.total ? "✔" : "•"), el("span", "nm", j.label), el("span", "st", `${Math.min(j.have, j.total)}/${j.total}`));
      ul.append(li);
    }
    body.append(ul, el("p", "fine", `Play time: about ${Math.max(1, Math.round(s.playTimeMs / 60000))} min`));
  }
  card.append(body, btn("Close", on.close, "px-btn"));
  return card;
}
