# Roadmap

Phase 1 (this repository today) is the opening chapter: one mission, four connected areas, the core loop. Each later
phase builds on the same systems (data-driven world, pure simulation, effects, reachability tests).

## Phase 2 — Polish and depth of the opening chapter

- Hand-tuned art pass: richer canyon silhouettes, more rock variants, animated machinery (dish rotation, panel glint).
- Proper Laika sprite review with the team (expressions, run cycle, sleep/wake sequence).
- Short opening cutscene (landing) and a skippable ending vignette.
- More environmental storytelling props (footprints, crew notes, the rover's tracks leading east).
- Day-to-dusk lighting change after the radio comes online.
- Real music cues per area (canyon / station variations) and recorded or better-synthesized ambience.
- Playtest with children; tune jump heights, hint timing and text length from observations.
- Optional: gamepad remapping UI and a controls diagram screen.

## Phase 3 — The journey north (new region)

- Split `data/world.ts` into per-region modules and add a region transition (rover ride or long walk).
- New ability gates: e.g. a **grapple/tether** (swing across gaps), a **headlamp** for dark caves, a **dust-storm
  shield**.
- First light survival mechanic, optional and forgiving: a suit battery that recharges at powered stations (never a
  fail state for young players).
- Second mission with a new machine chain (water extractor → greenhouse).

## Phase 4 — Engineering systems

- Bring back the original game's science themes as hands-on machines: radiation shelter, water recycling,
  greenhouse lighting, battery storage through a dust storm.
- A small, readable "base status" diorama (not a dashboard) that changes as you repair things.
- Optional science log collecting every tip, sample and fact with sources.

## Phase 5 — The mystery

- Follow the 88-minute signal to its source; companion characters (rover R-2 revived?).
- Branching optional areas, collectible patches, a map screen with discovered landmarks.

## Phase 6 — Release quality

- Localization (strings already centralised in `data/` and `ui/`).
- Full accessibility audit (screen-reader flows for menus, colour-blind review, one-switch mode).
- Performance profiling on low-end phones; asset pre-generation to images if boot time matters.
- Cloud save (optional, privacy-first) only if the team wants it.
