# LAIKA: THE LAST SIGNAL

**One small dog. One lost signal. An entire planet to explore.**

A 2D pixel-art side-scrolling adventure for the browser. You play as Laika, who wakes up inside her damaged
spacecraft on Mars. Mission Control is silent. Explore, sniff out buried parts, repair an abandoned outpost, restore
the radio, and follow a mysterious signal across Crimson Canyon.

This repository holds **Phase 1: the playable vertical slice**, *Mission 01: A Signal in the Silence*
(about 5 to 10 minutes for a first-time player). It is the standalone successor to the original NASA Space Apps
strategy game [`laikamars-nasa`](https://github.com/neljalvarez/laikamars-nasa), which is left untouched.

> **Fiction notice.** This is an alternate-history story inspired by Laika, the first animal to orbit the Earth
> (Sputnik 2, November 1957). The real Laika did not survive her flight; this game imagines a kinder journey.
> Not affiliated with or endorsed by NASA.

## Play

| | Desktop | Touch (phones / tablets, landscape) | Gamepad |
| --- | --- | --- | --- |
| Move | A / D or ← / → | ◀ ▶ buttons | D-pad / left stick |
| Jump (hold for higher) | Space (also W / ↑) | JUMP | A |
| Interact / Dig / Repair | E (also Enter) | Action button (shows the verb) | X |
| Sniff (suit scanner) | F | SNIFF (appears once unlocked) | Y |
| Sprint | Shift | RUN (toggle) | B / RB / RT |
| Pause | Esc (also P) | II button | Start |

Keys are remappable in **Settings → Controls**. The **?** button shows a hint for the current objective.

## Run it locally

Requires Node 18.18+ (developed on Node 22).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 51 Vitest unit tests (mission, saves, movement, level validation, scanner, settings)
npm run typecheck  # strict TypeScript
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build at http://localhost:4173
```

Add `?debug` to the URL to expose `window.__laika` (state, player position, teleport) for automated play-testing.

## Deploy (Vercel, free Hobby plan)

1. vercel.com → Add New → Project → import `neljalvarez/laika-thelastsignal`.
2. Framework preset: **Vite** (also set in `vercel.json`). Build command `npm run build`, output `dist`.
3. No environment variables, backend, database, accounts or paid APIs. Deploy.

Any static host works: upload the contents of `dist/`. Asset paths are relative (`base: "./"`).

## What's in Phase 1

- Real-time, physics-based Laika: acceleration, variable-height jumps, coyote time, jump buffering, low-gravity arcs,
  sprinting, and Thruster Boots (optional double jump).
- Four connected areas: the spacecraft, the landing outpost, Crimson Canyon (jump pit, survey tunnel, cavern, mesa,
  rover wreck, secret room) and the Ares Research Station across a chasm.
- The signature **Sniff** scanner: a pulse that pings hidden things, arrows that point the way, and dig spots that
  only reveal themselves when Laika gets close.
- Engineering you can see: repair the solar array, sweep dust off the panels with Laika's tail, and watch power run
  down the cables, light the lamps, wake the habitat and the receiver.
- Story told through short subtitled transmissions, logs and signs, ending on a mystery.
- Accessibility: remappable keys, touch controls, gamepad, text size, reduced motion, transmission text speed,
  optional hints, "Easy jumps" assist, no timers or fail states, generous checkpoints, pause at any time.
- Versioned local saves (separate from the original game), New Game / Continue / Restart / Return to checkpoint.

## Documentation

- [GAME_DESIGN.md](GAME_DESIGN.md): mechanics, mission flow, level layout, creative direction.
- [ARCHITECTURE.md](ARCHITECTURE.md): technical design and how to extend it.
- [ROADMAP.md](ROADMAP.md): future phases.
- [ASSET_CREDITS.md](ASSET_CREDITS.md): where every asset and fact comes from.
- [PHASE_1_HANDOFF.md](PHASE_1_HANDOFF.md): status, test results, known issues and how to continue.

## Credits

Built by the LAIKA team (repository owner `neljalvarez`) with Claude (Anthropic). Music from the original LAIKA
project. See [ASSET_CREDITS.md](ASSET_CREDITS.md).
