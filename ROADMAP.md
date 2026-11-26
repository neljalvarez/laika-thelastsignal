# Roadmap

The project is planned in 11 phases, each defined by its own brief. Every phase builds on the same systems:
data-driven world, pure simulation, effects, derived objectives, and reachability tests.

## Done

- **Phase 1: vertical slice.** Mission 01 *A Signal in the Silence*: four connected areas, the core loop
  (explore → sniff → dig → repair → unlock), saves, settings, touch/gamepad. See `PHASE_1_HANDOFF.md`.
- **Phase 2: movement, character polish and onboarding.** Mission 00 *First Pawprints* (skippable, replayable,
  device-aware tutorial), crisper movement with apex hang, corner correction and ledge assist, a full animation
  overhaul with idle personality, Bark and the echo sensor, scanner tracking, a one-line objective with optional
  goals, adaptive hints, a smarter camera, guidance around the pit and tunnel, captions, mobile hardening, and save
  format v2 with migration. See `PHASE_2_HANDOFF.md`.

- **Phase 3: world expansion.** Multi-map region architecture (surface, Frozen Depths, Echo Ridge; five
  regions), Missions 02 *Beneath the Red* and 03 *Echoes Above*, the Headlamp, six environmental puzzles, a
  survey-journal world map, two shortcuts (survey lift, cable car), nine optional discoveries, region ambience
  and lighting, save format v3. See `PHASE_3_HANDOFF.md`.

- **Phase 4: survival, engineering and the base.** Mission 04 *A Place to Call Home* (14 steps, flexible order), a
  walkable lower level under the outpost, a pure fixed-step engineering simulation (solar → battery → habitat,
  life support, shelter, water, greenhouse, research), the LIGHTS OUT power-sharing event, forgiving suit energy with
  recharge posts and a boosted jump, Survival Assistance (Relaxed / Adventure / Expedition), base status views, a
  12-entry Science Journal with sources, three optional challenges, visible base transformation, save format v4.
  See `PHASE_4_HANDOFF.md`.

## Next: priorities carried into Phase 5

Still open (nothing here has been done by a person yet):

1. **Human playtests of Mission 04**, ideally with children. Is the lower level easy to find (the habitat ladder)?
   Do players read the power console, understand "life support is locked on", and find the haze tint readable?
   Is suit energy ever annoying in Adventure? How long does Mission 04 really take (target 8–12 minutes; a bot that
   knows the route needs about 3)?
2. **Balance pass** on the values in `src/data/engineering.ts` (battery rate, haze sunlight, suit costs, reserve,
   grow times) once real play times are known. Tests read the config, so tuning keeps them honest.
3. **Listen to the audio**: Phase 4 reuses existing cues for the machines (no new sounds were made).
4. **Real hardware**, especially phones: the HUD now has a suit meter and a power chip under the buttons.
5. Everything still open from Phases 2 and 3 below.

## Earlier list: priorities carried into Phase 4 (kept for reference)

1. **Human playtests**, ideally with children: the tutorial, the pit, and now the two new regions. Do players
   understand the light-sensor puzzle, find the coupling, read the relay plaques, notice the tower, use the map?
   How long do Missions 02 and 03 really take (target 5–8 minutes each)?
2. **Listen to the audio**, including the new depths and ridge ambience and machine cues (programmatic checks only).
3. **Real hardware**: phones (touch, safe areas, the darkness overlay's frame rate), a real gamepad, and a
   mid-range or low-end device for the Frozen Depths (measured only in headless software rendering).
4. **Art review** of Echo Ridge's silhouettes (still blocky in places) and of the new animations.
5. Then the Phase 4 brief. The Phase 3 brief reserves the survival simulation (oxygen etc.) for Phase 4.

## Earlier list: priorities carried into Phase 3 (kept for reference)

These came out of Phase 2 and should be settled before the game grows much further:

1. **Human playtests**, ideally with children: is Mission 00 the right length, are the instructions read, do the
   adaptive hints arrive at the right moment (35 / 60 / 90 s), does anyone get stuck at the pit or the tunnel?
2. **Listen to the audio.** Every Phase 2 cue was verified programmatically only. Mix levels, the new skid / yawn /
   tracking / rover cues, and the quieter sweep need a human ear on headphones and on phone speakers.
3. **Real hardware.** Touch on actual phones (iOS Safari, Android Chrome; notches, home indicator), and a real
   gamepad, including the new LB bark binding. The automated tests used emulated touch and no gamepad.
4. **Art review of the new animations** with the team (gait readability at 1×, dig and repair poses, sleep).
5. Then the content planned for the next phase brief (the candidate list below is a starting point, not a commitment).

## Candidate ideas for later phases

- ~~A new region / region transitions~~ (done in Phase 3). The surface map's terrain could still move from
  `data/world.ts` into `data/regions/` modules.
- **New ability gates.** Grapple/tether, a dust-storm shield (the headlamp shipped in Phase 3).
- ~~A forgiving suit-battery mechanic~~, ~~engineering systems (radiation shelter, water recycling, greenhouse,
  battery through a dust storm)~~ and ~~a science log~~ (done in Phase 4). Possible follow-ups: more greenhouse
  crops, a second haze event later in the story, base upgrades bought with salvage.
- **The mystery.** Follow the 88-minute signal north ("where the lights go north"); companion characters
  (rover R-2's parts are already being collected). The map screen shipped in Phase 3.
- **Presentation.** Hand-tuned art pass (canyon silhouettes, animated machinery), a landing cutscene, a
  day-to-dusk lighting change after the radio comes online, per-area music variations, better ambience.
- **Gamepad remapping UI** (keyboard remapping already exists).
- **Release quality.** Localization (strings are centralised in `data/` and `ui/`), a full accessibility audit
  (screen-reader flows for menus, colour-blind review, one-switch mode), performance profiling on low-end phones,
  and optional privacy-first cloud saves only if the team wants them.
