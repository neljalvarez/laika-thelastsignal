# Phase 3 handoff — LAIKA: THE LAST SIGNAL

**Phase 03/11: World Expansion, Interconnected Regions & Environmental Puzzles.** Status as of 2026-11-25:
implemented on branch `feature/phase-03-world-expansion` (branched from `main` after the Phase 2 merge, PR #1).
All automated checks pass. Read `ARCHITECTURE.md` → *Multi-map world* and `GAME_DESIGN.md` → *The expanded
world* first.

Nobody has played Phase 3 yet: every "verified" below means unit tests or scripted play in headless Chrome. The
Phase 2 items that still need people (human playtests, listening to the audio, real phones and gamepads) remain
open and are repeated in [Unverified](#unverified-functionality).

## Implemented features

| Area | What exists | Where |
| --- | --- | --- |
| Region architecture | 3 maps (surface, depths, ridge) holding 5 numbered regions, with sections, landmarks, secrets, theme, lights, cables, door/bridge tile groups and a world-map frame per map. Only the current map is built. | `src/data/regions/*`, `src/systems/regions.ts`, `src/systems/worldBuilder.ts` |
| Transitions | Freight lift, survey lift, North Access hatch, cable car. Save-before-restart, 360 ms fade (120 ms cut with reduced motion), facing kept, input flushed, double triggers blocked, arrivals a step away from the transit so nothing loops. | `GameScene.travel`, `registry.ts` |
| Region 04 Frozen Depths | 136×42 tiles: survey entrance, descending passage, dark observation chamber, frozen equipment room, power junction, water-ice chamber, hidden alcove, lift hall, service tunnel. 8 checkpoints. | `src/data/regions/frozenDepths.ts` |
| Region 05 Echo Ridge | 112×64 tiles: lower approach, abandoned relay gear and hut, cliff switchbacks, optional high ledges, Ridge Camp, hidden relay niche, antenna platform, relay tower, scenic overlook, cable car. 5 checkpoints. The tower is on the skyline from the first screen. | `src/data/regions/echoRidge.ts` |
| Ares Station as a hub | Relay logs at the console, freight lift down, cable car dock. Mission 01's end card and stats are kept. | `data/world.ts`, `data/story.ts` |
| Headlamp | New permanent ability: aura + beam, reflective markers, equipment glints, light sensors, a headlamp-only secret mark. Saved. HUD ability strip (SCAN / LAMP / BOOTS). "Brighter caves" setting. | `systems/puzzles.ts`, `game/Lighting.ts`, `ui/UI.ts` |
| Puzzles | A light the way, B restore the circuit, C frozen survey chamber; ridge: D align the relay network, E follow the strongest signal (scanner), F bark and response (optional). | `systems/puzzles.ts` |
| Missions | 02 *Beneath the Red* (8 steps) and 03 *Echoes Above* (7 steps), state-derived objectives that name the region first. | `systems/mission.ts` |
| World map | Survey-journal cross-section: regions, sections, connections (dashed locked, green shortcut, "?" unexplored), checkpoints, landmarks, Laika, mission destination, legend. M / Tab / ▦ / gamepad Back / Pause. | `ui/WorldMapUI.ts` |
| Shortcuts | Survey lift (depths lift hall ↔ outpost), cable car (tower ↔ station). Both need a one-time start on the far side. | `registry.ts` |
| Optional discoveries | 9 new (2 Golden Treats, 2 samples, 2 rover parts, 1 recording, 1 survey recorder, 1 hidden weather station), each tied to a tool or habit, plus a world-wide journal. | region data, `mission.ts` `journal()` |
| Atmosphere | Depths: darkness, cool palette, frost motes, near-silent hum that grows once powered. Ridge: layered mountains, blinking tower light, dust, wind. Ambience cross-fades across maps. | `WorldView.ts`, `AudioManager.ts`, `art/regionProps.ts`, `art/tiles.ts` |
| Guidance | Cross-map hint routing (`routeTo`), region title cards, first-time tips (lamp, boots), captions for every new machine, Easy Jumps offers on the ridge. | `GameScene.ts`, `regions.ts` |
| Saves | Format v3 with v1 → v2 → v3 migration. | `systems/save.ts`, `systems/state.ts` |

## Region architecture and connection diagram

```
                 [05 ECHO RIDGE] ---- cable car "skyline" (shortcut; started at the tower top) ------.
                        | North Access "northGate" (opens when the relay cell is analysed)            |
   [ship][01 LANDING OUTPOST] ===== [02 CRIMSON CANYON] ===== [03 ARES STATION] <----------------------'
          ^ survey lift "surveyLift" (shortcut; started in the lift hall once the circuit has power)
          |                                                     | freight lift "freightLift" (opens after the relay logs)
          '------ [04 FROZEN DEPTHS: lift hall ... service tunnel ... survey entrance] <--'
   ===== same map (surface: 240×34)          ----- separate maps, joined by a connection
```

| Connection | Side A | Side B | Opens when | Shortcut |
| --- | --- | --- | --- | --- |
| freightLift | station_lift (surface) | depths_freight (depths) | `m2Briefed` | no |
| surveyLift | outpost_lift (surface) | depths_lift (depths) | `depthsLiftOpen` (one-time start, needs `circuitRestored`) | yes |
| northGate | depths_north (depths) | ridge_hatch (ridge) | `relayAnalyzed` | no |
| skyline | station_cable (surface) | ridge_cable (ridge) | `ridgeCableOpen` (one-time start, needs `signalTraced`) | yes |

Why separate maps rather than one bigger map: the new regions have their own look, darkness and scale, and
loading one map at a time keeps tilemap size, textures and per-frame work flat as the world grows. The surface was
left as one seamless map so no Phase 1–2 id, checkpoint or save changed.

## Puzzle definitions

| Id | Region | Inputs | Solution | Output | State |
| --- | --- | --- | --- | --- | --- |
| A Light the way | Depths, observation chamber | Headlamp | Follow the reflective arrows along the lower walkway; E at the light sensor with the lamp | Shutter opens | `passageOpen` |
| B Restore the circuit | Depths, junction | Coupling (buried in the equipment room; a crew note says where) | Inspect the junction, sniff and dig the coupling, install it | Power runs lamp by lamp to the ice-chamber door, the survey lift and the service hatch | `junctionInspected`, `circuitRestored` |
| C Frozen survey chamber | Depths, ice chamber | Circuit power | Run the core drill | Water-ice sample + relay cell; optional science card | `sampler` collected, `iceChamberReached` |
| D Align the relay network | Ridge | Relay cell; tail sweep | Sweep A △; install the cell at the camp junction; turn B ○ and C □ until their dishes match their plaques (one step per press, wraps) | Network online, tower door opens | `relayASwept`, `cellInstalled`, `puzzles.relayAim`, `relayNetworkOnline` |
| E Strongest signal | Ridge, cliff | Scanner | Sniff near the cliff and follow the weak → strong → located signal to a loose rock | Relay C's niche | `relayCFound` |
| F Bark and response (optional) | Ridge, overlook | Bark | Bark near the acoustic sensor (it listens through the suit radio) | A small bridge to the cache | `ridgeBridgeOut` |

All are idempotent (tested) and work in any reasonable order; no puzzle needs timing.

## New abilities

- **Headlamp** (`abilities.headlamp`): found on a crate beside the freight-lift arrival. Always on once fixed.
  Without it the depths are dim, never black, and the objective sends the player back to the lamp.
- **Thruster Boots** (existing, Phase 1) got real uses: the depths ice shelf, the ridge high ledges and an
  alternate overlook route. A one-line reminder appears the first time. The mandatory route never needs them
  (reachability test), and a salvage locker in the depths gives enough parts to build them without replaying
  Mission 01.
- **Scanner** and **Bark** gained new uses (relay tracking, the acoustic sensor). The buried-item scanner behaves
  exactly as before.

## Mission progression

Mission 01's final transmission is unchanged ("...Laika? ...is that you, girl?"). Afterwards the objective moves
to Mission 02. Step lists are in `GAME_DESIGN.md`. In short:

- **M02 Beneath the Red:** relay logs → freight lift → Headlamp → light sensor → junction and coupling → circuit →
  core drill (relay cell) → start the survey lift → analyse the cell at the outpost receiver (opens North Access).
- **M03 Echoes Above:** North Access → Relay A → install the cell at Ridge Camp → Relay B → find and align Relay C →
  tower: trace the signal → start the cable car → MISSION 03 COMPLETE card, free exploration.
- **Ending beat:** the signal is still 1,200 km north on its 88-minute window, *older than the station*, and a
  voice says "...we waited where the lights go north... keep following...". The sender is not revealed.

## Save migration details

- `STATE_VERSION` = **3**. New fields: `abilities.headlamp`, `discovered { maps, sections, landmarks }`,
  `puzzles { relayAim }`, new flags (m2Briefed … ridgeCableOpen) and items (coupling, relayCell, recording,
  roverPart).
- **v2 → v3:** Headlamp false, map = surface, relays at their start directions; every Phase 1–2 field kept.
  **v1 → v2 → v3** chains (a Phase 1 save gets Bark, a skipped tutorial, then the v3 fields).
- **repairState:** back-fills the world map from visited checkpoints; later milestones imply earlier ones; a lost
  coupling or relay cell is restored if it is still needed; the map list includes any map whose checkpoint was
  used. **sanitize:** an unknown checkpoint falls back to the last valid one visited; unknown maps, sections and
  landmarks are dropped and invalid relay directions reset, rather than erasing the campaign (unit test).
- A player who finished Mission 01 in Phase 1 or 2 continues straight into Mission 02 (unit test + browser
  scenario B).
- Interrupted transitions are safe because the arrival checkpoint is saved before the scene restarts (unit test).

## Changed files

Relative to `origin/main` (Phase 2 merged). **(new)** marks new files.

- **Region data:** `src/data/regions/types.ts`, `registry.ts`, `surface.ts`, `frozenDepths.ts`, `echoRidge.ts` (all new);
  `src/data/world.ts` (outpost lift, station lift and cable dock, shared types), `src/data/items.ts`, `src/data/story.ts`
- **Systems:** `src/systems/regions.ts`, `puzzles.ts`, `effects.ts` (new); `mission.ts`, `interactions.ts`, `save.ts`,
  `state.ts`, `settings.ts` (Map action, Tab alternate, Brighter caves), `worldBuilder.ts`
- **Phaser side:** `src/game/Lighting.ts` (new); `WorldView.ts` (secret-aware auto-tiling), `ObjectsView.ts` (sign
  reach), `src/scenes/GameScene.ts`
- **Art and audio:** `src/art/regionProps.ts` (new), `tiles.ts`, `icons.ts`, `registerTextures.ts`, `src/audio/AudioManager.ts`
- **Input and UI:** `src/ui/WorldMapUI.ts` (new), `UI.ts`, `ui.css`, `src/input/InputManager.ts`
- **Tests:** `tests/regions.test.ts`, `tests/phase3.test.ts` (new); `tests/mission.test.ts` and `tests/phase2.test.ts`
  updated (see below)
- **Play-tests:** `playtest/phase3.py` (new)
- **Docs:** README, ARCHITECTURE, GAME_DESIGN, ROADMAP, ASSET_CREDITS (science sources), this file,
  `docs/screenshots/phase3/`

Two existing tests changed because behaviour changed on purpose, and both still assert exact values:
`mission.test.ts` now expects Mission 01 to end on Mission 02's first objective (`m2_brief`) instead of a final
`complete` state; `phase2.test.ts`'s v1 migration test now expects the current version (3) and the exact v3
inventory and abilities. Nothing was deleted or loosened.

## Test results (2026-11-25)

**Static and unit:** `npm run typecheck` passes (strict), `npm run build` passes, and `npm test` passes **141 / 141**
across 9 files. That includes the 93 Phase 1–2 tests, two of them updated as described above, plus 48 new tests:
`regions.test.ts` (25) and `phase3.test.ts` (23). They cover region registration, unique object ids, valid
connection endpoints and arrival checkpoints, no object crowding a lift, gate or cable car, region-graph connectivity, reachability on every map (mandatory
routes with easy jumps only, Thruster Boots routes, secrets), Headlamp gating and persistence, puzzle
progression and idempotency, both missions on the pure rules, shortcut activation, world-map discovery, cross-map
hint routing, v1/v2 → v3 migration, invalid region recovery, interrupted transitions, item loss and duplication,
and Mission 01/tutorial compatibility.

**Browser play-tests** (`python playtest/phase3.py`, headless Chrome with real keyboard and touch input). Final run
on the final build: **89 / 89 checks passed**, with no page errors in any scenario.

| Scenario | Checks | What it proves |
| --- | --- | --- |
| **A** Fresh game → M00 → M01 → M02 → M03 | 7 | The whole adventure, start to finish, with real key presses. |
| **B** Completed Phase 2 (v2) save → new regions | 8 | Loads as v3; inventory, collectibles, M01 completion and tutorial state kept; map back-filled; continues into M02; reaches the depths; Headlamp saved. |
| **C** Frozen Depths puzzles + return by shortcut | 8 | Puzzles A, B, C; survey lift started; back on the surface by the shortcut. |
| **D** Echo Ridge relays → tower | 7 | North Access, relays A/B/C, network online, signal traced, cable car to the station. |
| **E** Optional discoveries | 13 | All 9 new discoveries via Headlamp, Sniff, Bark and Thruster Boots, plus the world map opening and closing with M. |
| **F** Save/reload in each new region | 5 | Reload returns to the right map and checkpoint; Headlamp and relays kept. |
| **G** Save mid-puzzle | 6 | Coupling held, objective resumes, half-turned dish keeps its direction, network not falsely online. |
| **H** Easy Jumps + reduced motion + brighter caves | 15 | Missions 02 and 03 completed with accessibility settings on. |
| **I** Mobile touch (844×390 emulated) | 9 | Headlamp, light-sensor puzzle, map opened and closed by real taps with the touch controls hidden meanwhile, Relay A, ridge climb, all by touch. |
| **J** Repeated travel | 5 | 12/12 lift trips, no state drift, correct arrival, heap not growing (see Performance). |
| **K** Locked regions | 6 | Freight lift, survey lift, North Access, cable car and tower door all stay shut before their requirements. |

**Regression on the Phase 3 build:** `playtest/phase2.py` **49 / 49** and the Phase 1 route bot
(`playthrough.py`) completes Mission 01 (147 s at bot speed, no errors). Two Phase 2 browser checks were updated
the same way as the unit test: a Phase 1 save now loads as v3, and the inventory check asserts every Phase 1
count is unchanged and new items are zero.

**Bugs and test defects found during this play-test pass and fixed:**

- **Hidden rooms were outlined by the surrounding rock** (the ridge boulder niche and others showed a rectangle):
  fixed in the auto-tiler.
- **Touch controls covered the world map** (and any full-screen menu): the D-pad sat on top of "Close map", so a
  tap there moved Laika instead of closing it. Touch controls now hide while the map, pause, a confirmation or the
  completion card is open, and reappear afterwards, including after quitting to the title. Scenario I now closes the
  map with a real tap on that spot instead of a scripted click (which had hidden the bug).
- **Pressing E beside a lift could do something else.** Found by scenario J (1 trip in 12 failed intermittently):
  in the depths lift hall the service-tunnel sign stood two tiles from the survey lift, so stopping one step past
  the lift made E read the sign. A new unit test then found two more: the station's cable-car dock two tiles from
  the signal console (Mission 01's key object) and the depths entrance sign beside the freight lift. Fixed by moving
  the dock and both signs at least three tiles from any transit, and by giving signs a shorter reach (18 px), so
  they are read only when Laika stands at them.
- **Tab did not open the map**, although the input code and docs said it would. Added as a fixed alternate key
  and listed in the in-game controls.
- Play-test script defects that hid or faked results: a bot hop that walked off the olivine ledge; a save injected
  into a running game (its autosave on hide overwrote the injected save, so a touch check passed while still in
  the depths); a travel stress test that pressed E away from the lift and counted attempts instead of real trips
  (its earlier "no drift" result was vacuous). All three were fixed and the scenarios now check the real outcome.

Screenshots of every view the brief lists are in `docs/screenshots/phase3/`.

## Performance observations

Measured in the play-test environment: headless Chrome with **SwiftShader software rendering on a 2-core
container with no GPU**. These are not numbers for real phones or desktops.

| Measurement | Result |
| --- | --- |
| Frame rate, surface (2 s sample) | 59–60 fps across runs |
| Frame rate, Frozen Depths with darkness and lighting | 39–53 fps across runs (the slowest view; it varies with CPU load from the other browser in the test container) |
| Heap across 15 round trips (30 map loads), GC forced before each sample | 29.2 MB at start → 30.0 MB after the first round trip (one-time warm-up) → 30.7 MB after 15. It creeps about 0.05 MB per round trip and is flattening; texture count (189), scene objects (195) and active tweens (20) are identical after every trip. No leak of game objects or textures. |
| Travel time per transition | about 1.5 s including the fade (scene restart + map build) |

- Map sizes: surface 240×34, depths 136×42, ridge 112×64 tiles. Only one is built at a time.
- Lighting costs one 480×270 RenderTexture fill plus about a dozen erases per frame, independent of map size,
  and is only created on dark maps.
- Particles: one emitter per map (frost or dust), off with reduced motion.
- **Not measured:** real GPUs, phones, battery and thermal behaviour, long sessions over 30 minutes, load time on
  slow networks.

## Known issues

- **Echo Ridge still reads as blocky in places.** The ridge has its own palette, tilted strata, ragged tops, spires,
  layered mountains and the tower skyline, but the hanging boulder, the Ridge Camp knob and the switchback ledges
  are still rectangles. This is the most visible art debt; the brief asked to avoid "red rectangular platforms".
- **Arrivals stand one step away from their lift or hatch** (1–2 tiles), so pressing E immediately after
  arriving does nothing until Laika takes a step and the prompt appears. This is intentional (it prevents
  transition loops), but a player could think the lift is broken. A small fix would be to face the transit on
  arrival or show its prompt from a little further away.
- **Revealed secret rooms lose their inner edge shading.** To stop hidden rooms being outlined (a giveaway found in
  play-testing), the auto-tiler now treats secret cells as solid. Once a room is revealed, its walls have no edge
  highlight. Minor, but visible up close.
- **Frozen Depths renders slower than the surface** in software rendering (see Performance): the darkness
  overlay is the cost. Unknown on real GPUs and phones.
- **Play-test shortcuts.** Scenarios E (optional discoveries) and J (travel stress) use the debug teleport to move
  between sites; every pickup, dig, bark, puzzle and ride in them is still done with real key presses. The other
  scenarios never teleport.
- **Bot-only precision** (carried over from Phase 2): the bots jump from fixed positions with fixed timings, so
  routes occasionally need their recovery paths (pit step, tunnel). Logged, not game bugs.
- The Phase 1 commit on `main` is still authored by the original tool identity (rewriting it needs a force-push).
  Phase 2 and 3 commits are authored by `neljalvarez`.

## Unverified functionality

- **No human has played Phase 3.** Puzzle clarity, mission length (target 5–8 minutes per region), whether the
  tower draws players onward and whether the map is understood are all unknown.
- **Audio has not been listened to**: new ambience (depths hum, ridge wind), cross-fades between maps and new
  machine cues were checked programmatically only. Still true for Phase 2's cues as well.
- **Real devices:** touch was tested in an emulated 844×390 viewport; no physical phone, tablet or gamepad (the
  map's gamepad Back button and LB bark have never been pressed on hardware).
- **Performance on real hardware** (see above), especially the darkness overlay on low-end phones.
- **Screen readers:** the map is HTML/SVG with labels, but the game canvas is not described; untested with a
  screen reader.
- **144 Hz displays** and very wide or very tall aspect ratios in the new regions.
- Phase 2 items still open: the bot finishes Mission 00 in about 17 s against a 60–120 s target, hint timings are
  guesses, and the apex-hang overshoot noted in Phase 2 should be watched on the ridge's small ledges.

## Human playtesting requirements

1. **First-time players, including children.** Watch, don't help: do they find the Headlamp, understand that the
   shining arrows are the route, find the coupling from the crew note, read the relay plaques, notice the
   tower, and use the map unprompted? Time each mission.
2. **The dark.** With and without "Brighter caves": can people always see where they can walk?
3. **The ridge climb.** Is it approachable for younger players? When does the Easy Jumps offer appear, and is it
   welcome?
4. **Secrets.** Which of the nine are found without hints? Any that feel unfair?
5. **Navigation.** Do the shortcuts get used? Does anyone get lost between maps?
6. **Audio listening pass** on headphones and phone speakers.
7. **Real phones and a gamepad**, including frame rate in the Frozen Depths.

## Recommended priorities for Phase 4

1. Run the human playtests above, then tune hint timings, puzzle wording and the ridge climb from what people do.
2. Audio listening and mixing pass across all regions.
3. Real-device testing, especially the darkness overlay on phones; reduce light stamps or resolution if needed.
4. Art pass on Echo Ridge silhouettes (boulder and knob shapes read as boxes in places) and the hidden niche's
   outline, which partly gives the secret away.
5. Then the Phase 4 brief. The Phase 3 brief reserves the survival simulation for Phase 4. The suit's ability
   strip and the region/puzzle data model are the places to hook new systems in.
