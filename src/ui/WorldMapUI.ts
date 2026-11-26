/**
 * The world map: a retro survey-journal cross-section (x = east, y = depth/height).
 *
 * It reveals what Laika has actually explored: discovered sections are filled in, unexplored parts
 * of a visited region are dotted outlines, regions she only knows about (she has seen a lift or
 * gate leading there) are dashed frames with a "?", and secret sections stay invisible until found.
 * Landmarks, visited checkpoints, connections (green = shortcut, dashed = locked) and the mission
 * destination are drawn with symbols and labels, never colour alone.
 */
import { CONNECTIONS, findObject, MAP_IDS, MAPS, mapOfObject, type MapId } from "../data/regions/registry";
import type { GameState } from "../systems/state";

const NS = "http://www.w3.org/2000/svg";
const PALETTE: Record<MapId, { fill: string; edge: string }> = {
  surface: { fill: "#b5583f", edge: "#f2b38a" },
  depths: { fill: "#3f5a8a", edge: "#a8c8ff" },
  ridge: { fill: "#a8603f", edge: "#ffd0a0" },
};

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, text?: string): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = text;
  return e;
}

export interface MapView {
  state: GameState;
  here: { map: MapId; col: number; row: number };
  /** Objective target object id (may be in another map, or hidden). */
  target: string | null;
  objective: string;
  onClose: () => void;
}

export class WorldMapUI {
  private el: HTMLElement;

  constructor(root: HTMLElement) {
    this.el = document.createElement("div");
    this.el.className = "world-map hidden";
    this.el.setAttribute("data-menu", "");
    this.el.setAttribute("role", "dialog");
    this.el.setAttribute("aria-label", "World map");
    root.append(this.el);
  }

  hide(): void {
    this.el.classList.add("hidden");
    this.el.replaceChildren();
  }

  get open(): boolean {
    return !this.el.classList.contains("hidden");
  }

