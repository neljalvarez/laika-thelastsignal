# Phase 5 handoff: crafting, equipment progression and a major simplification

Branch: `feature/phase-05-progression-simplification`. Save format: **v5**.

Phase 5 began with player feedback on the Phase 4 build:

- too much text, overstimulating;
- "I don't know what to do";
- confusing objectives;
- finishing Mission 01 felt like the end of the game.

About 60 % of the work went into simplification, 30 % into crafting and equipment, 10 % into testing.

> **No human playtesting was done in this phase.** Everything below was checked by unit tests and by scripted
> browser runs (headless Chrome driven by Playwright with real key presses and emulated touch). A script that knows
> the route says nothing about whether a new player understands the game. The blind-playtest procedure is at the end
> of this document.

## 1. What was implemented

### Simplification

| Area | Change |
| --- | --- |
| **Text** | Short objectives and hints, 1–3-word action prompts, plain item names, and two-line transmissions (the full text is kept in Journal → Radio). Shorter tips and short toasts throughout. Word budgets are enforced by unit tests. |
| **Terms** | Metal, Circuit, Radio Part, Rock Sample, Power Part, Relay Cell, Recording, Rover Part, Battery Part, Pump, Pipe Connector, Seeds, Power Cell, Nav Beacon. Internal ids are unchanged, so saves still load. |
| **HUD** | A compact objective box: direction arrow, one line, the action key. The inventory peeks for a few seconds when it changes. The suit meter appears only when energy is low or after a boosted jump; the power chip only at the base or during LIGHTS OUT. Settings → Gameplay help → Screen info → *Detailed* restores the Phase 4 HUD (title, steps, Details, permanent inventory and abilities). |
| **Missions → chapters** | No more completion cards. A mission ends with a short milestone toast ("Signal traced!") and a chapter banner, and the next chapter starts **by itself**. The relay logs (Ch2), the station call (Ch4) and the gear call (Ch5) arrive over the radio, with no walk back to a console. This also removes the Phase 4 dead end the user reported, where the habitat ladder stayed shut until the Ares console was used. |
| **Waypoints** | Route-aware guidance: a marker on screen or an edge arrow off screen. It goes around walls, uses the habitat ladder, and on another map points to the nearest open lift. Modes: Guided (default), Explorer (only when stuck), Minimal (direction arrow only). The ? button shows it for 9 s in any mode. |
| **Map** | Title "Map". It shows you, the goal and checkpoints; landmarks, collected markers and route names are optional filters. Tap a checkpoint to set a marker there. Fixed a duplicated "You are in: Landing Outpost, Landing Outpost". |
| **Tutorial** | Each step is one short line plus the control chips. The mission label is gone; Skip and the progress dots sit in the head. |
| **Notifications** | A priority queue: warnings, then milestones, then items, then info. At most 2 on screen, repeats dropped for 5 s, pick-ups merged ("+2 Metal"), and routine messages dropped first when busy. |
| **Survival** | New players start on **Relaxed**; saved choices are kept. Base status uses plain words (Working / Needs repair / Low power / Off), with the network diagram under "Advanced details". |
| **Mission 04** | Fewer redundant presses: <ul><li>restoring the battery powers the rooms;</li><li>one press installs and starts life support;</li><li>the water repair opens the grow valve;</li><li>planting switches the grow lights on;</li><li>the second probe bark finishes the shelter.</li></ul> The base survey, valve, separate power switches and the trip back to the shelter monitor are gone. |
| **Main menu** | Continue / New Game / Settings, with Tutorial, Controls and Credits under "More ▾". |
| **Settings** | Tabs: Gameplay help, Display, Audio, Controls. "Reset to defaults" asks for confirmation. All accessibility options are kept. |
| **Pause** | Resume, Map, Journal, Base status, Settings, Controls, checkpoint / tutorial items, Save & quit, Restart. |

### Crafting and progression

- **Workbench** (the outpost workstation):
  - large cards and two materials (Metal and Circuits);
  - one BUILD button that says what's wrong: NEED MORE PARTS, NO POWER, ✔ BUILT, or a locked reason;
  - Details is optional;
  - building closes the bench so the player sees the gear appear on Laika.
