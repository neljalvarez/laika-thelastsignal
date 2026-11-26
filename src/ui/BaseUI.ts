/**
 * Phase 4 DOM overlays: the suit-energy meter and power chip in the HUD, the Base Status screen
 * (simple and detailed views), the power distribution console and the Science Journal.
 *
 * Status is always told with a word and a symbol as well as a colour. Numbers are fictional game
 * units (PU power, BU battery, SE suit energy); the detailed view says so.
 */
import { sciIconUrl } from "../art/icons";
import { FACILITIES, OPTIONAL_SYSTEMS, SUIT, type FacilityId, type OptionalSystem, type SurvivalMode } from "../data/engineering";
import { CATEGORIES, SCIENCE, type ScienceCategory } from "../data/science";
import { allocationFits, plantStage, recommendedAllocation, restorationProgress, STAGE_NAMES, type PowerStatus } from "../systems/engineering";
import { SURVIVAL_LABELS, suitActive, suitMaxOf } from "../systems/survival";
import type { GameState } from "../systems/state";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function btn(label: string, onClick: () => void, cls = "px-btn secondary"): HTMLButtonElement {
  const b = el("button", cls, label);
  b.type = "button";
  b.addEventListener("click", onClick);
  return b;
}

type Health = "ok" | "paused" | "offline" | "brownout";
const HEALTH_WORD: Record<Health, string> = { ok: "Working", paused: "Off", offline: "Needs repair", brownout: "Low power" };
const HEALTH_SYM: Record<Health, string> = { ok: "✔", paused: "■", offline: "✖", brownout: "!" };

export function facilityHealth(id: FacilityId, s: GameState, p: PowerStatus): Health {
  if (!p.restored[id]) return "offline";
  if (id === "solar") return p.sun < 1 ? "brownout" : "ok";
  if (id === "battery") return p.battery <= 0 && p.net < 0 ? "brownout" : "ok";
  if ((p.brownout as FacilityId[]).includes(id)) return "brownout";
  if ((OPTIONAL_SYSTEMS as FacilityId[]).includes(id) && !s.eng.alloc[id as OptionalSystem]) return "paused";
  return p.powered[id] ? "ok" : "offline";
}

// ---------------------------------------------------------------------------
// HUD: suit meter + power chip (only from Mission 04)
// ---------------------------------------------------------------------------
export class BaseHud {
  readonly el: HTMLElement;
  private suitFill: HTMLElement;
  private suitText: HTMLElement;
  private suitEl: HTMLElement;
  private powerEl: HTMLElement;
  private last = "";

  constructor() {
    this.el = el("div", "hud-base hidden");
    this.suitEl = el("div", "suit-meter px-panel");
    this.suitEl.setAttribute("role", "meter");
    this.suitEl.setAttribute("aria-label", "Suit energy");
    this.suitEl.setAttribute("aria-valuemin", "0");
    this.suitEl.setAttribute("aria-valuemax", String(SUIT.max));
    const bar = el("div", "suit-bar");
    this.suitFill = el("div", "suit-fill");
    bar.append(this.suitFill);
    this.suitText = el("span", "suit-text");
    this.suitEl.append(el("span", "suit-sym", "ϟ"), bar, this.suitText);
    this.powerEl = el("div", "power-chip px-panel");
    this.powerEl.setAttribute("aria-label", "Base power");
    this.el.append(this.suitEl, this.powerEl);
  }

  update(s: GameState, p: PowerStatus, mode: SurvivalMode, show: { suit: boolean; power: boolean } = { suit: true, power: true }): void {
    const on = suitActive(s);
    const max = suitMaxOf(s);
    const pct = Math.round((s.eng.suit / max) * 100);
    const low = mode !== "relaxed" && pct <= 25;
    const trend = p.trend > 0 ? "▲" : p.trend < 0 ? "▼" : "•";
    const bat = p.storage ? `${Math.round((p.battery / p.capacity) * 100)}%` : "--";
    const key = `${on}|${pct}|${low}|${trend}|${bat}|${p.haze}|${mode}|${show.suit}|${show.power}`;
    if (key === this.last) return;
    this.last = key;
    this.el.classList.toggle("hidden", !on || (!show.suit && !show.power));
    this.suitEl.classList.toggle("hidden", !show.suit);
    this.powerEl.classList.toggle("hidden", !show.power);
    this.suitFill.style.width = `${pct}%`;
    this.suitText.textContent = mode === "relaxed" ? "SUIT ∞" : `${pct}%${low ? " LOW" : ""}`;
    this.suitEl.classList.toggle("low", low);
    this.suitEl.setAttribute("aria-valuenow", String(Math.round(s.eng.suit)));
    this.suitEl.title = low ? "Suit low: recharge at a ϟ post. Walking still works." : "Suit energy";
    this.powerEl.textContent = `${p.haze ? "⚠ Low power" : `☀ Base ${bat}`}`;
    this.powerEl.classList.toggle("alert", p.haze);
    this.powerEl.title = p.storage ? `Battery ${bat}, ${p.trend > 0 ? "charging" : p.trend < 0 ? "draining" : "steady"}` : "Battery not restored yet";
  }
}

