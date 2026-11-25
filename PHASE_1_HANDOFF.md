# Phase 1 handoff — LAIKA: THE LAST SIGNAL

Status as of 2026-11-25: **Phase 1 vertical slice complete and playable end to end.** This file is written for the
next development prompt or developer. Read ARCHITECTURE.md first for the module map.

## Acceptance criteria

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Laika is directly controllable | Done | Keyboard, touch, gamepad (gamepad untested on hardware) |
| 2 | Interconnected pixel-art environment | Done | One 240×34-tile map, 4 areas, tunnel + cavern + secret room |
| 3 | Walking and jumping feel polished | Done | Accel/decel, variable jump, coyote, buffer; `tests/movement.test.ts` |
| 4 | Sniffing and digging work | Done | Browser play-through digs 5 buried items |
| 5 | Resources discovered and collected | Done | No duplication (`collectOnce`), tested |
| 6 | Solar equipment can be repaired | Done | |
| 7 | Restoring power visibly changes the world | Done | Cable, lamps, battery, habitat, workstation, receiver |
| 8 | Communications restored | Done | Transmission with subtitles |
| 9 | New exploration route | Done | Bridge extends across the chasm |
| 10 | Research station reachable | Done | |
| 11 | Playable beginning to end | Done | Automated keyboard play-through, fresh save, ~2.5 min at bot speed |
| 12 | Visual style consistent with LAIKA | Done | Laika redrawn from the original palette/design |
| 13 | Desktop and mobile | Done | Mobile verified in an emulated 844×390 touch viewport |
| 14 | Builds successfully | Done | `npm run build` |
| 15 | Original NASA version preserved | Done | `laikamars-nasa` was only cloned read-only; nothing committed there; separate storage keys |
| 16 | Extensible architecture | Done | Data-driven world/items/story, pure systems, effects |

## Test results (2026-11-25)

- `npm run typecheck`: passes (strict).
- `npm test`: **51 / 51 passing** across 5 files:
  - `world.test.ts` (11): level builds; ship sealed until the hatch opens; station unreachable before the bridge;
    every object reachable (high ledge only with boots); **no dead ends** anywhere; main mission needs at most
    2-tile climbs / 3-tile gaps; enough parts for every recipe; one comms module.
  - `mission.test.ts` (10): full playthrough on the rules with every stage in order; any-order repairs; no
    duplicate pickups; no dig before scanner/reveal; no spending without parts; radio gates bridge and door; boots.
  - `save.test.ts` (10): namespace separate from the original; round trip; corrupt JSON backed up; unknown version
    rejected; junk sanitized; lost comms module restored; parts topped up; milestones imply earlier ones; no storage.
  - `movement.test.ts` (11): accel/stop; sprint; tap vs hold jump; **same jump height at 30/60/144 fps**; coyote;
    buffer; boots; terminal velocity and assist glide; locked input; huge frame clamp.
  - `settings-sniff.test.ts` (9): settings parsing, reduced-motion default, rebind swap, key labels, inventory,
    scanner range/reveal/collected/hidden-only.
- `npm run build`: passes. Output: app 127 kB (43 kB gzip), Phaser chunk 1.2 MB (332 kB gzip), CSS 20 kB, fonts,
  4 MP3s (15 MB total, streamed, not preloaded).
