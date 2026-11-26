# Architecture — LAIKA: THE LAST SIGNAL

## Technology decision

**Phaser 3.90 + TypeScript (strict) + Vite**, deployed as a static site.

- The original game is a Next.js/React strategy UI: a reducer advances "sols" and React renders dashboards. Its
  architecture does not fit real-time character control (React re-rendering per physics frame is the wrong tool).
  The new game is a separate repository, so it does not need Next.js at all.
- Phaser 3 gives a mature WebGL/Canvas renderer with nearest-neighbour pixel art, Arcade Physics with reliable
  tilemap collision, tweens, particles and cameras, and runs on phones. Phaser 4 exists but Phaser 3 is the version
  requested and the more widely documented.
- Vite gives instant dev reloads and a small static build (Phaser is split into its own cached chunk). Vercel
  detects Vite automatically; no server, database, accounts or paid APIs.
- What was reused from the original: Laika's design and palette (re-drawn as a side view from the original sprite
  grid), the palette and pixel-art-in-code approach, the four soundtrack MP3s, the synthesized-SFX approach and
  the respectful fictional framing. Code was not copied; systems were rebuilt for real-time play.

## Layout

```
index.html            canvas container + HTML overlay root
src/
  main.ts             creates services (settings, audio, input, UI) and the Phaser game; fits the overlay to the canvas
  app.ts              shared services + updateSettings()
  config/constants.ts resolution (480x270), tile size, storage keys, movement tuning, ranges
  data/               ALL authored content: items & recipes, world terrain ops + objects + regions, transmissions & tips,
                      tutorial.ts (Mission 00 stage definitions: instruction per device, target, done(), hint)
    regions/          Phase 3: one module per MAP + the registry
      types.ts        MapDef, Section, Landmark, Connection, LightSpot, Decor, TileGroup (doors / bridges)
      surface.ts      the Phase 1-2 surface map (terrain + objects still in data/world.ts), described as 3 regions
      frozenDepths.ts Region 04 (terrain ops, objects, sections, landmarks, lights, cables, doors)
      echoRidge.ts    Region 05
      registry.ts     MAPS, CONNECTIONS (freight lift, survey lift, North Access, cable car), global object lookup
    engineering.ts    Phase 4: facilities, consumers, demand, criticality, and EVERY balance value (ENGINEERING, SUIT)
    science.ts        Phase 4: Science Journal categories and entries (real science, fiction note, source)
    equipment.ts      Phase 5: the five pieces of equipment (cost in Metal/Circuits, one benefit line, icon,
                      requirement), GEAR effect values, and the five cosmetics with how to unlock them
  systems/            PURE TypeScript simulation (no Phaser, no DOM) - unit-tested
    state.ts          GameState (what is saved) + derived helpers (isPowered)
    interactions.ts   getInteraction() / performInteraction() -> Effect[]; barkEffects()
    mission.ts        objective derived from state (one action line + steps + optional goals); completion stats
    tutorial.ts       Mission 00 state machine over facts (moved, revealed, repaired...); isolated practice items
    effects.ts        Effect / WorldEvent / Interaction types shared by interactions.ts and puzzles.ts
    puzzles.ts        Phase 3 interactions: Headlamp, light sensor, circuit, drill, relays, acoustic sensor
    engineering.ts    Phase 4: power (generation, battery, distribution, brownout), greenhouse growth,
                      stepEngineering() and the fixed-step EngineClock
    survival.ts       Phase 4: suit energy costs, air-jump limits, scanner fallback, recharge, SuitReserve
    facilities.ts     Phase 4: base interactions (checked FIRST by interactions.ts), LIGHTS OUT, Mission 04 finale,
                      science unlocks
    regions.ts        sections, discovery, open connections, routeTo() (cross-map hints), transit interactions
    hints.ts          adaptive hint levels driven by lack of progress; jump-struggle detection
    animState.ts      locomotion animation choice + idle personality state machine
    inventory.ts      count / canAfford / spend / collectOnce (no duplication)
    movement.ts       Laika's movement controller (coyote, buffer, variable jump, boots, glide)
    sniff.ts          scanner detection, signal level (none/weak/strong/located), warmer/colder trend
    worldBuilder.ts   terrain ops -> tile grids
    navigation.ts     tile-level reachability solver (level validation)
    save.ts           versioned save, sanitize, migrate, repairState (anti soft-lock)
    chapters.ts       Phase 5: CHAPTERS, chapterOfStage(), autoAdvance() (the next chapter's call arrives by itself)
    crafting.ts       Phase 5: workbench cards and statuses, craft() (validate -> spend once -> Effect[]), equipment
                      effect helpers (sniff/reveal radius, suit max, thruster cost, lamp), cosmetics, lookOf/lookKey
    waypoints.ts      Phase 5: route-aware objective guidance (BFS over standing cells + ladder portals, nearest open
                      lift for other maps) -> one Waypoint
    notifications.ts  Phase 5: NoteQueue (priority warn > milestone > item > info, dedupe, merge, max 2 on screen)
    settings.ts       preferences, bindings, rebind, key labels
  art/                procedural pixel art: painter, palette, Laika parts + animations, tileset, props, icons,
                      backgrounds, 3x5 font, registerTextures (generates every texture at boot)
  audio/AudioManager  Web Audio buses (master/music/ambience/sfx), MP3 music, synthesized cues, ambience
  input/InputManager  keyboard (remappable) + touch + gamepad -> one InputFrame per frame
  game/               Phaser-side views and controllers
    WorldView.ts      tilemap layers, auto-tiling, custom collision faces, parallax, shells, secret walls, decor
    Player.ts         Arcade body + sprite + animation (via animState) + particles + carried item, scripted
                      animations (wake-up), corner correction and ledge assist, footprints
    CameraController  look-ahead after sustained movement, platform snapping, underground framing, interest bias
                      toward the current target, focus pans (skipped with reduced motion)
    ObjectsView.ts    sprites for world objects, targeting, highlight glow, power/cable sequence, collect/reveal
                      effects, practice / echo sensor / rover visuals
    SniffFx.ts        pulse ring, pings, direction arrows, tracking rhythm and chevrons, located sparkle
    Lighting.ts       darkness overlay for dark maps: one screen-sized RenderTexture, banded light stamps
    facilityLook.ts   Phase 4, pure: which texture each machine shows, room darkness, surface look (unit-tested)
    BaseView.ts       Phase 4: lower-level signs, lamps, status lights, room dimming, pipes/cables with flow,
                      greenhouse dome, vent steam, beacon light, LIGHTS OUT haze tint
  scenes/             BootScene (generate art) -> TitleScene -> GameScene (orchestrator)
  ui/                 UI.ts (HUD, objective panel, signal meter, captions, transmissions, menus, controls,
                      settings, touch) + TutorialUI.ts (stage card, assist offer, mission title cards)
                      + WorldMapUI.ts (survey-journal world map, HTML/SVG) + BaseUI.ts (Phase 4: suit meter,
                      power chip, base status simple/detailed, power console, Science Journal)
                      + CraftingUI.ts (Phase 5 workbench cards) + JournalUI.ts (Phase 5 Gear / Science / Radio /
                      Progress tabs) + ui.css
tests/                Vitest: world validation, mission, saves, movement, settings/sniff/inventory, tutorial, phase2
playtest/             Python + Playwright browser play-tests (playthrough.py = Phase 1 route, phase2.py = A-H,
                      phase3.py = A-K, phase4.py = A-M, phase5.py = A-O + SNAP before/after measurements)
```

