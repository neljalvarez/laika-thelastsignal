# Phase 2 handoff — LAIKA: THE LAST SIGNAL

**Phase 02/11: Movement, Character Polish & Player Onboarding.** Status as of 2026-11-25: implemented on branch
`feature/phase-02-character-polish`, with all automated checks passing. This file is for the next development prompt
or developer. Read `ARCHITECTURE.md` for the module map and `GAME_DESIGN.md` for the player-facing rules.

Phase 2 has **not** been played by a person yet, and its audio has not been listened to. Everything below marked
"verified" was verified by unit tests or by scripted play in headless Chrome. See
[Unverified](#unverified-features) and [Human playtesting needed](#human-playtesting-needed).

## Features

| Area | What was built | Where |
| --- | --- | --- |
| **Mission 00 "First Pawprints"** | Sleep → beep → yawn/stretch → wag wake-up (any input skips), then 7 one-verb stages: move (real distance), jump the crate (landing marker, "hold longer" tip, Easy Jumps offer after 3 fails), console, sniff, dig, repair (fan spins, lights on), drop through the floor hatch. Then MISSION 00 COMPLETE → MISSION 01 / A SIGNAL IN THE SILENCE cards. Skip (with confirm), restart, replay from the title or Pause, resume mid-tutorial after reload. Prompts adapt to keyboard / touch / gamepad and to remapped keys. | `data/tutorial.ts`, `systems/tutorial.ts`, `ui/TutorialUI.ts`, `scenes/GameScene.ts` |
| **Training bay** | The ship is now two decks. The upper deck is the training bay (crate, practice console, soil tray, broken fan, floor hatch); the lower deck is the Phase 1 interior, unchanged, where Mission 01 begins. | `data/world.ts`, `art/props.ts`, `game/WorldView.ts` |
| **Movement** | Crisper accel/decel/turn, separate air turn, apex hang, heavier fall, corner correction (5 px), ledge assist (7 px), turn skid event. Jump height unchanged. | `config/constants.ts`, `systems/movement.ts`, `game/Player.ts` |
| **Animation** | Laika rebuilt from parts with gait tables (walk / trot / gallop; each back leg trails the opposite front leg, equal stride), jump start / rise / apex / fall / land / air jump, turn, sniff, dig rear-up, two-step repair, sweep, bark, celebrate, sit / lie / sleep, blink, ear twitch, wag, look-back, alert, head tilt, worried. | `art/laika.ts`, `systems/animState.ts` |
| **Personality** | Idle state machine: micro-behaviours, sit after 9 s, lie down at 22 s, sleep at 38 s; perks up near unrevealed treasure; tilts her head at new machines; wags after finds. | `systems/animState.ts`, `game/Player.ts` |
| **Sniff / dig / sweep / repair** | Scanner tracking for 6 s after a sniff: signal meter (weak / strong / located) plus warmer/colder, ring rhythm by distance, 1–2 chevrons, sparkle column. Dig, repair and sweep face the object (sweeping turns the tail toward the panel); dust fades off the panel. | `systems/sniff.ts`, `game/SniffFx.ts`, `game/ObjectsView.ts` |
| **Bark** | Optional action (B / BARK button / LB) with a sound-wave sprite and a "Woof!" caption. At the outpost's echo sensor it shows a read card (sound is quieter and slower on Mars, sourced). The rover wreck beeps back. | `systems/interactions.ts` (`barkEffects`), `scenes/GameScene.ts` |
| **Environmental guidance** | "JUMP OR TUNNEL" sign at the pit, "EXIT →" in the tunnel, tunnel lamps, a glow at the exit shaft, rover tracks from the shaft to the wreck, footprints, a one-way step in the pit's west gap. | `game/WorldView.ts`, `data/world.ts` |
| **Objectives** | One actionable line with its key, a "▾ Details" panel with steps, and a separate Optional section. "Restore the radio" recommends a single next step. | `systems/mission.ts`, `ui/UI.ts` |
| **Adaptive hints** | 3 levels from lack of *progress* while actively playing (35 / 60 / 90 s): target glow → hint line → edge arrow. Paused during transmissions, cutscenes and optional areas; reset on progress; can be disabled; manual **?** button. Jump-struggle detection (4 jumps within 56 px within 25 s). | `systems/hints.ts`, `scenes/GameScene.ts` |
| **Camera** | Look-ahead after 150 ms moving one way, vertical platform snapping, tighter framing underground, bias toward the current target, focus pans that are skipped with reduced motion. | `game/CameraController.ts` |
| **Game feel and audio** | Landing dust scaled to fall speed, skid dust, footprints, repair bursts, stage-complete chime; new synthesized cues (skid, stageDone, beepTune, roverBeep, yawn, track) and a quieter sweep. | `game/*`, `audio/AudioManager.ts` |
| **Accessibility** | Sound captions (default on), in-game Controls reference in Pause, device-aware prompts, Easy Jumps offered in context. | `ui/UI.ts`, `systems/settings.ts` |
| **Mobile** | Safe-area insets, no pinch / double-tap zoom or page scroll, sliding D-pad, BARK button, every touch control released on pause / blur / tab change / device change. | `main.ts`, `ui/UI.ts`, `ui/ui.css`, `input/InputManager.ts` |
| **Saves** | Format v2 with v1 → v2 migration (see below). | `systems/state.ts`, `systems/save.ts` |

## Changed files

Relative to `main` (Phase 1). New files are marked **(new)**.

- **Data:** `src/data/tutorial.ts` (new), `src/data/world.ts`, `src/data/story.ts`, `src/config/constants.ts`
- **Pure systems:** `src/systems/tutorial.ts` (new), `src/systems/hints.ts` (new), `src/systems/animState.ts` (new),
  `src/systems/movement.ts`, `src/systems/mission.ts`, `src/systems/interactions.ts`, `src/systems/sniff.ts`,
  `src/systems/state.ts`, `src/systems/save.ts`, `src/systems/settings.ts`
- **Phaser side:** `src/game/CameraController.ts` (new), `src/game/Player.ts`, `src/game/ObjectsView.ts`,
  `src/game/SniffFx.ts`, `src/game/WorldView.ts`, `src/scenes/GameScene.ts` (rewritten), `src/scenes/TitleScene.ts`
- **Art and audio:** `src/art/laika.ts` (rewritten), `src/art/props.ts`, `src/art/tiles.ts`, `src/audio/AudioManager.ts`
- **Input and UI:** `src/input/InputManager.ts`, `src/ui/TutorialUI.ts` (new), `src/ui/UI.ts`, `src/ui/ui.css`,
  `src/main.ts`
- **Tests:** `tests/tutorial.test.ts` (new), `tests/phase2.test.ts` (new), `tests/movement.test.ts` (2 tests added),
  `tests/world.test.ts` (tests scoped to campaign objects; 2 tests added)
- **Play-tests:** `playtest/phase2.py` (new), `playtest/playthrough.py` (skips Mission 00, uses the pit step)
- **Docs:** README, GAME_DESIGN, ARCHITECTURE, ROADMAP, ASSET_CREDITS, this file,
  `docs/screenshots/phase2/` (27 play-test screenshots)

No existing test was deleted or weakened. `world.test.ts` previously asserted that *every* object is reachable from
the campaign spawn. Mission 00's practice objects are deliberately unreachable from there, so those assertions now
run over campaign objects (`OBJECTS` minus `PRACTICE_IDS`), and a dedicated test covers the training bay.

## Movement tuning changes and reasoning

| Value | Phase 1 | Phase 2 | Why |
| --- | --- | --- | --- |
| walk / sprint | 96 / 150 | 100 / 156 px/s | Slightly brisker so walking does not feel sluggish next to the faster animations. |
| ground accel / decel / turn | 1000 / 1300 / 1900 | 1500 / 1900 / 2600 px/s² | Laika reached speed and stopped a beat late; she now stops in under 3 px from a walk (was 3.5) and turns faster than she stops, which reads as responsive. |
| air accel / decel | 760 / 420 | 950 / 520 px/s² | More mid-air control for aiming at small platforms. |
| air turn | (= air accel) | 1500 px/s² | Reversing in the air was the most "floaty-sluggish" part of Phase 1. |
| fall gravity | × 1.35 | × 1.5 | A weightier fall gives clearer landings and less hang after the apex. |
| max fall | 380 | 400 px/s | Matches the heavier fall. |
| apex hang | none | gravity × 0.55 while Jump held and \|vy\| < 45 | A short float at the top makes jumps easier to aim. |
| jump velocity | 268 | 268 (unchanged) | Keeps jump height ≈ 3.5 tiles so every Phase 1 jump and the level validation still hold. |
| coyote / buffer | 110 / 140 ms | unchanged | Already forgiving. |
| corner correction / ledge assist | none | 5 px / 7 px | Clipping a ceiling corner or just missing a ledge lip no longer stops Laika dead. |

**A side effect found in play-testing.** The apex hang lengthens a *fully held* jump: 154 px instead of 128 px for a
sprint jump (+20 %), 101 instead of 84 px walking. Short and medium hops barely change. In browser play this made a
fully held sprint jump from the pit's east lip sail over both 2-tile stepping stones and drop into the last gap.
Heading east that costs nothing (the pit drains into the tunnel), but heading west it meant a long loop back through
the tunnel. The apex hang was kept, and the level was fixed instead: a one-way step in the west gap (cols 113–114,
row 30) lets a short jump climb straight out (1 tile, then 2 tiles). A new world test proves the climb-out works
without the tunnel, and fails if the step is removed. **Human testers should watch for the same overshoot on other
small platforms.**

Verification: the jump-height test and two new tests (horizontal distance, walk and sprint) show the same results at
30, 60 and 144 fps in the pure simulation. In the browser, jump height measured 55.1 px at both 60 fps and a forced
30 fps. 144 fps was not tested in a browser (no high-refresh display in the test environment).

## Tutorial architecture

See `ARCHITECTURE.md` → *Mission 00 (tutorial) architecture* for the diagram. In short:

- `data/tutorial.ts` declares stages. Each has an instruction per device, a `done(facts)` condition, a target object,
  a hint, a fallback and a respawn column.
- `systems/tutorial.ts` is a pure state machine. Events (`woke`, `moved{dx,x}`, `jumpFailed`, `revealed`, `exited`)
  and practice interactions record **facts**; `advance` walks forward through every stage whose `done` is true.
  Out-of-order events are recorded but cannot skip a stage's own requirement, and duplicates are idempotent.
- Practice objects never touch `GameState`. Mission 00 writes only `tutorial.{status,stage}` and, on first
  completion, `abilities.sniff`.
- Replay builds a fresh practice state, remembers where Laika was, and returns her there at the end. Tests and
  scenario D confirm the campaign state is byte-for-byte unchanged apart from play time.
- To add a stage, see `ARCHITECTURE.md` → *Extending the game*.

## Save migration (v1 → v2)

- `STATE_VERSION` is now **2**. New fields: `abilities.bark` and `tutorial: { status: "active" | "done" | "skipped", stage }`.
- `migrate`: a v1 save gets `abilities.bark = true` and `tutorial = { status: "skipped", stage: "done" }`, so
  Phase 1 players keep everything and are **never forced into the tutorial**. They can still replay it from Pause.
- `sanitize`: an invalid tutorial block becomes `skipped`; an invalid stage under `active` becomes `done`.
- `repairState`: an `active` tutorial on a save whose hatch is open or radio was checked is closed (`done`).
- A new game starts at `{ status: "active", stage: "wake" }`.
- Verified by unit tests (`phase2.test.ts`, `save.test.ts`) and in the browser by scenario C (a hand-built v1 save
  loads as v2 with inventory, flags, abilities and checkpoint intact).

## Test results (2026-11-25)

**Static and unit:** `npm run typecheck` passes (strict); `npm run build` passes; `npm test` passes **93 / 93**
across 7 files:

| File | Tests | Covers |
| --- | --- | --- |
| `tutorial.test.ts` | 14 | stage order; completes only on real events; invalid attempts; out-of-order events; no duplicate completion; replay isolation; restart; save/reload mid-tutorial; skip grants nothing; device- and binding-aware prompts |
| `phase2.test.ts` | 24 | v1 → v2 migration; corrupt tutorial recovery; hint levels, reset, disable, manual hint; struggle detection; objective line and optional goals; signal levels and trend; Bark effects; animation transitions, idle personality, frame validity, gait phases; movement tuning; settings (bark binding, captions) |
| `movement.test.ts` | 13 | Phase 1 movement tests plus horizontal jump distance at 30 / 60 / 144 fps and the 4-tile easy-jump rule |
| `world.test.ts` | 13 | Phase 1 reachability rules, training bay sealed from the campaign, pit west step |
| `mission.test.ts`, `save.test.ts`, `settings-sniff.test.ts` | 10 / 10 / 9 | unchanged Phase 1 suites (still passing) |

**Browser play-tests:** `python playtest/phase2.py` runs headless Chrome (SwiftShader) with real keyboard and pointer
input. It only *reads* state through `?debug`, and injects saves only for C, D and H. Final run on the final build:
**49 / 49 checks passed**, with no page errors in any scenario. Screenshots are in `docs/screenshots/phase2/`.

| Scenario | Checks | Result |
| --- | --- | --- |
| **A** New player: tutorial → Mission 01 → completion | 7 | Pass. Tutorial in 17 s at bot speed; no practice items leaked; Mission 01 completed. |
| **B** Skip tutorial → Mission 01 | 5 | Pass. Records "skipped", grants nothing, lands on the lower deck, receiver still unlocks the scanner. |
| **C** Load a Phase 1 (v1) save and continue | 6 | Pass. |
| **D** Replay Mission 00 from the campaign | 4 | Pass. Campaign state unchanged; Laika returned to the same spot. |
| **E** Mobile touch (844×390 emulated, touch only) | 7 | Pass. Tutorial completed by touch; radio, hatch and receiver done by touch; BARK button works; nothing stuck after pausing mid-press. |
| **F** Accessibility (150 % text, reduced motion, captions, Easy Jumps) | 4 | Pass. |
| **G** Input reliability (rapid / simultaneous input, pause spam, blur, hidden tab, reload mid-tutorial, 30 vs 60 fps) | 8 | Pass. |
| **H** Exploration (echo sensor bark, secret room, tunnel, shaft, mesa ledges, boots ledge, rim sample, bridge gate) | 8 | Pass. |

The Phase 1 route bot (`playtest/playthrough.py`) also still completes the demo (152 s at bot speed, no errors).

**Bugs found by these play-tests and fixed:**

- The tutorial card sat above the Pause / confirm dimmer, so its Skip button stayed clickable over menus. Moved
  beneath the screen host.
- The "Open hatch" prompt showed during the MISSION 00 COMPLETE title cards. Prompts and movement now pause while
  the cards are up (about 3 s).
- Touch players had no way to bark freely. Added a BARK button.
- The open floor hatch showed the sky through the hull. Back wall added.
- The westward pit overshoot described above (scenario A failed in 4 of 8 runs before the fix). Fixed with the west
  step; the next 2 runs of A and the Phase 1 route passed, one of them after a short jump into the pit, climbing out
  by the step.
- A `__pycache__` file was committed by mistake in the first Phase 2 commit. Removed and ignored.

## Known bugs and limitations

- **Bot-only precision.** The play-test bots jump from fixed positions with fixed timings, and headless SwiftShader
  frame pacing varies, so bot jumps land in slightly different places from run to run. The bots now recover (via
  the pit step or the tunnel) and log it. This is not a game bug, but it makes scenario A slower on some runs.
- **Fully held jumps go ~20 % further than in Phase 1** (see tuning). Validated for the pit; other small platforms
  (mesa ledges, chasm ladder) passed scenario H but have not been reviewed with this in mind by a person.
- **Title cards lock movement for about 3 s** after Mission 00 and after a skip. This is intentional, but could
  annoy a replaying player.
- The **SNIFF touch button is visible for the whole tutorial**, including stages before Sniff is taught.
- On touch, the Action button reads "E" when nothing is targeted (carried over from Phase 1).
- The Phase 1 commit on `main` is authored by the previous tool identity; see the note in the delivery message.
  Phase 2 commits are authored by `neljalvarez`.

## Unverified features

Be honest about these when reporting progress:

- **Audio has not been listened to.** All new cues (skid, stage complete, console beep, rover beep, yawn, tracking)
  and the quieter sweep were checked programmatically only: they fire at the right moments on the right bus, with
  no errors. Whether they sound good, are balanced, or are annoying on repeat is unknown.
- **Gamepad** (including LB for bark) has never been tested with a physical controller.
- **Touch** was tested with emulated touch events in an 844×390 viewport, not on real phones. Safe-area insets,
  iOS Safari zoom behaviour and real thumb ergonomics are unverified.
- **144 fps** was verified only in the pure simulation, not in a browser.
- **Screen readers:** menus and cards are HTML (with `aria-live` on tutorial and mission cards), but the game canvas
  itself is not described. Not tested with a screen reader.
- **Animation readability at 1× scale on a real screen** was judged from screenshots only.
- **Hint timings (35 / 60 / 90 s)** and **tutorial length** are guesses until people play it.

## Human playtesting needed

1. **First-time players, especially children (the target audience).** Do they read the tutorial card? Is any stage
   confusing (the console, sniff, the floor hatch)? How long does Mission 00 take? The brief targets 60–120 s; the
   bot takes 17 s.
2. **The crate jump.** Do the landing marker, the "hold Jump longer" tip and the Easy Jumps offer appear at the right
   moment, and feel kind rather than patronising?
3. **The pit and tunnel.** Do the signs work? Do players overshoot the stones with full jumps, and do they find the
   west step when they fall short?
4. **Hints.** Do they arrive when someone is stuck, and stay away when someone is just exploring?
5. **Feel.** Is the new movement better than Phase 1? Is the apex hang noticeable? Does the idle personality charm
   or distract?
6. **Audio listening pass** on headphones and phone speakers.
7. **Real phones and a real gamepad.**

## Phase 3 priorities

1. Run the human playtests above and tune from what people actually do (hint times, tutorial wording, jump feel).
2. An audio listening and mixing pass.
3. Real-device touch and gamepad testing; fix whatever turns up.
4. Small follow-ups from this phase: hide SNIFF on touch until its tutorial stage; consider a shorter title-card
   lock on replay; review small platforms for apex-hang overshoot; a touch label for the Action button when idle.
5. Then the Phase 3 brief's own scope (see `ROADMAP.md` for candidate directions).

## How to run everything

```bash
npm install
npm run typecheck && npm test && npm run build
npm run preview                                   # http://localhost:4173
pip install playwright && python -m playwright install chromium   # or set CHROME=/path/to/chrome
python playtest/phase2.py                         # all scenarios; or e.g. `python playtest/phase2.py A E`
python playtest/playthrough.py                    # Phase 1 route
```

Screenshots go to `playtest/out/` (git-ignored); a curated set is committed in `docs/screenshots/phase2/`.