- **Equipment** (`src/data/equipment.ts`):

| Equipment | Cost | Requires | Effect (permanent, automatic) | Optional use in the world |
| --- | --- | --- | --- | --- |
| Thruster Boots | 2 Metal, 1 Circuit | – | double jump (the existing ability) | high ledges |
| Signal Booster | 2 Metal, 1 Circuit | – | sniff range ×1.6, reveal ×1.35, detects `needs: booster` caches | Nav Beacon (Mission 05); metal cache at the canyon rim |
| Thruster Upgrade | 3 Metal, 2 Circuits | boots | thrust and boost cost ×0.5 | longer climbs on one charge |
| Survey Headlamp | 1 Metal, 2 Circuits | Headlamp | lamp aura, cone and beam ×1.35 | survey cache in the Frozen Depths fissure |
| Reserve Battery | 3 Metal, 1 Circuit | – | suit max 150, reserve floor +15 | mainly useful in Expedition mode (see known issues) |

  - **Magnetic Retriever** is postponed. The brief allowed this.
- **Materials:** 13 Metal and 9 Circuits in the world, exactly Mission 01 plus every upgrade. All 14 new part
  locations are reachable with the starting jump (unit-tested).
- **Blueprints:** the boots are known from the start, the booster arrives in Chapter 5, and the rest after
  Chapter 5.
- **Visible on Laika:** boots, a booster antenna, a bigger pack, lamp pixels on the helmet, and upgraded boot cuffs.
  The sprite sheets are generated per look.
- **Cosmetics** (no gameplay effect; toggled in Journal → Gear):

| Look | Unlocked by |
| --- | --- |
| Survey Stripe | the survey cache |
| Mission Patch | Chapter 4 |
| Blue Trim | every Golden Treat |
| Copper Pack | every rock sample |
| Star Collar | 8 Science Journal entries |

- **Habitat souvenirs** appear by themselves in Laika's room:

| Souvenir | Appears after |
| --- | --- |
| Sample shelf | 3 samples |
| Mission patch poster | Chapter 4 |
| Photo | a Golden Treat |
| Rover model | 2 rover parts |

  The plant pot from Phase 4 is kept.
- **Journal:** tabs for Gear (the equipment collection and looks), Science, Radio (the full text of every message
  heard) and Progress.
- **Mission 05 "Built to Explore"** (Chapter 5), 3–5 minutes:
  1. The gear call arrives.
  2. At the workbench, a new blueprint appears.
  3. Pick up 2 Metal and a Circuit on the lower level.
  4. Build the Signal Booster.
  5. Sniff out the lost Nav Beacon near the canyon entrance.
  6. Link it at the dish.

  There is no completion screen. The objective becomes "Explore. The signal waits north".

## 2. UI simplification: measured, not estimated

`python playtest/phase5.py SNAP=<label>` loads the same nine UI states on any build and measures what a player can
see in the HTML overlay:

- the visible text (characters and words, the game canvas excluded);
- the number of visible HUD widgets.

The canvas and its in-world signs are not counted. "Before" is the Phase 4 build (commit before this branch);
"after" is this branch. Raw data: `docs/screenshots/phase5/measure_before.json` and `measure_after.json` (copies of the `playtest/out/phase5/` output). Screenshots:
`docs/screenshots/phase5/before_*.png` and `after_*.png`.

| State | Chars before → after | Words before → after | HUD widgets before → after |
| --- | --- | --- | --- |
| Title screen (first time) | 145 → 107 | 27 → 21 | 0 → 0 |
| Tutorial, first step | 105 → 48 | 29 → 18 | 3 → 3 |
| Mission 01, looking for parts | 128 → 52 | 25 → 13 | 7 → 4 |
| At the workstation (prompt) | 161 → 75 | 30 → 17 | 8 → 5 |
| Workstation used (unpowered) | 191 → 84 | 34 → 19 | 8 → 5 |
| World map open | 589 → 340 | 105 → 70 | 8 → 5 |
| Just after Mission 01 ends | 410 → 38 | 76 → 11 | 7 → 5 |
| Mission 04, lower level | 168 → 26 | 38 → 9 | 12 → 4 |
| Phone, Mission 01 | 128 → 52 | 25 → 13 | 7 → 4 |
| **Total of the nine states** | **2025 → 822** | **389 → 191** | **60 → 35** |

