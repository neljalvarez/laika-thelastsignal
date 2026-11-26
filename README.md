# LAIKA: THE LAST SIGNAL

**One small dog. One lost signal. An entire planet to explore.**

A 2D pixel-art side-scrolling adventure for the browser. You play as Laika, who wakes up inside her damaged
spacecraft on Mars. Mission Control is silent. Explore, sniff out buried parts, repair an abandoned outpost, restore
the radio, follow a mysterious signal across Crimson Canyon, down into frozen caves and up to a ridge-top relay
tower, then come home and turn the abandoned outpost into a working Martian base.

What you can play today: **Mission 00: First Pawprints** (a 1–2 minute guided tutorial in the spacecraft),
**Mission 01: A Signal in the Silence** (Landing Outpost → Crimson Canyon → Ares Station), and, new in Phase 3,
**Mission 02: Beneath the Red** (the Frozen Depths) and **Mission 03: Echoes Above** (Echo Ridge), across five
connected regions, and, new in Phase 4, **Mission 04: A Place to Call Home** (restore the outpost's power, life
support, water, greenhouse and radiation shelter), and, new in Phase 5, **Chapter 5: Built to Explore** with a
workbench, five pieces of equipment Laika wears, and a much calmer, simpler screen. It is the standalone successor to the original NASA Space Apps strategy game
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
| Bark (optional; also takes radiation-probe readings) | B | BARK | LB |
| Sprint | Shift | RUN (toggle) | B / RB / RT |
| World map | M (also Tab) | ▦ button | Back / Select |
| Pause | Esc (also P) | II button | Start |

The **Headlamp** (found in the Frozen Depths) needs no button: once fixed, it shines wherever Laika faces. From
Mission 04, **thruster jumps use suit energy** (the meter under the buttons, top right). Walking, normal jumps,
sniffing, barking and the headlamp are always free. Recharge at posts marked ϟ or by resting on Laika's mat.
**Settings → Survival assistance** picks Relaxed, Adventure (default) or Expedition at any time.

Keys are remappable in **Settings → Controls**, and every on-screen prompt shows the key you actually bound (or the
touch / gamepad button you last used). The **?** button gives a hint for the current objective; **Pause → Controls**
shows this table in game. New players start in Mission 00, which can be skipped and replayed any time from Pause.

## Run it locally

