# LAIKA: THE LAST SIGNAL

**One small dog. One lost signal. An entire planet to explore.**

A 2D pixel-art side-scrolling adventure for the browser. You play as Laika, who wakes up inside her damaged
spacecraft on Mars. Mission Control is silent. Explore, sniff out buried parts, repair an abandoned outpost, restore
the radio, and follow a mysterious signal across Crimson Canyon, down into frozen caves and up to a ridge-top relay
tower.

What you can play today: **Mission 00: First Pawprints** (a 1–2 minute guided tutorial in the spacecraft),
**Mission 01: A Signal in the Silence** (Landing Outpost → Crimson Canyon → Ares Station), and, new in Phase 3,
**Mission 02: Beneath the Red** (the Frozen Depths) and **Mission 03: Echoes Above** (Echo Ridge), across five
connected regions. It is the standalone successor to the original NASA Space Apps strategy game
[`laikamars-nasa`](https://github.com/neljalvarez/laikamars-nasa), which is left untouched.

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
| Bark (optional) | B | BARK | LB |
| Sprint | Shift | RUN (toggle) | B / RB / RT |
| World map | M (also Tab) | ▦ button | Back / Select |
| Pause | Esc (also P) | II button | Start |

The **Headlamp** (found in the Frozen Depths) needs no button: once fixed, it shines wherever Laika faces.

Keys are remappable in **Settings → Controls**, and every on-screen prompt shows the key you actually bound (or the
touch / gamepad button you last used). The **?** button gives a hint for the current objective; **Pause → Controls**
shows this table in game. New players start in Mission 00, which can be skipped and replayed any time from Pause.

## Run it locally

Requires Node 18.18+ (developed on Node 22).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 141 Vitest unit tests (regions, Missions 00-03, puzzles, saves + migration, movement,
                   #   level reachability on every map, scanner, hints, animation states, settings)
npm run typecheck  # strict TypeScript
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build at http://localhost:4173
```

Add `?debug` to the URL to expose `window.__laika` (state, player position, tutorial stage, hint level, scanner
tracking, current map) for automated play-testing. Browser play-tests live in `playtest/` (Python + Playwright):
`playthrough.py` is the Phase 1 route, `phase2.py` runs Phase 2 scenarios A–H, `phase3.py` runs Phase 3
scenarios A–K.

## Deploy (Vercel, free Hobby plan)

1. vercel.com → Add New → Project → import `neljalvarez/laika-thelastsignal`.
2. Framework preset: **Vite** (also set in `vercel.json`). Build command `npm run build`, output `dist`.
3. No environment variables, backend, database, accounts or paid APIs. Deploy.

Any static host works: upload the contents of `dist/`. Asset paths are relative (`base: "./"`).

## What's in the game

### Phase 3: world expansion

- **Five connected regions on three maps.** Landing Outpost, Crimson Canyon and Ares Station on the surface; the
  underground **Frozen Depths** (dark blue caves, water ice, an abandoned survey facility); and **Echo Ridge**, a
  tall, wind-scoured ridge whose relay tower is visible from the first screen. Lifts, a hatch and a cable car
  connect them, and only the map Laika is in is loaded.
- **Missions 02 and 03.** The station's logs reveal the signal was relayed. Recover a relay cell from the depths,
  wake the ridge's relay network, climb the tower and trace the signal. It answers with a new question, not an
  ending.
- **The Headlamp.** A new permanent ability: a beam that lights the caves, makes reflective survey markers shine,
  catches glints on equipment and triggers light sensors. A "Brighter caves" setting keeps everything readable
  without it.
- **Six environmental puzzles.** Follow the shining markers; restore a research circuit; run the core drill;
  sweep and turn three relay dishes to match their plaques; follow a relay's faint signal with the scanner; bark at
  an acoustic sensor (it "hears" through Laika's suit radio).
- **A world map** styled as a survey journal: regions revealed as you explore, checkpoints, landmarks, the current
  mission destination, "?" for unexplored connections and green shortcuts. Secrets stay off it.
- **Shortcuts.** A survey lift from the depths to the outpost and a cable car from the tower to the station.
- **Nine optional discoveries** across the new regions (samples, recordings, rover R-2's lost parts, two Golden
  Treats), placed to reward the Headlamp, Sniff, Bark, Thruster Boots and curiosity.
- Hints that name the region first and point to the right lift or gate when the goal is on another map, region
  title cards, per-region ambience, and save format v3 that migrates Phase 1 and Phase 2 saves straight into
  Mission 02.

### Phase 2: movement, character polish and onboarding

- **Mission 00: First Pawprints.** Laika wakes on the upper deck and learns one thing at a time: walk, hop the crate,
  use a console, sniff, dig up a part, repair a fan, drop through the hatch. Each stage advances on what you actually
  do, prompts adapt to keyboard / touch / gamepad and to remapped keys, and it can be skipped, restarted or replayed
  without touching your campaign.
- **A livelier Laika.** New animation set built from leg phases (walk, trot, gallop), take-off, rise, apex, fall and
  landing poses, turn skids, digging with her rear up, a two-step repair, tail sweeping, barking, and an idle life:
  blinks, ear twitches, wagging, sitting, lying down and eventually falling asleep.
- **Crisper movement.** Faster stops and turns, an apex hang when you hold Jump, a slightly heavier fall, corner
  correction and ledge assist. Jump height is unchanged, so every Phase 1 jump still works.
- **Better guidance.** One clear objective line with an expandable details panel and separate optional goals,
  adaptive hints that only appear when you are stuck (and can be turned off), signs and lamps around the pit and
  tunnel, rover tracks, a smarter camera, and a scanner that now tracks: weak / strong / located, warmer or colder.
- **Bark.** An optional action with a visible sound wave and caption. Try it at the outpost's echo sensor.
- Sound captions, safer mobile layout (safe areas, no zoom or scroll, no stuck buttons), save format v2 with
  automatic migration of Phase 1 saves.

### Phase 1: the vertical slice

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
- [PHASE_1_HANDOFF.md](PHASE_1_HANDOFF.md), [PHASE_2_HANDOFF.md](PHASE_2_HANDOFF.md) and
  [PHASE_3_HANDOFF.md](PHASE_3_HANDOFF.md): status, test results, known issues and how to continue.

## Credits

Created by Nelj Alvarez ([`neljalvarez`](https://github.com/neljalvarez)) and the LAIKA team. Music from the original
LAIKA project. See [ASSET_CREDITS.md](ASSET_CREDITS.md).