// ---------------------------------------------------------------------------
// Base Status
// ---------------------------------------------------------------------------
const ORDER: FacilityId[] = ["solar", "battery", "habitat", "lifeSupport", "shelter", "water", "greenhouse", "research"];

export function baseStatusCard(s: GameState, p: PowerStatus, mode: SurvivalMode, detailed: boolean, onToggle: () => void, onClose: () => void): HTMLElement {
  const card = el("div", "menu-card px-panel base-card");
  const prog = restorationProgress(s);
  card.append(el("h2", "", "Base"));
  card.append(el("p", "base-sub", `${prog.done} of ${prog.total} fixed${p.haze ? " · ⚠ Dust haze" : ""}`));

  // Advanced: the network diagram (sun → battery → machines; water → life support and plants).
  const diagram = el("div", "base-diagram");
  diagram.setAttribute("aria-hidden", "true");
  const node = (id: FacilityId) => {
    const h = facilityHealth(id, s, p);
    const n = el("div", `base-node ${h}`);
    n.append(el("span", "sym", FACILITIES[id].symbol), el("span", "nm", FACILITIES[id].name.replace(" Station", "").replace(" System", "")), el("span", "st", HEALTH_SYM[h]));
    return n;
  };
  const row1 = el("div", "base-row");
  row1.append(node("solar"), el("span", "arrow", "→"), node("battery"), el("span", "arrow", "→"));
  const col = el("div", "base-col");
  for (const id of ["habitat", "lifeSupport", "shelter", "greenhouse"] as FacilityId[]) col.append(node(id));
  row1.append(col);
  const row2 = el("div", "base-row water");
  row2.append(node("water"), el("span", "arrow", "→ Life Support + Greenhouse"));
  diagram.append(row1, row2);
  if (detailed) card.append(diagram);

  const list = el("ul", "base-list");
  for (const id of ORDER) {
    const h = facilityHealth(id, s, p);
    const li = el("li", h);
    const word = id === "battery" && h === "ok" ? "Ready" : id === "greenhouse" && h === "ok" && s.flags.seedsPlanted && plantStage(s) < 4 ? "Growing" : HEALTH_WORD[h];
    li.append(el("span", "sym", FACILITIES[id].symbol), el("span", "nm", FACILITIES[id].name.replace(" Station", "").replace(" System", "").replace(" Array", "").replace("Radiation ", "")), el("span", "st", `${HEALTH_SYM[h]} ${word}`));
    if (detailed) {
      const d = FACILITIES[id];
      li.append(el("span", "det", d.demand ? `${d.demand} PU${d.critical ? " · critical" : ""}` : d.role));
    }
    list.append(li);
  }
  card.append(list);

  if (detailed) {
    const dl = el("div", "base-detail");
    const line = (k: string, v: string) => {
      const r = el("div", "kv");
      r.append(el("span", "k", k), el("span", "v", v));
      dl.append(r);
    };
    line("Sunlight", `${Math.round(p.sun * 100)}%${p.haze ? " (dust haze)" : ""}`);
    line("Solar output", `${p.gen.toFixed(1)} PU`);
    line("Machines use", `${p.use.toFixed(1)} PU${p.requested > p.use ? ` (asked ${p.requested})` : ""}`);
    line("Battery", p.storage ? `${p.battery.toFixed(0)} / ${p.capacity} BU ${p.trend > 0 ? "▲ charging" : p.trend < 0 ? "▼ draining" : "• steady"}` : "not restored");
    if (s.flags.seedsPlanted) line("Greenhouse", STAGE_NAMES[plantStage(s)]);
    line("Suit energy", mode === "relaxed" ? "unlimited (Relaxed)" : `${Math.round(s.eng.suit)} / ${SUIT.max} SE`);
    line("Survival assistance", SURVIVAL_LABELS[mode].name);
    dl.append(el("p", "fine", "PU, BU and SE are made-up game units, not real watts or watt-hours."));
    card.append(dl);
  }
  const row = el("div", "base-buttons");
  row.append(btn(detailed ? "Simple" : "Advanced details", onToggle, "px-btn secondary small"), btn("Close", onClose, "px-btn"));
  card.append(row);
  return card;
}