Over these nine states, that is 59 % fewer characters, 51 % fewer words and 42 % fewer HUD widgets, computed from
the totals above. Other states were not measured.

### Before and after text examples

| Where | Before (Phase 4) | After (Phase 5) |
| --- | --- | --- |
| Mission 01 objective | "Find spare parts (Metal 1/2, Electronics 0/1): sniff east of the outpost." | "Find spare parts: Metal 1/2 · Circuit 0/1" |
| End of Mission 01 | "MISSION 01 COMPLETE" card plus "Mission 02 … Ares Station: check the relay logs at the signal console." | toast "Signal traced!", then the banner "CHAPTER 2 · BENEATH THE RED", then "Ride the lift down" |
| Mission 04 objective | "Lower Level: sniff out the spare pump cartridge in the maintenance bay." | "Dig up the pump" |
| Mission 04 objective | "Frozen Depths: take the spare melt-line coupling from the core drill." | "Get the pipe connector" |
| Mission 04 HUD | Mission title, Details, objective, SCAN / LAMP chips, three item counts, SUIT 70 %, BASE 72 % | "◀ Dig up the pump  F" |
| Prompt | "Ride the survey lift down" | "Lift down" |
| Prompt | "Take the spare melt-line coupling" | "Take pipe connector" |
| Tutorial | "MISSION 00 · FIRST PAWPRINTS", "Let's get moving!", "A / D or ← / → to move." | "Move right." with the chips (A) (D) or (← →) |
| Transmission | four lines of static and a suit line | "...Ares Station... can anyone hear?..." / "The bridge can open now!" |

### Removed or relocated

| Element | Now |
| --- | --- |
| Completion cards (Missions 01, 03, 04) and "Keep exploring" | chapter banner |
| Mission title and step list in the objective box | detailed HUD only |
| Permanent inventory and ability chips | contextual peek; detailed HUD |
| Suit meter and power chip | contextual |
| Mission 00 title cards | gone |
| Map route names and collected markers | filters |
| Long transmission text | Journal → Radio |
| Science unlock pop-ups | a quiet journal badge on the pause button |
| Item blurbs on pick-up | "+1 Metal" |
| Tutorial, Controls and Credits on the title screen | under "More" |

## 3. Navigation architecture

`src/systems/waypoints.ts` (pure) and `GameScene.updateGuidance()`. See ARCHITECTURE.md → "Phase 5". In short:

1. The target is on another map: take the next transit object over **open** connections, preferring the shortest
   trip from Laika's column.
2. The target is on the same map: run a BFS over standing cells with Laika's actual jump, plus the habitat ladder
   as a portal. The waypoint is the ladder if the path uses it; otherwise a point 9 cells along the path, or the
   target when it is close.
3. No path: point at the target.

A locked route gives no marker. The marker is recomputed every 450 ms and hidden when the interaction prompt is
showing. `window.__laika.waypoint()` exposes it for tests.

## 4. Save migration

| Step | Change |
| --- | --- |
| Migration v4 → v5 | Adds `gear: { built: [], blueprints: ["boots"], wear: [] }`. The Thruster Boots stay an ability, so earlier boots are kept. |
| `sanitize` | Keeps only known equipment and cosmetic ids, and caps suit energy at 100 (150 with the Reserve Battery). |
| `repairState` | <ul><li>Implies the earlier Mission 05 flags from later ones.</li><li>Grants the booster blueprint after the briefing, and every blueprint after Mission 05.</li><li>Keeps the Nav Beacon unique.</li><li>Applies the merged Mission 04 steps (battery ⇒ rooms powered; water ⇒ grow valve open; both probes ⇒ shelter restored).</li><li>`uncollected()` no longer counts gear-gated caches or lower-level parts as sources for Mission 01.</li></ul> |

v1–v3 saves chain through v4. Verified by unit tests and in the browser (scenario F loads an unchanged v4 save).

## 5. Test results (2026-11-26)

### Unit tests and build