## Data flow (one frame)

```
InputManager.poll() ──> Player.update() ──> stepMovement() ──> Arcade body velocity ──> tile collision
                                  │
GameScene ── ObjectsView.findTarget() ── getInteraction()  ──> UI.setPrompt()  (only when it changes)
        └─ on E: performInteraction(object, state) ──> Effect[] ──> applyEffects():
              toast / item / spend / transmission / tip / anim / sound / world event / focus / read / save
```

- **Simulation vs presentation.** `GameState` is plain JSON and only changes inside `systems/`. Effects are
  descriptions ("world: powerOn", "focus: receiver"); `GameScene` turns them into tweens, particles, camera moves,
  audio and HUD updates. The mission is fully playable in a unit test without a browser.
- **No per-frame UI work.** The HTML overlay is updated only on change (prompt key, objective key, inventory).
- **Derived, not stored.** The objective, "powered", and receiver states are computed from flags, so saves cannot
  drift out of sync with the UI.

## Phase 5: guidance, chapters, notifications and crafting

**Chapters.** `chapterOfStage()` maps the objective's stage prefix to a chapter (Prologue = tutorial, 1 = Mission
01 ... 5 = Mission 05); `getObjective()` adds it as `objective.chapter`. `GameScene.chapterCheck()` compares it each
HUD refresh and, when it goes up, shows a milestone toast (the chapter's short "done" line) and then the chapter
banner (the region banner element). Going back never announces anything. There are no completion cards any more.
`autoAdvance(s)` is called from `phase4Checks` when no transmission is open and at least 1.4 s after the last one
closed; it starts Chapter 2 (relay logs), Chapter 4 (`answerStationCall`) and Chapter 5 (`startChapter5`) without a
console trip. Transmissions are passive (non-blocking) by default and logged in `seen` as `tx:<id>` so the Journal's
Radio tab can show the full text (`Transmission.full`).

**Waypoints.** `nextWaypoint(grid, state, map, at, targetId)` returns one point:
1. other map: `routeTo(..., fromCol)` picks the next transit object over open connections, preferring the one with
   the shorter trip from Laika's column (survey lift at the outpost, freight lift at the station); locked routes
   give `null` (no arrow through a sealed door);
2. same map: `findPath` (BFS over `neighbours()` standing cells with Laika's real jump: basic or boots) plus
   `portals()` (habitat ↔ lower_stairs once Chapter 4 has started). If the path uses a ladder, the ladder is the
   waypoint; otherwise a point 9 cells along the path, or the target when it is close;
3. no path (the solver is conservative): the target itself.
`GameScene.updateGuidance()` recomputes it every 450 ms and draws a bobbing marker on screen or an edge arrow off
screen (no bob with reduced motion), plus the objective box's direction arrow. Settings `guidance`
(guided / explorer / minimal) and the hint level decide visibility; the ? button forces it for 9 s; a checkpoint
picked on the map becomes a temporary custom target. `window.__laika.waypoint()` exposes it for tests.

**Notifications.** `UI.toast(text, tone, icon?, kind?)` pushes into a `NoteQueue`; `pumpNotes()` shows what
`take(now)` allows. Duplicates within 5 s are dropped, item pick-ups merge, the queue holds 4 and drops info/items
first, never warnings or milestones.

**HUD.** `setObjective` renders a compact box (arrow + one line + key); the title, steps and Details button only in
the detailed HUD (`body.hud-detailed`). Inventory peeks for a few seconds when it changes (`peekInventory`); the suit
meter and power chip are shown by `hudContext()` only when relevant (low energy, after a boosted jump, at the base,
during LIGHTS OUT).

**Crafting.** `craftCard()` → status `built | ready | missing | locked | noPower`; `craft()` re-validates, spends once
and returns effects (`spend`, `anim`, `world: crafted`, `save`). Recipes may only use `CRAFT_MATERIALS` (Metal,
Circuits) and never `critical` items (`recipeIsSafe`, unit-tested). Equipment effects are read where they matter:
`sniffRadiusFactor`/`revealRadiusFactor` in the scanner, `suitMaxOf`/`costFor` in survival, `headlampFactor` in
`Lighting` (`lampScale`). World objects can carry `needs: <equipment>`; `gearReady()` hides them from pickups, digging
and the scanner until the gear exists (`ObjectsView.syncGear`). Laika's look: `lookOf(state)` → `lookKey()` →
`ensureLaikaLook()` generates a sprite sheet and animations for that key on demand (gear pixels + palette swaps for
cosmetics). Habitat souvenirs come from `facilityLook.habitatDecor()` (pure).

## Engineering simulation (Phase 4)

```
                    sunFactor (1, or the haze fraction)        Survival Assistance (settings.survival)
                              │                                          │
  solar panels (clean=5 PU, dusty=1 PU) ──> generation ──┐               │ capacity, haze, suit costs
                                                         ▼               ▼
  wanted consumers (restored + allocation) ──> computePower(s, mode) ──> PowerStatus { gen, use, net, battery,
         habitat 2 · lifeSupport 3 · shelter 1 (critical)                    powered, brownout, trend, haze }
         water 1 · greenhouse 3 · research 2 (optional)                             │
                                                         stepEngineering(s, mode, 250 ms)
                                 battery += net × batteryRate × dt (clamped 0..capacity) · plants grow if lit,
                                 watered and powered · events: batteryEmpty / stage:n / brownout:x / restored:x
```

- **Pure and data-driven.** Every number lives in `data/engineering.ts` (`ENGINEERING`, `SUIT`); the tests read
  those values, so tuning never silently breaks them. Units (PU, BU, SE) are fictional and the UI says so.
- **Critical systems are protected.** Habitat, life support and shelter are not in the distribution choice at all.
  When the battery is empty and the sun is not enough, optional systems drop in `BROWNOUT_ORDER` (greenhouse,
  research, water) until the rest fits; they come back by themselves.
- **Lower-level bus.** Machines below ground run only once the battery station is restored; the receiver and
  workstation (research) keep running on sunlight, so Missions 01–03 behave exactly as before.
- **Timing.** `EngineClock.advance(delta)` accumulates real frame time, clamps a long gap to
  `maxStepsPerFrame` steps (4 × 250 ms), and runs whole steps only: identical results at 30, 60 or 144 fps.
  `GameScene` only advances it during free play: not in menus or panels (the scene is paused), transmissions,
  camera focus, map travel or Mission 00. A hidden tab opens the pause menu. The clock is never saved, so nothing
  happens while the game is closed. Cost: about 25 µs per step (4 steps per second).
- **Suit energy.** `survival.ts` decides costs per mode; `Player.airJumpLimit` asks it before each air jump, so a
  jump the suit cannot pay for simply does not fire (the boost is the second air jump and only exists from
  Mission 04). `SuitReserve` refills to a safe floor after a few seconds without spending (Relaxed: to full).
  Sniffing is always allowed: with too little energy the scan works at 55 % range.
- **Interactions.** `facilities.ts` answers first for Phase 4 objects (and for the beacon, habitat, battery,
  panels and drill once Mission 04 changes their meaning), then the Phase 1 switch, then `puzzles.ts`. New effects:
  `stairs` (the habitat ladder: a fade and a teleport, no map change), `ui` (open base status or the power console)
  and `science` (a journal entry unlocked; `performInteraction` calls `syncScience` after every interaction).
- **Visible transformation.** `facilityLook.ts` maps state → texture keys, room darkness and the surface look;
  `ObjectsView.syncBase` and `BaseView.sync` apply them every engine step, so the base changes as it works (rooms
  light up, the recycler fan turns, pipes flow, the dome fills with plants). Tests check that every texture the
  look module can name exists.

## Multi-map world (Phase 3)

**Maps, regions, sections.** A *map* is one handcrafted tile grid that is built and rendered on its own
(`surface`, `depths`, `ridge`). A map holds one or more numbered *regions* (title cards, hint wording) and finer
*sections* (cells revealed on the world map). The surface stays the seamless Phase 1-2 map, so every existing
object id, checkpoint and save still works. The new regions are separate maps because they have a different
look, darkness and scale, and only one map is ever in memory.

**Data, not code.** Each `MapDef` carries terrain ops, objects, sections, landmarks, secrets, optional zones,
theme (backdrop, darkness, ambience, particles), decor, cable runs, light spots, state-driven door and bridge tile
groups, its frame on the world map and tip zones. `worldBuilder.buildWorld(def)` turns ops into grids as before.
Object ids are unique across all maps (tested), so the save keeps plain id lists.

**Travel.**

```
E on a transit object -> performTransit() -> [anim, travel{connection, map, arrive}]
GameScene.travel(): lock input, set state.checkpoint = arrival checkpoint, SAVE, fade (or 120 ms cut with
  reduced motion) -> scene.restart({ state, arrival, facing })
GameScene.create(): map = mapOfObject(state.checkpoint); build that map only; spawn at the checkpoint;
  keep facing; region title card on first visit
```

Saving *before* the restart is what makes an interrupted transition safe: a reload lands at the arrival
checkpoint in the new map. `transitioning` blocks double triggers, and the scene restart tears down every
listener and texture-using object of the old map (no per-frame work for maps you are not in). A connection's
`open(s)` is checked on both sides, so travel can never bypass a gate; a shortcut is a connection with a one-time
`activate` step on its far side.

**Discovery and the map.** `regions.discover(s, map, col, row)` returns newly entered sections, newly visible
landmarks and arrival flags; GameScene calls it as Laika moves and on arrival. `WorldMapUI` draws only what
`state.discovered` contains plus "known about" regions (seen a lift or gate leading there).

**Hints across maps.** `routeTo(s, here, target)` returns the local object to aim for: the target itself when it
is on this map, otherwise the transit object of the next hop (`nextHop` is a BFS over open connections). Highlight
and the edge arrow use that local object, and the objective line already names the region, so a hint never
points at something in an unloaded map.

**Lighting.** Dark maps draw one 480×270 RenderTexture filled with darkness each frame and erase banded light
stamps from it (Laika's aura, the headlamp cone, lamps that are on; off-screen lamps skipped). The darkness
alpha is capped so walls and floors stay visible, and lowered further by "Brighter caves". Reflective markers sit
above the darkness and fade in by how strongly the beam hits them. Cost does not grow with map size.

**Puzzles** live in `systems/puzzles.ts` with the same contract as `interactions.ts`: `getRegionInteraction()`
says what E would do, `performRegionInteraction()` mutates state and returns Effects. Every step is idempotent.
Puzzle state is flags plus `puzzles.relayAim` (each relay dish's direction).

## Mission 00 (tutorial) architecture

```
input / Player / ObjectsView ──events──> tutorialEvent(t, {woke | moved{dx,x} | jumpFailed | revealed | exited})
E on a practice object ─────────────────> performPracticeInteraction(t, id) ──> { effects, completed }
                                                       │
                       TutorialState { mode: first | replay, stage, facts, holding }
                                                       │ advance(): while stageDef(stage).done(facts) -> next
                                                       ▼
GameScene.onTutorialAdvance ──> TutorialUI.show(stage, {device, keys}) + highlight(target) + save stage
```

- **Facts, not timers.** Each stage in `data/tutorial.ts` has `done(facts)`. The system records what happened
  (real distance moved, console used, item revealed/collected, machine repaired, hatch exited), and `advance` walks
  forward through every stage whose condition is already true. Events that arrive early or out of order are recorded
  but cannot skip a stage's own requirement; repeating an action is idempotent.
- **Isolation.** Practice objects (`PRACTICE_IDS`) never go through `performInteraction`, so they cannot touch
  `GameState.inventory`, `collected` or `flags`. The only campaign fields Mission 00 writes are
  `tutorial.{status,stage}` and, on first completion, `abilities.sniff`. Replay mode builds a fresh `TutorialState`,
  stores the return position, and on completion teleports back without saving any practice facts.
- **Persistence.** `tutorial.stage` is saved as Laika moves through Mission 00; `createTutorial(mode, stage)`
  rebuilds the facts implied by a saved stage, so Continue resumes at the right step.
- **Prompts** are functions of `{device, keys}` (`InputManager.lastDevice` + current bindings), re-rendered when
  the device or settings change.
- **Gating.** While the tutorial is active the campaign objects are not interactable and the floor hatch tile is
  solid; `hatchOpen(t)` opens it once the repair stage is done.

## Rendering

- Internal resolution 480×270, `pixelArt: true`, `roundPixels`, `Scale.FIT`, CSS `image-rendering: pixelated`.
- All art is generated at boot from code (`src/art/`) with integer-pixel drawing only, so every asset shares one
  palette and resolution. Laika is composed from parts (head/helmet, suit, tail, legs) so every frame stays on-model.
- Tiles auto-tile by exposed sides (16 variants per material, deep variants, alternates). Collision faces are
  computed manually so one-way ledges never disable a neighbouring wall's collision.
- Depth layers: parallax (4) → back walls → props → tiles → pickups → Laika → building shells → secret walls → FX → UI.

## Saving

- Keys: `laika-the-last-signal/save`, `/settings`, `/save-corrupt-backup` (original game uses
  `laika-mission-red-planet/*` and is never touched).
- `loadGame`: parse → `migrate` (by `version`) → `sanitize` (types, ranges, known ids) → `repairState`
  (later milestones imply earlier ones; the comms module is restored if lost; solar parts topped up if the world can
  no longer supply them). Corrupt or future-version saves are backed up and the title screen says so.
- Autosave on checkpoints, pickups, repairs, pause, tab hide and every 20 s.
- **Version 5 (Phase 5).** Adds `gear: { built, blueprints, wear }` and four flags (`m5Briefed`, `m5Blueprint`,
  `beaconFound`, `m5Complete`) plus the `navBeacon` item. `migrate` v4 → v5 adds an empty gear block (the Thruster
  Boots stay an ability, so Phase 1–4 boots are kept); `sanitize` keeps only known equipment / cosmetic ids and caps
  suit energy at 100 unless the Reserve Battery is built (then 150). `repairState` implies earlier Mission 05 steps
  from later ones, grants the booster blueprint after the briefing and every blueprint after Mission 05, keeps the
  beacon unique, and applies Phase 5's merged Mission 04 steps (battery ⇒ rooms powered, water ⇒ grow valve open,
  both probes ⇒ shelter restored) so a v4 save made halfway through never waits on a step that no longer exists.
- **Version 4 (Phase 4).** Adds `eng: { battery, alloc { water, greenhouse, research }, growMs, suit, dusty }`,
  `science: string[]`, 26 Mission 04 flags and five items (regulator, pump cartridge, melt-line coupling, seeds,
  power cell). `migrate` v3 → v4 adds a fresh engineering block (battery 0, everything allowed, suit full) and an
  empty journal; v1 and v2 chain through v3. `sanitize` clamps every engineering number to its range and drops
  unknown panels and journal ids. `repairState` now runs until nothing changes (at most 4 passes): later
  milestones imply earlier ones, a mission item that was used is never given back and one that is needed is never
  lost, the battery is 0 until restored, the dust list only exists between "balanced" and "done", and journal
  entries are re-derived from achievements.
- **Version 3 (Phase 3).** Adds `abilities.headlamp`, `discovered: { maps, sections, landmarks }` and
  `puzzles: { relayAim }`, plus new flags and items (coupling, relay cell, recordings, rover parts). `migrate`
  v2 → v3 sets the Headlamp to false, the map to "surface" and relays to their start directions; v1 saves go
  v1 → v2 → v3. `repairState` back-fills the map from already visited checkpoints, implies earlier milestones
  from later ones, and restores a lost relay cell or coupling; `sanitize` replaces an unknown checkpoint with the
  last valid one visited. A finished Mission 01 therefore continues straight into Mission 02 without replaying anything.
- **Version 2 (Phase 2).** Adds `abilities.bark` and `tutorial: { status: active | done | skipped, stage }`.
  `migrate` turns a v1 save into v2 with Bark unlocked and the tutorial marked **skipped**, so Phase 1 players keep
  everything and are never pushed into Mission 00. `sanitize` repairs a damaged tutorial block (unknown status →
  skipped; unknown stage → done) and `repairState` closes the tutorial if the campaign is already past it (hatch
  open or radio checked).

## Extending the game

- **New item:** add to `ITEMS` (+ `RECIPES` if crafted) and a 12×12 grid in `art/icons.ts`.
- **New object / machine:** add an `ObjectKind`, place it in `OBJECTS`, add rules in `getInteraction` /
  `performInteraction`, a texture in `art/props.ts`, and a case in `ObjectsView.create` / `syncFromState`.
- **New region:** add terrain ops and objects in `data/world.ts` (widen `WORLD_W`), add a `REGIONS` entry, and the
  reachability tests will validate it. For multiple maps, turn `data/world.ts` into one module per region and pass
  the chosen one to `buildWorld()` / `WorldView`.
- **New ability:** add an `AbilityId`, unlock it from an effect, and read it in `Player` / `stepMovement`
  (see `thrusters` for a complete example: recipe → effect → texture swap → air jump).
- **New mission:** write another `getObjective`-style function over new flags; add `FlagId`s and a save
  migration step (bump `STATE_VERSION`, now 5, and add a case in `migrate`). Give its stages a prefix and a
  `CHAPTERS` entry, and start it from `autoAdvance` rather than a console.
- **New equipment (Phase 5):** add an `EquipmentId` and an `EQUIPMENT` entry (Metal/Circuits only), an icon in
  `EQ_RAW`, an effect helper in `crafting.ts` read where it matters, a pixel change in `art/laika.ts`
  (`LaikaGearLook`), and optionally a `needs` cache in a region.
- **New facility (Phase 4):** add it to `FACILITIES` (demand, critical, dependsOn), give `isRestored` a rule, add a
  `FacilityPart`, its rules in `facilities.ts`, textures in `art/baseProps.ts` and a case in `facilityLook.ts`.
- **New tutorial stage:** add an id to `TutorialStageId` and `STAGE_ORDER`, a `TutorialStageDef` in
  `data/tutorial.ts` (instructions for each device, `done(facts)`, hint), any new fact + event in
  `systems/tutorial.ts`, and a test in `tests/tutorial.test.ts`.
- **New transmission / tip:** `data/story.ts`.

## Testing

- `npm test`: 233 unit tests. Phase 5 adds `phase5.test.ts` (36: chapter list and stage mapping, Mission 01 → 02,
  03 → 04 and 04 → 05 transitions with no console trip, every boundary has a next objective, waypoints through the
  ladder / to the nearest lift / none through locked routes / only on standable cells, notification priority, dedupe,
  merging and caps, safe recipes, crafting success / insufficient parts / no power / no blueprint / duplicates,
  mission items untouched, equipment effects, gated caches, material supply, reachability of every new part with
  basic jumps, cosmetics, Mission 05 start to finish, v4 → v5 migration and sanitising, word budgets for objectives,
  prompts, item names, tutorial steps and benefits, settings defaults). Phase 4 had 195: Phase 4 adds `phase4.test.ts` (42: solar, battery charge/discharge/capacity,
  distribution and protected critical systems, facility dependencies, recycler, water, greenhouse, suit energy,
  recharging, zero-energy recovery, Survival Assistance, fixed-step timing and clamping, no offline or paused
  progress, Mission 04 in two orders, LIGHTS OUT in every mode, v1/v2/v3 → v4 migration, corrupted engineering
  data, saving mid-event, duplicate/lost mission items, the reserve always pays for one jump, emptied part sources) and `phase4nav.test.ts` (12: lower level reachable through
  the ladder with basic jumps, Challenges B/C need the boosted jump and have no dead ends, ladders not crowded, the visible base look).
  Earlier phases (Phase 3 adds `regions.test.ts` and `phase3.test.ts`: region registration, unique
  ids, connection endpoints, region-graph connectivity, per-map reachability with and without Thruster Boots,
  puzzle progression and idempotency, both missions on the pure rules, cross-map hint routing, discovery, v1/v2 →
  v3 migration, invalid region recovery, interrupted transitions, item loss and duplication), including a full mission playthrough on the pure rules, save corruption/migration/
  anti-soft-lock cases, frame-rate independence of jump height and distance (30/60/144 fps), a BFS reachability
  solver proving the level has no dead ends and needs no precise platforming (and that the training bay is sealed
  from the campaign), the tutorial state machine (order, real events, duplicates, replay isolation, save/reload,
  device prompts), hints, animation states and gait phases.
- Browser play-tests run in headless Chrome with Playwright driving real keyboard and touch input:
  `playtest/playthrough.py` (Phase 1 route), `playtest/phase2.py` (Phase 2 scenarios A–H) and
  `playtest/phase3.py` (Phase 3 scenarios A–K), `playtest/phase4.py` (Phase 4 scenarios A–M, Mission 04 route
  updated for Phase 5's merged steps) and `playtest/phase5.py` (Phase 5 scenarios A–O and `SNAP=<label>`
  text/HUD measurements). See the handoffs.