// ---------------------------------------------------------------------------
// Distribution console
// ---------------------------------------------------------------------------
export function distributionCard(
  s: GameState,
  p: PowerStatus,
  mode: SurvivalMode,
  draft: Record<OptionalSystem, boolean>,
  onDraft: (d: Record<OptionalSystem, boolean>) => void,
  onApply: () => void,
  onClose: () => void,
): HTMLElement {
  const card = el("div", "menu-card px-panel dist-card");
  card.append(el("h2", "", "Power"));
  card.append(el("p", "base-sub", p.haze ? "⚠ Dust haze: less power. Pick what stays on." : "Life support always stays on."));
  const fits = allocationFits(s, mode, draft);
  const critical = (["habitat", "lifeSupport", "shelter"] as FacilityId[]).filter((id) => p.restored[id]);
  const list = el("div", "dist-list");
  for (const id of critical) {
    const r = el("div", "dist-row locked");
    r.append(el("span", "sym", FACILITIES[id].symbol), el("span", "nm", FACILITIES[id].name), el("span", "pu", "▮".repeat(FACILITIES[id].demand)), el("span", "lock", "🔒 Always on"));
    list.append(r);
  }
  for (const id of OPTIONAL_SYSTEMS) {
    const r = el("label", "dist-row");
    const box = el("input");
    box.type = "checkbox";
    box.checked = draft[id];
    box.disabled = !p.restored[id];
    box.addEventListener("change", () => onDraft({ ...draft, [id]: box.checked }));
    r.append(box, el("span", "sym", FACILITIES[id].symbol), el("span", "nm", FACILITIES[id].name), el("span", "pu", "▮".repeat(FACILITIES[id].demand)), el("span", "lock", !p.restored[id] ? "Broken" : draft[id] ? "ON" : "OFF"));
    list.append(r);
  }
  card.append(list);
  // Supply vs demand bar, with words.
  const want = critical.reduce((a, id) => a + FACILITIES[id].demand, 0) + OPTIONAL_SYSTEMS.filter((id) => draft[id] && p.restored[id]).reduce((a, id) => a + FACILITIES[id].demand, 0);
  const bar = el("div", `dist-bar ${fits ? "ok" : "over"}`);
  const fill = el("div", "dist-fill");
  fill.style.width = `${Math.min(100, (want / Math.max(1, p.gen)) * 100)}%`;
  bar.append(fill);
  card.append(bar, el("p", `dist-verdict ${fits ? "ok" : "over"}`, fits ? "✔ Enough power" : "! Not enough power"));
  bar.title = `${want} PU wanted · ${p.gen.toFixed(1)} PU made (game units)`;
  const row = el("div", "base-buttons");
  row.append(
    btn("Recommended", () => onDraft(recommendedAllocation(s, mode))),
    btn("Apply", onApply, "px-btn"),
    btn("Close", onClose),
  );
  card.append(row);
  return card;
}

// ---------------------------------------------------------------------------
// Science journal
// ---------------------------------------------------------------------------
export function scienceCard(s: GameState, category: ScienceCategory, open: string | null, onCategory: (c: ScienceCategory) => void, onOpen: (id: string | null) => void, onClose: () => void, embedded = false): HTMLElement {
  const card = el("div", embedded ? "sci-body" : "menu-card px-panel sci-card");
  const have = SCIENCE.filter((e) => s.science.includes(e.id)).length;
  if (!embedded) card.append(el("h2", "", "Science Journal"));
  card.append(el("p", "base-sub", `${have} of ${SCIENCE.length} found`));
  const tabs = el("div", "sci-tabs");
  tabs.setAttribute("role", "tablist");
  for (const c of CATEGORIES) {
    const n = SCIENCE.filter((e) => e.category === c.id && s.science.includes(e.id)).length;
    const t = btn("", () => onCategory(c.id), `sci-tab${c.id === category ? " on" : ""}`);
    t.setAttribute("role", "tab");
    t.setAttribute("aria-selected", String(c.id === category));
    const img = el("img");
    img.src = sciIconUrl(c.icon);
    img.alt = "";
    t.append(img, el("span", "", `${c.name} (${n})`));
    tabs.append(t);
  }
  card.append(tabs);
  const list = el("div", "sci-list");
  for (const e of SCIENCE.filter((x) => x.category === category)) {
    const unlocked = s.science.includes(e.id);
    const item = el("div", `sci-entry${unlocked ? "" : " locked"}`);
    if (!unlocked) {
      item.append(el("h3", "", "??? Not discovered yet"), el("p", "fine", "Keep exploring and restoring the base."));
    } else {
      item.append(el("h3", "", e.title), el("p", "", e.short));
      if (open === e.id) {
        item.append(el("p", "", e.more), el("p", "fiction", `In the game: ${e.fiction}`));
        const a = el("a", "src", `Source: ${e.source.label}`);
        a.href = e.source.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        item.append(a);
      }
      item.append(btn(open === e.id ? "Less" : "Learn more", () => onOpen(open === e.id ? null : e.id), "px-btn secondary small"));
    }
    list.append(item);
  }
  card.append(list);
  if (!embedded) card.append(btn("Close", onClose, "px-btn"));
  return card;
}