- `npx tsc --noEmit`: clean.
- `npx vitest run`: **233 / 233 pass**.
  - 36 are new in `tests/phase5.test.ts`.
  - Earlier tests that had to change say why in a comment, and assert the same intent: new verbs and texts; the
    merged Mission 04 steps; the workbench replacing the old "Build Thruster Boots" prompt; the Chapter 2 and
    Chapter 4 briefings no longer pointing at a console; save version 5.
  - No test was removed or loosened to hide a regression.
- `npm run build`: succeeds (Phaser chunk 1.2 MB, as before).

### Phase 5 browser scenarios

`python playtest/phase5.py`, headless Chrome (SwiftShader), real key presses and emulated touch: **90 / 90 checks
pass**. Scenario O was re-run after a final Journal text change (5 / 5).

| Scenario | What it checks |
| --- | --- |
| A | Fresh game: the title menu, the first tutorial card ≤ 12 words, the whole tutorial with real keys, then a short Mission 01 objective. |
| B | Mission 01 ends with no completion card. The "CHAPTER 2 · BENEATH THE RED" banner shows, the Chapter 2 briefing arrives without a console trip, the next objective is Mission 02, and the transmission doesn't block. |
| C | Chapter 2 → 3, 3 → 4 (the call arrives by itself) and 4 → 5, with no cards anywhere. |
| D | Following the marker point by point from the outpost to the nearby survey lift, down to the Frozen Depths, and on to the drill. The pipe connector is collected. |
| E | On the lower level with the target on the surface, the marker sits on the ladder; after climbing it points at the battery. |
| F | An unchanged v4 save loads as v5 with progress and boots kept, and Laika can move. |
| G | The first upgrade is built from the workbench: parts spent once, the bench closes, the card shows BUILT, and a second BUILD does nothing. |
| H | One Metal short: BUILD is disabled and reads NEED MORE PARTS; a forced click builds and spends nothing. |
| I | The Radio Part (a mission item) is untouched by crafting. |
| J | Without the booster the Nav Beacon cache stays hidden; with it the beacon is found, and Laika's texture changes. |
| K | On a phone (844×390, touch), the objective box clears the touch buttons, the workbench opens from the touch action button, BUILD is a large on-screen target and builds with a tap, and the touch controls come back. |
| L | Text scale 1.5 on desktop and phone: the objective box overlaps no button and nothing is pushed off screen. |
| M | Reduced motion (body class, marker doesn't bob), the detailed HUD option, and tabbed settings. |
| N | Mission 05 with real keys: parts downstairs, then build, sniff, dig and link. No card, all blueprints unlocked, and an objective remains. |
| O | After Mission 05: the workbench lists 5 blueprints, Journal Gear and Radio open, habitat souvenirs show, and the survey lift works both ways. |

### Older browser suites

| Suite | Result on this build |
| --- | --- |
| `playtest/phase4.py H` (the full Mission 04 route, no teleports; rewritten for the merged steps) | **18 / 18**. This includes the live Chapter 5 banner after the finale, no completion card, and a new check that both probes were read. One earlier run failed from the start (the bot never reached the base terminal); the immediate re-run passed. Treat this route as slightly flaky. |
| `playtest/phase4.py B C D E F G I J K L M` | **All pass**, after updating checks that described Phase 4 behaviour Phase 5 changed on purpose (see below). In the first run, K made 5 of 6 lift trips and I missed the boosted jump once; both passed on re-run. |
| `playtest/phase2.py`, `playtest/phase3.py`, `playtest/phase4.py A` (the full game from a new save) | Edited for the removed completion cards and new stage names, but **not re-run in full** in this phase. |

The Phase 4 checks that were updated, and why:

- Save version 5 instead of 4.
- The station call arrives by itself.
- The suit meter is contextual and hidden while the suit is full.
- Scenario F sets Adventure, because Relaxed (the new default) charges no energy.
- The base status reads "Working" and its toggle reads "Advanced details".
- The Science Journal opens from Journal → Science.
- After a reload, the LIGHTS OUT test only climbs down if Laika is upstairs.

## 6. Known issues

1. **Magnetic Retriever postponed.** Only four new upgrades plus the boots.
2. **The Reserve Battery's optional use is weak.** On Relaxed and Adventure, suit energy rarely runs low, so the
   bigger battery mostly matters in Expedition.
3. **Three upgrades unlock only after Mission 05.** So their caches (the survey cache in the Depths) are post-story
   content. That is by design (short Chapter 5), but some players may never see them.
4. **Map filters are partial.** Landmarks, collected markers and route names exist; there are no filters for
   science points or equipment caches.
5. **Chapter banner after loading a save.** A save that already begins in a new chapter (for example one made the
   moment Mission 04 ended) shows the region banner on load, not the chapter banner. Live transitions show it.
6. **Briefings wait for passive radio messages.** The next chapter's briefing waits until the current passive radio
   message has played (about 5–7 s). Meanwhile the objective reads "Listen to the radio" (no marker).
7. **The waypoint solver is conservative.** If it finds no path it points straight at the target, which can cross
   terrain. This was not seen in the scripted routes.
8. **The contextual HUD is checked only in the browser.** Its visibility rules (`GameScene.hudContext`) live in the
   scene and have no unit test.
9. **No new audio.** Crafting reuses the existing repair and celebrate cues. Nobody has listened to them in this
   context.

## 7. Unverified functionality

- Anything about how understandable the game is to a new player (see §8).
- Real phones (iOS Safari, Android Chrome), real gamepads and screen readers. The phone tests used emulated touch.
- Audio mix.
- Play times: Mission 05 targets 3–5 minutes. It has only been played by a script that knows the route, and
  that run was not timed.
- `phase2.py`, `phase3.py` and `phase4.py A` end to end on this build (see §5). Some bot routes are timing-sensitive
  (see §5) and occasionally need a re-run.

## 8. Blind human playtest procedure (to do)

**Who.** 3–5 players who have never seen the game, ideally including children aged 9–13 and one adult who rarely
plays games. Use a laptop with a keyboard, and one phone session if possible.

**Setup.**
- Clear saves: `localStorage.clear()`, or use a private window.
- Open the deployed build.
- Say only: *"This is a game about a dog on Mars. Play it however you like. Think out loud if you can. I can't help
  you, but you can stop whenever you want."*
- Do not explain controls, goals or menus.

**Session.** 25–30 minutes. Start at the title screen and play from New Game; this reaches about Chapter 2. For
crafting and Chapter 5, use a second session from a provided save at the end of Chapter 4.

**Observe and write down (timestamps help).**

| # | Question | Record |
| --- | --- | --- |
| 1 | Can they identify the first objective? | seconds until they say or act on it |
| 2 | Do they understand the controls? | which keys they try; when they find jump, sniff and interact |
| 3 | Can they find the correct destination? | do they look at or follow the marker? where do they go wrong? |
| 4 | What do they think happens after Mission 01? | ask: "Is the game over?" Note the answer |
| 5 | Do they know the adventure continues? | do they move on without prompting? |
| 6 | Can they craft an upgrade on their own? | time from opening the workbench to BUILD; any confusion about parts |
| 7 | Are they reading too much text? | do they skip messages? do they say "too much"? |
| 8 | Does the HUD confuse them? | ask them to point at "what you're supposed to do" |
| 9 | Do they know which tasks are optional? | ask about caches, treats, looks |
| 10 | Do they explore voluntarily? | detours taken without a goal |

Also mark every spot where a player hesitates for more than 10 s, or goes the wrong way for more than 20 s: the
place, what was on screen, and what they said.

**Afterwards.** Ask three questions:
1. "What was the game about?"
2. "What was the hardest part?"
3. "Would you keep playing?"

Do not lead. Summarise the patterns in the next phase's brief. Do not record names or faces without consent from
the players (and a parent for children).

## 9. Recommended Phase 6 priorities

1. Run the blind playtests above, then fix what they find **before** adding content.
2. Re-run `phase2.py`, `phase3.py` and `phase4.py A` in full, and test on real phones.
3. Decide on the Magnetic Retriever, and give the Reserve Battery a clearer use outside Expedition.
4. Add science and equipment filters to the map; consider showing the chapter banner after loading a save.
5. Content: the trip north that Chapter 5 sets up, reusing the waypoint, chapter and workbench systems.
6. An audio pass: distinct crafting and chapter cues, then listen on headphones and phone speakers.