  show(v: MapView): void {
    const s = v.state;
    const card = document.createElement("div");
    card.className = "menu-card px-panel map-card";
    const head = document.createElement("div");
    head.className = "map-head";
    const h = document.createElement("h2");
    h.textContent = "Survey Journal: World Map";
    const where = document.createElement("p");
    const hereSec = MAPS[v.here.map].sections.find((x) => v.here.col >= x.rect.x0 && v.here.col <= x.rect.x1 && v.here.row >= x.rect.y0 && v.here.row <= x.rect.y1);
    const hereRegion = MAPS[v.here.map].regions.find((r) => v.here.col >= r.x0 && v.here.col <= r.x1) ?? MAPS[v.here.map].regions[0];
    where.textContent = `You are in: ${hereRegion.name}${hereSec ? `, ${hereSec.name}` : ""}`;
    head.append(h, where);

    const box = svg("svg", { viewBox: "0 0 120 62", class: "map-svg", role: "img", "aria-label": "Map of discovered regions" });
    box.append(svg("rect", { x: 0, y: 0, width: 120, height: 62, fill: "#1c1424" }));
    // The surface line (ground level) for orientation.
    box.append(svg("line", { x1: 0, y1: 33.5, x2: 120, y2: 33.5, stroke: "#4a3a3a", "stroke-width": 0.3, "stroke-dasharray": "1 1" }));
    box.append(svg("text", { x: 1, y: 60.5, class: "map-tiny" }, "↓ underground"));
    box.append(svg("text", { x: 1, y: 3, class: "map-tiny" }, "↑ high ground"));

    const visited = (m: MapId) => s.discovered.maps.includes(m);
    const secFound = (id: string) => s.discovered.sections.includes(id);
    const objSeen = (id: string) => {
      const m = mapOfObject(id);
      const o = findObject(id);
      if (!m || !o || !visited(m)) return false;
      const sec = MAPS[m].sections.find((x) => o.col >= x.rect.x0 && o.col <= x.rect.x1 && o.row - 1 >= x.rect.y0 && o.row - 1 <= x.rect.y1);
      return !sec || secFound(sec.id);
    };
    // A region is "known" once visited, or once Laika has seen a lift / gate that leads there.
    const known = (m: MapId) => visited(m) || CONNECTIONS.some((c) => (c.a.map === m && objSeen(c.b.object)) || (c.b.map === m && objSeen(c.a.object)));
    const pos = (id: string): [number, number] | null => {
      const m = mapOfObject(id);
      const o = findObject(id);
      if (!m || !o) return null;
      const f = MAPS[m].frame;
      return [f.x + ((o.col + 0.5) / MAPS[m].w) * f.w, f.y + ((o.row - 0.5) / MAPS[m].h) * f.h];
    };

    for (const m of MAP_IDS) {
      if (!known(m)) continue;
      const def = MAPS[m];
      const f = def.frame;
      const pal = PALETTE[m];
      const been = visited(m);
      box.append(svg("rect", { x: f.x, y: f.y, width: f.w, height: f.h, fill: "none", stroke: pal.edge, "stroke-width": 0.25, "stroke-dasharray": been ? "0" : "1 0.8", opacity: been ? 0.5 : 0.8 }));
      const label = m === "surface" ? "SURFACE: Outpost · Canyon · Station" : `${def.regions[0].name.toUpperCase()}${been ? "" : " ?"}`;
      box.append(svg("text", { x: f.x + 0.6, y: f.y - 0.8, class: "map-label" }, label));
      if (!been) continue;
      for (const sec of def.sections) {
        const x = f.x + (sec.rect.x0 / def.w) * f.w;
        const y = f.y + (sec.rect.y0 / def.h) * f.h;
        const w = ((sec.rect.x1 - sec.rect.x0 + 1) / def.w) * f.w;
        const hh = ((sec.rect.y1 - sec.rect.y0 + 1) / def.h) * f.h;
        if (secFound(sec.id)) {
          const r = svg("rect", { x, y, width: w, height: hh, fill: pal.fill, stroke: pal.edge, "stroke-width": 0.2, opacity: 0.9 });
          r.append(svg("title", {}, sec.name));
          box.append(r);
        } else if (!sec.optional) {
          box.append(svg("rect", { x, y, width: w, height: hh, fill: "none", stroke: pal.edge, "stroke-width": 0.15, "stroke-dasharray": "0.4 0.6", opacity: 0.55 }));
        }
      }
      for (const lm of def.landmarks) {
        if (!s.discovered.landmarks.includes(lm.id)) continue;
        const x = f.x + ((lm.col + 0.5) / def.w) * f.w;
        const y = f.y + (lm.row / def.h) * f.h;
        box.append(svg("text", { x: x - 0.8, y: y + 0.8, class: "map-sym lm" }, "◆"));
        box.append(svg("text", { x: x + 1, y: y - 0.6, class: "map-tiny" }, lm.name));
      }
      for (const o of def.objects) {
        if (o.kind !== "checkpoint" || o.hidden || !s.visitedCheckpoints.includes(o.id)) continue;
        const p = pos(o.id);
        if (p) box.append(svg("text", { x: p[0] - 0.7, y: p[1] + 0.6, class: "map-sym cp" }, "▲"));
      }
      // Phase 4: recharge posts Laika has seen (a crossed bolt = not working yet).
      if (s.flags.m4Briefed) {
        for (const o of def.objects) {
          if (o.kind !== "recharge" || !objSeen(o.id)) continue;
          const p = pos(o.id);
          if (!p) continue;
          const dead = !!o.broken && !s.flags.canyonPostFixed;
          const t = svg("text", { x: p[0] - 0.7, y: p[1] + 0.6, class: `map-sym rc${dead ? " dead" : ""}` }, dead ? "ϟ×" : "ϟ");
          t.append(svg("title", {}, dead ? "Recharge post (needs repair)" : "Recharge post"));
          box.append(t);
        }
      }
    }

    // Connections: drawn once one end has been seen. Open shortcuts are green and solid.
    for (const c of CONNECTIONS) {
      if (!objSeen(c.a.object) && !objSeen(c.b.object)) continue;
      const a = pos(c.a.object);
      const b = pos(c.b.object);
      if (!a || !b) continue;
      const open = c.open(s);
      const line = svg("line", {
        x1: a[0],
        y1: a[1],
        x2: b[0],
        y2: b[1],
        stroke: open ? (c.shortcut ? "#6fe0a0" : "#f2ca76") : "#8a7a8a",
        "stroke-width": open && c.shortcut ? 0.55 : 0.35,
        "stroke-dasharray": open ? "0" : "1 0.8",
      });
      line.append(svg("title", {}, `${c.name}${open ? (c.shortcut ? " (shortcut)" : "") : " (locked)"}`));
      box.append(line);
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      box.append(svg("text", { x: mx + 0.6, y: my, class: "map-tiny" }, `${c.name}${open ? (c.shortcut ? " ⇆ shortcut" : "") : " (locked)"}`));
      const far = objSeen(c.a.object) ? c.b : c.a;
      if (!visited(far.map)) {
        const p = pos(far.object)!;
        box.append(svg("text", { x: p[0] - 0.7, y: p[1] + 0.8, class: "map-sym q" }, "?"));
      }
    }

    // Mission destination: exact only if that place has been discovered and is not a hidden spot.
    if (v.target) {
      const tm = mapOfObject(v.target);
      const tp = pos(v.target);
      if (tm && tp && known(tm)) {
        const exact = objSeen(v.target);
        const f = MAPS[tm].frame;
        const [x, y] = exact ? tp : [f.x + f.w - 2, f.y + 2];
        box.append(svg("text", { x: x - 1, y: y + 1, class: "map-sym goal" }, "★"));
      }
    }

    // Laika.
    const lf = MAPS[v.here.map].frame;
    const lx = lf.x + ((v.here.col + 0.5) / MAPS[v.here.map].w) * lf.w;
    const ly = lf.y + ((v.here.row + 0.5) / MAPS[v.here.map].h) * lf.h;
    box.append(svg("circle", { cx: lx, cy: ly, r: 0.9, fill: "#fff1d0", stroke: "#2a1a22", "stroke-width": 0.3, class: "map-laika" }));
    box.append(svg("text", { x: lx + 1.2, y: ly + 0.6, class: "map-label" }, "Laika"));

    const legend = document.createElement("p");
    legend.className = "map-legend";
    legend.textContent = `● Laika   ★ Mission   ▲ Checkpoint   ${s.flags.m4Briefed ? "ϟ Recharge   " : ""}◆ Landmark   ? Unexplored   ━ green: shortcut   ╌ dashed: locked`;
    const goal = document.createElement("p");
    goal.className = "map-goal";
    goal.textContent = `★ ${v.objective}`;
    const close = document.createElement("button");
    close.className = "px-btn";
    close.textContent = "Close map";
    close.addEventListener("click", () => v.onClose());
    card.append(head, box, goal, legend, close);
    this.el.replaceChildren(card);
    this.el.classList.remove("hidden");
    close.focus();
  }
}
