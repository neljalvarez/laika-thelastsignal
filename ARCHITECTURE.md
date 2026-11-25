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
  data/               ALL authored content: items & recipes, world terrain ops + objects + regions, transmissions & tips
  systems/            PURE TypeScript simulation (no Phaser, no DOM) - unit-tested
    state.ts          GameState (what is saved) + derived helpers (isPowered)
    interactions.ts   getInteraction() / performInteraction() -> Effect[]
    mission.ts        objective derived from state; completion stats
    inventory.ts      count / canAfford / spend / collectOnce (no duplication)
    movement.ts       Laika's movement controller (coyote, buffer, variable jump, boots, glide)
    sniff.ts          scanner detection
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
    Player.ts         Arcade body + sprite + animation state machine + particles + carried item
    ObjectsView.ts    sprites for world objects, targeting, power/cable sequence, collect/reveal effects
    SniffFx.ts        pulse ring, pings, direction arrows
  scenes/             BootScene (generate art) -> TitleScene -> GameScene (orchestrator)
  ui/                 UI.ts (HUD, transmissions, menus, settings, touch) + ui.css
tests/                Vitest: world validation, mission, saves, movement, settings/sniff/inventory
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
  migration step (`STATE_VERSION` 2, handled in `migrate`).
- **New transmission / tip:** `data/story.ts`.

## Testing

- `npm test`: 51 unit tests, including a full mission playthrough on the pure rules, save corruption/migration/
  anti-soft-lock cases, frame-rate independence of jumps, and a BFS reachability solver proving the level has no
  dead ends and needs no precise platforming.
- Browser play-tests (Phase 1) were run in headless Chrome with Playwright driving real keyboard and touch input;
  see PHASE_1_HANDOFF.md.
