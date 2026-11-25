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
  systems/            PURE TypeScript simulation (no Phaser, no DOM) - unit-tested
    state.ts          GameState (what is saved) + derived helpers (isPowered)
    interactions.ts   getInteraction() / performInteraction() -> Effect[]; barkEffects()
    mission.ts        objective derived from state (one action line + steps + optional goals); completion stats
    tutorial.ts       Mission 00 state machine over facts (moved, revealed, repaired...); isolated practice items
    hints.ts          adaptive hint levels driven by lack of progress; jump-struggle detection
    animState.ts      locomotion animation choice + idle personality state machine
    inventory.ts      count / canAfford / spend / collectOnce (no duplication)
    movement.ts       Laika's movement controller (coyote, buffer, variable jump, boots, glide)
    sniff.ts          scanner detection, signal level (none/weak/strong/located), warmer/colder trend
    worldBuilder.ts   terrain ops -> tile grids
    navigation.ts     tile-level reachability solver (level validation)
    save.ts           versioned save, sanitize, migrate, repairState (anti soft-lock)
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
  scenes/             BootScene (generate art) -> TitleScene -> GameScene (orchestrator)
  ui/                 UI.ts (HUD, objective panel, signal meter, captions, transmissions, menus, controls,
                      settings, touch) + TutorialUI.ts (stage card, assist offer, mission title cards) + ui.css
tests/                Vitest: world validation, mission, saves, movement, settings/sniff/inventory, tutorial, phase2
playtest/             Python + Playwright browser play-tests (playthrough.py = Phase 1 route, phase2.py = A-H)
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
  migration step (bump `STATE_VERSION`, now 2, and add a case in `migrate`).
- **New tutorial stage:** add an id to `TutorialStageId` and `STAGE_ORDER`, a `TutorialStageDef` in
  `data/tutorial.ts` (instructions for each device, `done(facts)`, hint), any new fact + event in
  `systems/tutorial.ts`, and a test in `tests/tutorial.test.ts`.
- **New transmission / tip:** `data/story.ts`.

## Testing

- `npm test`: 93 unit tests, including a full mission playthrough on the pure rules, save corruption/migration/
  anti-soft-lock cases, frame-rate independence of jump height and distance (30/60/144 fps), a BFS reachability
  solver proving the level has no dead ends and needs no precise platforming (and that the training bay is sealed
  from the campaign), the tutorial state machine (order, real events, duplicates, replay isolation, save/reload,
  device prompts), hints, animation states and gait phases.
- Browser play-tests run in headless Chrome with Playwright driving real keyboard and touch input:
  `playtest/playthrough.py` (Phase 1 route) and `playtest/phase2.py` (Phase 2 scenarios A–H). See the handoffs.
