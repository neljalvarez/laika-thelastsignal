/**
 * Phase 5: the workbench. A few large equipment cards (icon, name, cost); the selected card shows
 * one benefit line, have/need per material and one BUILD button. Details are optional.
 */
import { eqIconUrl } from "../art/icons";
import { EQUIPMENT, type EquipmentId } from "../data/equipment";
import { ITEMS } from "../data/items";
import type { CraftCard } from "../systems/crafting";

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

const costLine = (c: CraftCard) => c.need.map((n) => `${n.need} ${ITEMS[n.item].short.toLowerCase()}`).join(" · ");

export function workbenchCard(
  cards: CraftCard[],
  materials: { metal: number; circuits: number },
  selected: EquipmentId,
  showDetail: boolean,
  on: { select: (id: EquipmentId) => void; build: (id: EquipmentId) => void; detail: () => void; close: () => void },
): HTMLElement {
  const card = el("div", "menu-card px-panel bench-card");
  const head = el("div", "bench-head");
  head.append(el("h2", "", "Workbench"), el("span", "bench-mats", `Metal ${materials.metal} · Circuits ${materials.circuits}`));
  card.append(head);
  const grid = el("div", "bench-grid");
  for (const c of cards) {
    const def = EQUIPMENT[c.id];
    const b = btn("", () => on.select(c.id), `bench-item ${c.status}${c.id === selected ? " sel" : ""}`);
    b.setAttribute("aria-pressed", String(c.id === selected));
    b.setAttribute("aria-label", `${def.name}: ${c.status === "built" ? "built" : costLine(c)}`);
    const img = el("img");
    img.src = eqIconUrl(def.icon, 4);
    img.alt = "";
    b.append(img, el("span", "nm", def.name), el("span", "cost", c.status === "built" ? "✔ Built" : c.status === "locked" ? "🔒" : costLine(c)));
    grid.append(b);
  }
  card.append(grid);
  const c = cards.find((x) => x.id === selected) ?? cards[0];
  if (c) {
    const def = EQUIPMENT[c.id];
    const det = el("div", "bench-detail");
    det.append(el("h3", "", def.name), el("p", "benefit", def.benefit));
    if (showDetail) det.append(el("p", "fine", def.detail));
    const needs = el("div", "bench-needs");
    for (const n of c.need) needs.append(el("span", n.have >= n.need ? "ok" : "short", `${ITEMS[n.item].short}: ${Math.min(n.have, 99)}/${n.need}${n.have >= n.need ? " ✔" : ""}`));
    det.append(needs);
    const label =
      c.status === "built" ? "✔ BUILT" : c.status === "locked" ? c.lockedBy ?? "LOCKED" : c.status === "noPower" ? "NO POWER" : c.status === "missing" ? "NEED MORE PARTS" : "BUILD";
    const build = btn(label, () => on.build(c.id), `px-btn big build-btn${c.status === "ready" ? "" : " off"}`);
    build.disabled = c.status !== "ready";
    det.append(build);
    card.append(det);
  }
  const row = el("div", "base-buttons");
  row.append(btn(showDetail ? "Less" : "Details", on.detail, "px-btn secondary small"), btn("Close", on.close, "px-btn secondary"));
  card.append(row);
  return card;
}