Requires Node 18.18+ (developed on Node 22).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 195 Vitest unit tests (engineering simulation, suit energy, Missions 00-04, regions, puzzles,
                   #   saves + migration v1-v4, movement, level reachability on every map, scanner, hints,
                   #   animation states, settings, the base's visible look)
npm run typecheck  # strict TypeScript
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build at http://localhost:4173
```

Add `?debug` to the URL to expose `window.__laika` (state, player position, tutorial stage, hint level, scanner
tracking, current map) for automated play-testing. Browser play-tests live in `playtest/` (Python + Playwright):
`playthrough.py` is the Phase 1 route, `phase2.py` runs Phase 2 scenarios A–H, `phase3.py` runs Phase 3
scenarios A–K and `phase4.py` runs Phase 4 scenarios A–M.

## Deploy (Vercel, free Hobby plan)

1. vercel.com → Add New → Project → import `neljalvarez/laika-thelastsignal`.
2. Framework preset: **Vite** (also set in `vercel.json`). Build command `npm run build`, output `dist`.
3. No environment variables, backend, database, accounts or paid APIs. Deploy.

Any static host works: upload the contents of `dist/`. Asset paths are relative (`base: "./"`).

## What's in the game

### Phase 5: simpler to play, gear to build

- **Less to read.** Objectives are a few words with a direction arrow ("Fix the battery"), action prompts are one to
  three words ("Lift down", "Take Metal"), radio messages are two short lines that play while you keep moving (the
  full text is saved in the Journal), and items have plain names (Radio Part, Circuit, Pump, Pipe Connector).
- **A quieter screen.** One objective at a time. The inventory, suit meter and power chip appear only when they
  change or matter, then tuck away. A "Detailed" screen-info setting brings everything back.
- **Chapters instead of end screens.** Prologue → Chapter 1 The Lost Signal → Chapter 2 Beneath the Red → Chapter 3
  Echoes Above → Chapter 4 A Place to Call Home → Chapter 5 Built to Explore. A mission ends with a short
  "Signal traced!" and a chapter banner; the next chapter's radio call arrives by itself, so you never have to walk
  back to a console to find out the story continues.
- **A marker that knows the way.** Guided mode (default) shows a marker that follows a real route: around walls, up
  the habitat ladder, to the nearest working lift when the goal is on another map. Explorer mode shows it only when
  you are stuck; Minimal shows only the direction arrow. The ? button always shows the way.
- **Simpler map.** Your position, the goal and checkpoints; landmarks, collected things and route names are
  optional filters. Tap a checkpoint to set a marker there.
- **Shorter tutorial.** Each step is one short line and the control ("Move right. (A) (D)").
- **Calmer notifications.** One at a time, never more than two, repeats dropped, pick-ups merged ("+2 Metal"),
  warnings first.
- **Fewer chores in Mission 04.** Fixing the battery powers the rooms; one press installs and starts life support;
  the water repair opens the grow-room valve; planting turns the lights on; the second probe bark finishes the
  shelter. Survival now starts on Relaxed (your saved choice is kept).
- **The workbench.** Big cards, two materials (Metal and Circuits), one BUILD button. Five pieces of equipment:
  Thruster Boots, Signal Booster, Thruster Upgrade, Survey Headlamp and Reserve Battery. Upgrades are permanent
  and automatic (no loadouts), each one shows on Laika, and each opens one optional cache.
- **Chapter 5: Built to Explore.** A short mission: get the booster blueprint, find parts downstairs, build it, sniff
  out a lost Nav Beacon and link it at the radio.
- **Journal and rewards.** Gear, Science, Radio and Progress tabs; five unlockable looks (no gameplay effect); and
  Laika's room fills up with souvenirs (a sample shelf, a mission patch, a photo, a little rover model).
- Main menu: Continue / New Game / Settings, with Tutorial, Controls and Credits under "More". Settings are grouped
  in tabs with a two-step "Reset to defaults". Save format v5 migrates every earlier save.

### Phase 4: survival, engineering and the base

- **Mission 04: A Place to Call Home.** The Ares Station calls Laika home. Fourteen steps restore the Landing
  Outpost in a flexible order: a battery regulator from the ship, a pump cartridge sniffed out of the maintenance
  bay, a melt-line coupling from the Frozen Depths' core drill, seeds from the habitat locker, and two radiation
  probes that answer Laika's bark.
- **A base you can walk through.** The habitat's ladder leads to a new lower level (a cut-away basement): Laika's
  quarters, the maintenance bay with the power console, life support, a grow room and the water room, plus a
  thick-walled radiation shelter. Rooms light up one by one; pipes and cables show flow; the surface gains a
  greenhouse dome with the crop growing inside, a steaming vent and a beacon light.
- **Power you can see.** Solar panels feed a battery; machines draw from it. A fixed-step simulation (it pauses in
  menus, transmissions, the tutorial and hidden tabs, and never runs while the game is closed).
- **LIGHTS OUT.** A dust haze cuts the sun. Share out the power at the console (life support is locked on), then
  sweep the dust off two panels. Nothing can be lost; every choice can be changed.
- **Suit energy.** Thruster jumps and long scans cost energy, with a reserve cell that refills to a safe level,
  recharge posts in every region and three Survival Assistance levels. Basic movement is always free.
- **Three optional challenges.** Repair a dead recharge post in the canyon to wake an old seismometer; climb to a
  deep survey probe in an ice fissure; reach an observation platform on Echo Ridge. The last two need the suit's
  boosted jump, so they reward planning energy.
- **Base status and a Science Journal.** A simple and a detailed status view, and twelve journal entries in eight
  categories that separate real science (with sources) from the game's fiction.
- Save format v4 with migration from every earlier version.

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
- [PHASE_1_HANDOFF.md](PHASE_1_HANDOFF.md), [PHASE_2_HANDOFF.md](PHASE_2_HANDOFF.md),
  [PHASE_3_HANDOFF.md](PHASE_3_HANDOFF.md), [PHASE_4_HANDOFF.md](PHASE_4_HANDOFF.md) and
  [PHASE_5_HANDOFF.md](PHASE_5_HANDOFF.md): status, test results,
  known issues and how to continue.

## Credits

Created by Nelj Alvarez ([`neljalvarez`](https://github.com/neljalvarez)) and the LAIKA team. Music from the original
LAIKA project. See [ASSET_CREDITS.md](ASSET_CREDITS.md).
