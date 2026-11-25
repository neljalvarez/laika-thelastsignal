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

## Next: priorities carried into Phase 3

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

- **A new region.** Split `data/world.ts` into per-region modules; add a region transition (rover ride or a long walk).
- **New ability gates.** Grapple/tether, a headlamp for dark caves, a dust-storm shield.
- **A forgiving suit-battery mechanic** that recharges at powered stations (never a fail state).
- **Engineering systems from the original game's science themes:** radiation shelter, water recycling,
  greenhouse lighting, battery storage through a dust storm; a small "base status" diorama.
- **An optional science log** that collects every tip, sample and fact with its source.
- **The mystery.** Follow the 88-minute signal; companion characters; a map screen with discovered landmarks.
- **Presentation.** Hand-tuned art pass (canyon silhouettes, animated machinery), a landing cutscene, a
  day-to-dusk lighting change after the radio comes online, per-area music variations, better ambience.
- **Gamepad remapping UI** (keyboard remapping already exists).
- **Release quality.** Localization (strings are centralised in `data/` and `ui/`), a full accessibility audit
  (screen-reader flows for menus, colour-blind review, one-switch mode), performance profiling on low-end phones,
  and optional privacy-first cloud saves only if the team wants them.