- **Browser play-tests** (headless Google Chrome + Playwright, SwiftShader WebGL, real keyboard/pointer events):
  - `playtest/playthrough.py`: New Game → radio → hatch → receiver → crate jump → sniff + dig → solar repair →
    sweep 3 panels → canyon (fell into the pit, took the survey tunnel) → 3 more digs → rover log → comms module →
    back west over the mesa and across the pit stepping stones → install → tune → Thruster Boots → bridge → door →
    console → completion card. **0 page errors.**
  - Optional content run: Continue from an injected save → secret room + Golden Treat → mesa ledges + basalt →
    Thruster Boots double jump → hematite ledge → pause → settings (text size XL) → resume → reload → Continue:
    inventory, checkpoint and collected items identical. Only `laika-the-last-signal/*` keys in localStorage.
  - Menus: Return to checkpoint, Restart demo (confirm), Save & quit, New Game overwrite confirm/cancel, Credits.
  - Mobile: 844×390 touch viewport: touch controls appear, ◀ ▶ move, JUMP clears the crate, action button shows
    the contextual verb, dialogue stays clear of the thumb zones.
  - Audio: AudioContext created only after the first gesture and confirmed running; no errors.
  - Screenshots of every section were reviewed during development (they are regenerated into `playtest/out/`).

## Known limitations (honest list)

- **Audio was verified technically, not by listening.** Volumes/mix may need ears-on tuning.
- **Gamepad** support uses the standard mapping and is untested on real hardware.
- **Touch** was tested with emulated pointer events, not on a physical phone; real-device performance not measured.
- **Music rights:** the four tracks come from the original repo; two are marked there as "team should confirm".
- Art is generated in code. It is cohesive, but an artist pass would add detail (canyon rock variety, animated
  machines). Large flat rock areas read a little "brick-like".
- Key remapping covers the primary key per action; arrow keys / W / Enter / P stay as fixed alternates; no
  gamepad remapping.
- The canvas itself is not described to screen readers (HUD, prompts and transmissions are live regions).
- With Thruster Boots a skilled player can jump the chasm early; the station door stays sealed until the radio is
  online, so the mission order holds.
- One continuous map; region streaming is not needed yet.
- `?debug` exposes read helpers and a teleport for testing; harmless, but strip it if you prefer.

## Files

All files are new (the repository was empty).

```
index.html  package.json  package-lock.json  tsconfig.json  vite.config.ts  vercel.json  .gitignore
README.md  GAME_DESIGN.md  ARCHITECTURE.md  ROADMAP.md  ASSET_CREDITS.md  PHASE_1_HANDOFF.md
public/favicon.svg
public/audio/{against-the-crimson-sky, below-the-red-horizon, last-light-on-the-ridge, across-the-crimson-sands}.mp3
src/main.ts  src/app.ts
src/config/constants.ts
src/data/{items, world, story}.ts
src/systems/{state, inventory, interactions, mission, movement, sniff, worldBuilder, navigation, save, settings}.ts
src/art/{painter, palette, laika, tiles, props, icons, backgrounds, font, registerTextures}.ts
src/audio/AudioManager.ts
src/input/InputManager.ts
src/game/{WorldView, Player, ObjectsView, SniffFx}.ts
src/scenes/{BootScene, TitleScene, GameScene}.ts
src/ui/{UI.ts, ui.css}
tests/{world, mission, save, movement, settings-sniff}.test.ts
playtest/playthrough.py
```

No files were modified in `neljalvarez/laikamars-nasa`.

## How to continue

1. `npm install && npm run dev`, then read `src/scenes/GameScene.ts` (orchestration) and `src/data/world.ts`.
2. Run `npm test` after any level edit: the reachability tests will tell you if you created a dead end.
3. For new content follow "Extending the game" in ARCHITECTURE.md.
4. Bump `STATE_VERSION` and add a `migrate` step whenever `GameState` changes shape.

## Recommended Phase 2 priorities

1. Real-device test on a phone, a tablet and a gamepad; tune touch button sizes and positions.
2. Listen-through audio pass: balance music vs. SFX, soften repeated cues (steps, pings).
3. Kid playtest (2–3 players): watch for confusion at the first dig and at the pit; tune hint timing.
4. Art pass: canyon rock variety, animated dish/panels/beacon, footprints, more storytelling props.
5. Short landing cutscene and a richer ending vignette.
6. Add a second region and one new ability gate (see ROADMAP.md), reusing the effects pipeline.
7. Optional science log screen collecting tips, samples and their sources.
