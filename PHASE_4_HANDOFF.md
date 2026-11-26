# Phase 4 handoff — LAIKA: THE LAST SIGNAL

**Phase 04/11: Survival, Engineering & Interactive Base Systems.** Status as of 2026-11-26: implemented on branch
`feature/phase-04-survival-engineering` (branched from `main` at 8342cf2, after the Phase 3 merge, PR #2). All
automated checks pass. Read `GAME_DESIGN.md` → *The base comes alive* and `ARCHITECTURE.md` → *Engineering
simulation* first.

Nobody has played Phase 4 yet. Every "verified" below means unit tests or scripted play in headless Chrome. The
items that need people (playtests with children, listening to the audio, real phones and gamepads, the balance of
the numbers) are listed under [Unverified functionality](#unverified-functionality).

## Implemented features

| Area | What exists | Where |
| --- | --- | --- |
| Interactive base | A walkable lower level under the outpost (cols 40–88) reached by the habitat's ladder: radiation shelter, maintenance bay, Laika's quarters, life support, grow room, water room. 14 new base machines, 9 recharge posts, 3 optional instruments. | `data/world.ts`, `data/regions/*.ts`, `systems/facilities.ts` |
| Visible transformation | Rooms light up one by one; status lights (tick / bar); cables and water pipes show flow; recycler fan and drums animate; planter in 6 looks; greenhouse dome on the surface with the crop growing inside and a glow; vent with steam; beacon light after the finale; dust-haze tint during LIGHTS OUT. Derived from state by a pure module, so it is unit-tested. | `game/facilityLook.ts`, `game/BaseView.ts`, `game/ObjectsView.ts`, `art/baseProps.ts` |
| Solar power | 3 panels, 5 PU each when clean, 1 PU when dusty, × a sunlight factor (1, or the haze fraction). | `systems/engineering.ts` |
| Battery storage | Restored with a regulator from the ship. 100 BU (80 Expedition), charges from surplus and covers shortages at 0.25 BU per PU-second, clamped 0..capacity. Starts at 40 BU. | same |
| Power distribution | Critical systems (habitat 2, life support 3, shelter 1) are always on and not in the choice. Optional: water 1, greenhouse 3, research 2. Console with a "fits / too much" bar in words and a Recommended button. Brownout drops optional systems (greenhouse → research → water) when the battery is empty, and restores them by itself. | `systems/engineering.ts`, `ui/BaseUI.ts` |
| Habitat | Ladder both ways (a fade, no loading), sleeping mat that recharges the suit, storage locker with seeds, a checkpoint, a potted plant after the first harvest. | `systems/facilities.ts` |
| Life support recycler | Inspect → sniff and dig up the pump cartridge → install → connect the power box → start. | same |
| Water circulation | Inspect the water processor → take the spare melt-line coupling from the Frozen Depths' core drill (once) → install. Water then reaches the tank, the recycler and the grow room. Uses the existing survey-lift shortcut. | same |
| Greenhouse | Power, open valve, seeds, plant, lights; four stages over about a minute of active play (15 / 35 / 60 s); harvest once, then a new crop starts. Grows only when lit, watered and powered. | same |
| Radiation shelter | Wake the monitor, bark at the probe inside and the probe outside (they "hear" the suit radio), log the readings: "Outside 7, Inside 2 (fictional game units)". | same |
| Suit energy | Thruster jump, the new boosted second air jump, and scans cost energy; walking, normal jumps, sniffing, barking and the headlamp never do. Reserve cell refills to a safe floor that always pays for one thruster jump. Scanner works at 55 % range when empty. Only from Mission 04 (Missions 00–03 play exactly as before). | `systems/survival.ts`, `game/Player.ts` |
| Recharge posts | Ship, outpost, station, canyon (broken until Challenge A), depths ×3, ridge ×2. Shown with ϟ on the world map once seen. | region data, `ui/WorldMapUI.ts` |
| Survival Assistance | Settings → Survival assistance: Relaxed / Adventure (default) / Expedition; changeable any time, clamps values, never removes progress. | `systems/settings.ts`, `ui/UI.ts` |
| Mission 04 | *A Place to Call Home*, 14 steps, recommended order with flexible alternatives, finale moment + transmission + completion card. | `systems/mission.ts`, `data/story.ts` |
| LIGHTS OUT | Scripted, recoverable: starts a few seconds after the last facility is restored at the outpost; haze, alarm, console, two dusty panels, sweep. | `systems/facilities.ts`, `GameScene.phase4Checks` |
| Base Status | From the base terminal or Pause. Simple view (network diagram + list with symbol and word) and detailed view (numbers, trend, plant stage, suit, mode, "made-up units" note). | `ui/BaseUI.ts` |
| Science Journal | 8 categories, 12 entries, each with real science, an "In the game" fiction note and a source link. Unlocked by achievements; quiet toast. | `data/science.ts`, `ui/BaseUI.ts` |
| Optional challenges | A: canyon power cell → dead recharge post → seismometer. B: Frozen Depths fissure deep probe (boosted jump). C: Echo Ridge observation platform (boosted jump). | region data, `systems/facilities.ts` |
| HUD | Suit meter (bar + "SUIT 72%" + LOW) and power chip ("☀ BASE 64% ▲", "⚠" during the haze), under the top-right buttons. Hidden until Mission 04. | `ui/BaseUI.ts`, `ui/UI.ts` |
| Micro-tutorials | One-time tips on first contact: battery, recycler, plants, recharge, low suit, power priority, science journal. | `data/story.ts` TIPS |
| Saves | Format v4, migration from v1, v2 and v3. | `systems/save.ts`, `systems/state.ts` |

## Engineering architecture

```
src/data/engineering.ts   FACILITIES (demand, critical, dependsOn, science), CONSUMERS, OPTIONAL_SYSTEMS,
                          ENGINEERING (power, battery, haze, growth) and SUIT (costs, reserve) — every number
src/systems/engineering.ts computePower(s, mode) -> PowerStatus; stepEngineering(s, mode, dt) -> events;
                          EngineClock (fixed step); allocationFits / recommendedAllocation; clampEng
src/systems/survival.ts   suitCost / canUse / spend, airJumpLimit, scanRadiusFactor, recharge, SuitReserve
src/systems/facilities.ts phase4Interaction / performPhase4 (checked before Phase 1-3 rules), syncScience,
                          markReturned, lightsOutReady / startLightsOut, setAllocation, completeMission04
src/game/facilityLook.ts  state -> textures, room darkness, surface look (pure)
src/game/BaseView.ts      decor that follows facilityLook; ObjectsView.syncBase updates the machines
src/ui/BaseUI.ts          HUD meters, Base Status, power console, Science Journal (plain DOM)
```

`GameScene` owns the clock: each frame of free play it calls `EngineClock.advance(delta, step)`, handles engine
events (captions, toasts), then `syncBase()` updates machines, decor and the HUD. Interactions stay pure: they
mutate the state and return `Effect[]`; new effects are `stairs`, `ui` and `science`.

## Facility dependencies

| Facility | Needs | Demand (PU) | Critical | Unlocks |
| --- | --- | --- | --- | --- |
| Solar Array | repaired control box + clean panels (Mission 01) | — | yes | everything |
| Battery Station | solar + the regulator from the ship | — | yes | the lower-level power bus |
| Habitat | battery | 2 | yes | ladder, mat, storage (seeds) |
| Life Support | battery, pump cartridge, power box | 3 | yes | water recovery entry |
| Radiation Shelter | battery, both probe readings | 1 | yes | radiation entry |
| Water System | battery, melt-line coupling (Frozen Depths) | 1 | no | grow-room valve |
| Greenhouse | battery, water, power box, valve, seeds | 3 | no | plants entry, harvest |
| Research Gear | solar only (receiver and workstation, as in Phases 1–3) | 2 | no | — |

The battery is the gate for the whole lower level, so the first decision is a real one ("the ship has a spare
regulator"). After that, the recycler, the water loop, the greenhouse and the shelter can be done in any order;
the greenhouse is the only one that physically needs another (water).

## Simulation timing

- **Fixed step:** 250 ms. `EngineClock.advance` accumulates real frame time, clamps a gap to 4 steps (1 s), and
  runs whole steps only. Same result at 30, 60 or 144 fps (unit-tested).
- **Paused** in every menu and panel (the Phaser scene is paused), during transmissions, camera focus moments,
  map travel and Mission 00 (first run and replay). A hidden tab opens the pause menu (verified in the browser).
- **No offline progress:** the clock is never saved; loading a save continues from exactly the saved values
  (verified in the browser by closing the page for 6 s).
- **Clamping:** battery 0..capacity, suit 0..100, grow time 0..last stage, dust list only known panels, on every
  step, on load (`sanitize`) and when Survival Assistance changes (`clampEng`).
- **Cost:** about 24 µs per engine step and 83 µs for a full base texture check (measured with vite-node), at 4
  steps per second.

## Resource values and balancing rationale

All in `src/data/engineering.ts`; units are fictional and the detailed view says so.

| Value | Setting | Why |
| --- | --- | --- |
| Panel output | 5 PU clean, 1 PU dusty, 3 panels | 15 PU covers every machine (12 PU) with a clear surplus, so normal play never asks for management. |
| Demand | habitat 2, life support 3, shelter 1, water 1, greenhouse 3, research 2 | The greenhouse is the biggest optional load, so the obvious LIGHTS OUT answer ("the grow lights") is also the right one. |
| Battery | 100 BU (Expedition 80), starts 40, 0.25 BU per PU-second | Fills in about half a minute, drains slowly: a wrong console choice gives over a minute before anything switches off, and even then only optional systems pause. |
| Haze sunlight | 70 % Relaxed, 62 % Adventure, 50 % Expedition | 62 % of 15 = 9.3 PU: switching off only the grow lights (9 PU) fits. Expedition (7.5 PU) also needs the research gear off: one more decision. |
| Growth | 15 / 35 / 60 s of lit, watered, powered play | The crop visibly changes while the player does the shelter or LIGHTS OUT; never a waiting game. |
| Suit costs (Adventure) | thrust 10, boost 25, scan 2 | About 7 boosted jumps or 50 scans from full; recharge posts are never far. |
| Suit costs (Expedition) | thrust 16, boost 36, scan 4 | Two boosted jumps from full: the optional challenges are planned around a recharge post. |
| Reserve floor | Relaxed full, Adventure 25, Expedition 20 (after 4 s, 3 SE/s) | Always at least one thruster jump, so Laika is never stranded on a ledge she reached with the boots. |
| Jump heights (measured) | boots double jump ≈ 6.1 tiles, boosted triple ≈ 8.6 tiles | Challenge B and C ledges are 7 tiles up: impossible with boots alone, comfortable with the boost. |

## Mission progression

Mission 04 starts at the Ares Station console after Mission 03 (the cable car ride down). The objective recommends:
call → home → base terminal → regulator → battery → recycler (inspect, cartridge, install, power, start) →
water (inspect, coupling in the depths, install) → greenhouse (power, valve, seeds, plant, lights) → shelter
(monitor, inside probe, outside probe, log) → LIGHTS OUT (balance, sweep) → step outside. Any base work already
done skips "go home" and "check the terminal". A unit test plays it in another order (shelter and greenhouse
before life support). Mission items are unique: they cannot be lost, duplicated or spent on crafting.

The finale: Laika looks at the habitat and wags, the camera rests on the base, then the station's transmission
(ending "...good work, little explorer... the northern signal is getting clearer..."), then the MISSION 04
COMPLETE card. The mystery is not resolved; the objective becomes "Explore freely. The signal waits in the
north...".

## Survival Assistance behavior

| | Relaxed | Adventure (default) | Expedition |
| --- | --- | --- | --- |
| Suit costs | none ("SUIT ∞") | 10 / 25 / 2 | 16 / 36 / 4 |
| Reserve | refills to full | 25 | 20 |
| Battery | 100 | 100 | 80 |
| Haze sunlight | 70 % | 62 % | 50 % |
| Scanner range | full | full | 85 % |
| Puzzles, story, science | all | all | all |

Changing the setting mid-mission clamps the battery to the new capacity and keeps every flag (unit-tested and
verified in the browser with the Expedition challenges and a Relaxed Mission 04).

## Save migration details

- `STATE_VERSION = 4`. New: `eng { battery, alloc { water, greenhouse, research }, growMs, suit, dusty[] }`,
  `science[]`, 26 flags, 5 items (regulator, recyclerPart, waterCoupling, seeds, powerCell).
- `migrate`: v3 → v4 adds a fresh engineering block (battery 0, all allowed, suit 100, no dust) and an empty
  journal. v1 → v2 → v3 → v4 chain. A finished Mission 03 save continues at "answer the call" with everything
  kept (unit-tested and in browser scenario B).
- `sanitize`: clamps every engineering number, drops unknown panels and journal ids, replaces a non-object block.
- `repairState` (now repeated until stable, at most 4 passes): later flags imply earlier ones; a needed mission
  item is restored and a used one is never given back; the battery is 0 until restored; dust exists only between
  "balanced" and "done"; the grow timer is 0 until planted; journal entries are re-derived from achievements.
- Saving during LIGHTS OUT and loading resumes exactly there (unit-tested and browser scenario D).

## Changed files

New: `src/data/engineering.ts`, `src/data/science.ts`, `src/systems/engineering.ts`, `src/systems/survival.ts`,
`src/systems/facilities.ts`, `src/game/BaseView.ts`, `src/game/facilityLook.ts`, `src/art/baseProps.ts`,
`src/ui/BaseUI.ts`, `tests/phase4.test.ts`, `tests/phase4nav.test.ts`, `playtest/phase4.py`, this file,
`docs/screenshots/phase4/`.

Changed: `src/data/world.ts` (lower level terrain and objects, new object kinds and parts), the three region files
(recharge posts, fissure, scaffold, challenge objects, a lower-level section), `src/data/items.ts`,
`src/data/story.ts` (two transmissions, six tips), `src/art/icons.ts` (5 item icons, 8 journal icons),
`src/art/registerTextures.ts`, `src/systems/state.ts`, `save.ts`, `mission.ts`, `interactions.ts`, `effects.ts`,
`navigation.ts` (BOOST_JUMP), `settings.ts`, `src/game/ObjectsView.ts`, `Player.ts`, `src/scenes/GameScene.ts`,
`src/ui/UI.ts`, `WorldMapUI.ts`, `ui.css`, the docs.

Existing tests changed (each still exact, none weakened): `tests/world.test.ts` models the habitat ladder in its
reachability helper (so the lower level is checked, not excluded); `tests/phase3.test.ts` asserts
`STATE_VERSION` instead of the literal 3, counts the new journal totals and expects Mission 03 to lead into
`m4_call`; `tests/phase2.test.ts` expects the five new items at zero. `playtest/phase2.py` and `phase3.py` expect
the save version 4.

## Automated test results

**Static and unit:** `npm run typecheck` passes (strict), `npm run build` passes, and `npm test` passes
**195 / 195** across 11 files: the 141 Phase 1–3 tests (four updated as listed under Changed files, none
weakened) plus 54 new ones in `phase4.test.ts` (42) and `phase4nav.test.ts` (12).

Coverage against the brief's list (§32): solar generation, battery charging / discharge / capacity, power
distribution, protected critical systems, facility dependencies, recycler restoration, water circulation,
greenhouse growth, suit-energy use, recharging, zero-energy recovery, Survival Assistance (each mode, and
changed mid-mission), offline depletion prevention, paused simulation, clamping, duplicate restoration
prevention, Mission 04 (two orders), LIGHTS OUT (every mode, a wrong choice first, saved mid-event), save
migration (v1, v2, v3 → v4, corrupted engineering block), existing missions (Missions 00–03 suites still pass and
Mission 03 leads into Mission 04), region transitions and shortcuts (the Phase 3 tests plus browser scenario K),
tutorial replay isolation (the simulation is gated off during Mission 00 in `GameScene`; the Phase 2 replay tests
still pass), spending metal on Thruster Boots before restoring anything, an interrupted repair keeping its part,
and the base's visible look (every texture it can name exists).

## Browser playtest results

Headless Chrome (system Chrome, SwiftShader) with real keyboard and touch input, `python playtest/phase4.py`.
Final full run on the final engineering build: **113 / 113 checks** after one script defect was fixed (scenario J
compared a value read before pausing with one read after two seconds of play; it now compares the saved value
with the value right after loading, and passes). Scenarios I and J were re-run after the last balance change
(Expedition reserve 15 → 20): 13 / 13. No page errors in any scenario.

| Scenario (brief §33) | Checks | What it proves |
| --- | --- | --- |
| **A** Fresh game → Missions 00, 01, 02, 03, 04 | 21 | The whole adventure, start to finish, with real key presses, including the cable car down after Mission 03. |
| **B** Completed Phase 3 save → Mission 04 | 8 | v3 → v4 in the browser, progress kept, "answer the call", suit meter appears only then, a recharge post works. |
| **C** Restore every facility | 3 + 8 screenshots | The outpost abandoned, partly and fully restored (surface and lower level); Base Status all ✔; detailed view with units and the fiction note. |
| **D** LIGHTS OUT | 9 | Starts by itself; save/reload mid-event resumes it; an over-budget choice does not balance; life support shown locked; switching off the greenhouse balances; two dusty panels; sweeping ends it; finale follows. |
| **E** Greenhouse stages | 3 | Empty wet tray → seeds → sprouts → small → mature (planter and surface dome), then harvest, in about a minute. |
| **F** Deplete the suit and recover | 6 | Three boosted jumps drain it; a clear message and tip appear; walking, jumping and sniffing still work; the reserve trickles back to 25; a recharge post fills it. |
| **G** Mission 04 in Relaxed | 16 | Complete mandatory progression with suit costs off. |
| **H** Mission 04 in Adventure | 16 | Complete Mission 04 from a Phase 3 save, no teleports: 2.9 minutes at bot speed. |
| **I** Expedition challenges | 8 | A: sniff the power cell, repair the dead post, read the seismometer. B: recharge, thruster jump to the ice ledge, boosted jump to the deep probe. C: boosted jump to the observation platform. |
| **J** Save/reload mid-restoration | 5 | Lower-level checkpoint, the dug-up cartridge kept, battery value kept, objective continues. |
| **K** Travel while systems run | 6 | 6/6 lift trips; plants keep growing during play elsewhere; battery within capacity; flags unchanged; heap not growing. |
| **L** Phone (844×390 touch emulation) | 7 | Touch controls, a contextual action by tap, Base Status and Science Journal by tap (touch controls hidden under the panels), journal fits the screen. |
| **M** Paused / hidden / offline | 4 | Values frozen in the pause menu and in a hidden tab (the game pauses itself); closing the page for 6 s changes nothing. |
| **N** Previous missions | see below | The Phase 1–3 suites on the Phase 4 build. |

**Scenario N (regression on the Phase 4 build):** `playtest/phase3.py` **90 / 90**, `playtest/phase2.py`
**49 / 49**, and the Phase 1 route bot completes Mission 01 (146 s at bot speed, no errors). Two browser checks
were updated because saves now load as v4 (they asserted the literal version 3).

**Bugs found by these play-tests and fixed:**

- The power console's "switch off the grow lights" answer, which the hint suggests, did not fit the haze in
  Adventure (9 PU wanted, 8.3 made). The haze now leaves 62 % sunlight (9.3 PU), and a unit test pins the hint.
- The battery filled from empty in about 4 s, which made it meaningless; flows now move 0.25 BU per PU-second.
- On phones the suit meter covered the map / hint / pause buttons; the right HUD column now stacks them. The
  first-time tips also moved below that column (they covered the meter) and gameplay tips are labelled "Tip"
  instead of "Science".
- Status lights overlapped the room signs; they now sit at each sign's right edge.
- The greenhouse dome hid behind a yard lamp; it is now drawn in front of it (and behind Laika).
- An emptied part source (e.g. the cartridge's dig spot) could still look full in an edited or old save; loading
  now marks the source of every installed part as taken (unit-tested).
- Play-test script defects: Space presses from the bot's "stuck" jump landed on the completion card's focused
  button (now the card also waits a moment after the dialogue closes, so a player mashing Jump cannot dismiss it);
  an extra E press re-opened the console; scenario A did not ride the cable car down after Mission 03; the fissure
  climb needed a thruster jump to the first ledge; the boosted jump has to be held to its apex like a player would.

Screenshots of every view the brief lists (36) are in `docs/screenshots/phase4/`: abandoned / partly / fully
restored outpost (surface and lower level), battery station, recycler, water circulation, the greenhouse from
empty tray to harvest plus the dome, habitat interior, radiation shelter, the power console, LIGHTS OUT, recharge
station, low suit energy, Base Status (both views), the Science Journal, phone gameplay, the finale
transmission, MISSION 04 COMPLETE, and the three challenges.

## Performance observations

Measured in the play-test container: **headless Chrome with SwiftShader software rendering, 2 CPU cores, no GPU**.
Not representative of phones or desktops.

| Measurement | Result |
| --- | --- |
| Frame rate, surface at the outpost with every system running (2 s sample) | 57 fps |
| Frame rate, lower level (dim overlays, pipes, cables, animated machines) | 59 fps |
| Heap across 6 lift trips with the base running, GC forced | 32.7 MB → 31.6 MB (no growth) |
| Engineering step (vite-node, 20 000 steps) | ≈ 24 µs per 250 ms step |
| Full base texture check (every object on the surface map) | ≈ 83 µs, at most 4 times a second |

- The lower level adds about 60 display objects (signs, lamps, lights, 6 dim rectangles, 5 tile-sprites, dome
  layers); they exist only on the surface map. Pipes and cables scroll their tile offset; no per-frame allocation.
- Machine textures change only when the key differs, and HUD meters update only when their text changes.
- Steam puffs (one image every 0.7 s, destroyed after 1.6 s) only while the recycler runs and reduced motion is off.
- **Not measured:** real GPUs, phones, battery and thermal behaviour, sessions longer than about 15 minutes.

## Known bugs

- **Haze tint and dim rooms are subtle in screenshots.** The lower level uses the station's dark back wall, so a lit
  room is only moderately brighter than a dark one; the status lights (tick vs bar) and wall lamps carry most of
  the difference. Worth an art pass after playtests.
- **The lower level is a cut-away**: it is visible from the surface through the ground (by design, like the
  reference image of a cut-away habitat), so players see the rooms before finding the ladder. If playtests show
  confusion, add a fading rock shell like the ship's.
- **Completion cards and Space:** the Mission 04 card now waits a moment after the dialogue, but the older
  Mission 01 and 03 cards still focus "Keep exploring" at once, so a Space press at that instant dismisses them
  (they can be read again only by replaying). Not changed in Phase 4.
- **On phones the interaction prompt sits over Laika** in the lower level (the prompt is bottom-centre, as in
  Phases 1–3). Readable, but it hides her for a moment.
- **No new sounds**: the machines reuse existing cues, so the recycler and the water have no hum of their own.
- **"Research gear" is only a number.** Switching it off at the console changes the power budget, but the receiver
  and workstation on the surface keep their Phase 1 "powered" look. A later pass could dim their screens.
- Echo Ridge's blocky silhouettes (from Phase 3) are unchanged.

## Unverified functionality

- **No human has played Phase 4.** Whether the ladder is found, the console understood, the haze tint readable and
  suit energy never annoying are all open questions.
- **Audio** in the new context: machine cues reuse existing sounds; nobody has listened to them.
- **Real phones and tablets**: the mobile run is Chrome's emulation (844×390, touch). The HUD has two more
  elements under the buttons; check small phones in portrait-locked landscape and with notches.
- **Gamepad** with the new interactions and the boosted jump (no gamepad in the test environment).
- **The boosted jump by feel**: the bot times each press at the apex; a person may need a few tries. The
  challenge ledges are optional and the recharge posts are next to them.
- **Balance**: every number is a first guess backed by the reasoning above, not by play data.
- **Time to complete Mission 04**: target 8–12 minutes; a bot that knows the route takes about 3.
- Screen readers on the new panels (they are plain buttons, labels and checkboxes, but untested).

## Human playtesting requirements

1. Children and adults new to the game, from a Mission 03 save: do they find the ladder and the lower level
   without the hint? Do they read the Base Status diagram?
2. LIGHTS OUT: do players open the console, understand "always on", and pick a working choice? How long does it
   take? Does anybody feel stressed (the brief says it must not be)?
3. Suit energy in Adventure and Expedition: is the meter noticed, is LOW ever frustrating, are recharge posts
   found? Try the two boosted-jump challenges on keyboard, touch and gamepad.
4. The greenhouse: do players notice the crop growing (lower level and dome) and come back to harvest?
5. Science Journal: is it opened, are "Learn more" texts read, is the fiction note understood?
6. Real devices: one low-end phone, one tablet, one desktop with a gamepad; check the HUD layout and the frame rate
   in the lower level and the Frozen Depths.

## Recommended Phase 5 priorities

1. Human playtests above, then a balance pass on `data/engineering.ts` (tests read the config, so tuning is safe).
2. Art pass on the lower level (it reuses the station back wall; rooms could get furniture and more depth) and the
   still-blocky Echo Ridge shapes noted in Phase 3.
3. Machine sounds of their own (recycler hum, water gurgle, grow-light buzz) and a short base-at-night ambience.
4. Let the restored base matter later: e.g. the shelter used in a future radiation event, the greenhouse feeding a
   companion, upgrades from salvage.
5. Continue the mystery north from a base that now works.
