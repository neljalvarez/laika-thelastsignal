# Game Design — LAIKA: THE LAST SIGNAL (Phase 1)

## Pitch

A small, curious dog in a bubble helmet explores Mars on foot. No menus to manage, no timers: you walk, jump, sniff,
dig, carry, repair and listen. The educational content (solar power and dust, batteries, radio, Martian geology)
comes from what you do and see.

Design references (principles only, no assets or IP borrowed): the approachable exploration of *A Short Hike*, the
gather-and-upgrade satisfaction of *Dome Keeper*, the ability-gated interconnected map of *SteamWorld Dig 2*, the
expressive animal characters of *Pikmin 4*, and the movement forgiveness of *Celeste*.

## Pillars and how Phase 1 serves them

| Pillar | In the slice |
| --- | --- |
| Exploration | Four connected areas with landmarks (the Red Spire, the rover wreck, the station dish), a tunnel under the canyon, optional ledges. |
| Discovery | Sniff pings and arrows, disturbed-soil mounds, a false rock wall hiding a room, three geological samples, readable logs. |
| Interaction | Every action is physical and contextual: walk up, press E. No confirmation dialogs during play. |
| Progression | Scanner unlock → power → radio → bridge; optional Thruster Boots open a high ledge. |
| Personality | Laika wakes up on her bed, wags after finds, tilts her head at unfamiliar machines, sweeps with her tail, barks when celebrating. |
| Scientific learning | Short optional tips: dust blocks sunlight, batteries store solar power, radio needs power and an antenna, Mars gravity, rock samples. |

## Core loop

**Explore → Detect → Discover → Collect → Repair → Unlock → Explore further.**

1. Walk into new terrain (the camera leads where Laika faces).
2. Press **Sniff**: a pulse ring expands; each hidden thing it passes pings (higher pitch = closer) and gets a
   blinking arrow (faster blink = closer).
3. Walk to the spot. Within ~3 tiles the mound sparkles and the prompt changes to **Dig**.
4. Dig: a short animation, dirt flies, the item pops out and flies to Laika; a notification names it.
5. Carry it home (the comms module visibly rides on Laika's back).
6. Repair: the machine changes appearance and sound confirms it.
7. The world changes: lights, cables, a bridge. A new area opens.

## Mission 01: A Signal in the Silence

The objective panel derives its text from the game state (`src/systems/mission.ts`), so it is always correct.

| # | Stage | What the player does | What changes |
| --- | --- | --- | --- |
| 1 | Wake up | Control within ~1.5 s. Walk to the blinking ship radio, press E. | "NO CARRIER" transmission. |
| 2 | Leave the ship | Jump the fallen crate (first jump), open the hatch. | Hatch slides open. |
| 3 | Find a radio | Walk out to the outpost and inspect the comms receiver. | Receiver: no power, module missing. **Scanner unlocked.** |
| 4 | Restore the radio | Collect 2 Metal + 1 Electronics (one is on the crates, one buried right by the crates as a sniff tutorial), repair the solar array, sweep the 3 dusty panels, find the comms module (buried by the rover wreck in the canyon), install it, tune in. | Power runs down the cable: battery, lamps, habitat windows, workstation and receiver light up in turn. |
| 5 | Mysterious signal | Subtitled, partly garbled message from "Ares Station" with a handshake code. | Bridge control on the canyon rim turns on. |
| 6 | Follow the signal | Extend the bridge (camera frames it piece by piece), open the station door. | The chasm is crossed. |
| 7 | Find the source | Trace the signal at the station console. | Final transmission: a voice that knows Laika's name. Mission complete card; free exploration continues. |

Steps inside stage 4 can be done in any order. Optional: three samples, the Golden Treat, Thruster Boots.

## World layout (tiles are 16 px; the world is 240 × 34 tiles)

```
cols:  0       24                         94          133    147 150   184  200     212         239
       [SHIP]  [LANDING OUTPOST]          [CRIMSON CANYON ..........................] [CHASM] [ARES STATION]
       hatch   solar battery hab dish ws  gate  pit   mesa (cavern below)  rover  rim  bridge  door  console
                                          \_secret room  \__survey tunnel__/  \_shaft
```

- **A. Spacecraft** (cols 3–23): interior with bed, food bowl, poster, porthole, radio, cargo crate, hatch. The hull
  shell fades away whenever Laika is inside.
- **B. Landing outpost** (24–93): solar array + control box, three panels, battery station, HAB-1 dome, comms
  receiver mast, repair workstation, lamps, cables, crates (first loot), the canyon sign.
- **C. Crimson Canyon** (94–211): stepped descent; the **jump pit** with two rock stepping stones (3 easy gaps); a
  **false rock wall** off the pit hiding the Golden Treat; the **survey tunnel** under the floor and a crystal-lit
  **cavern** under the Twin Mesa; the mesa's 2-tile ledge climb to a basalt sample and a boots-only ledge with a
  hematite sample; the **rover wreck** with its log and the buried comms module; the east climb to the rim; the
  **chasm** with a ledge ladder so a fall is never a dead end.
- **D. Ares Research Station** (212–239): sealed door, logs, a catwalk with a note, the signal console.

Level-design rules (enforced by `tests/world.test.ts` with a reachability solver):

- The mission never needs more than a 2-tile climb or a 3-tile gap.
- From every reachable spot, the outpost is reachable again: no soft locks, no dead ends.
- Every object is reachable with a normal jump, except the boots ledge, which is reachable with Thruster Boots.
- The station is unreachable without the bridge (and its door stays sealed without the radio, in case of
  sequence breaks with boots).

## Movement (tuned for fun, `src/config/constants.ts`)

| Value | Normal | Notes |
| --- | --- | --- |
| Walk / sprint speed | 96 / 150 px/s | Fast acceleration, quicker turn-around than stopping. |
| Gravity | 640 px/s² rising, ×1.35 falling | Floaty rise, snappier fall. |
| Full jump height | ≈ 56 px (3.5 tiles) | Release early for a short hop (velocity × 0.45). |
| Coyote time / jump buffer | 110 ms / 140 ms | |
| Thruster Boots | +1 air jump (≈ 2.7 tiles) | Orange thrust puff. |
| **Easy jumps** assist | Higher jump, 220/260 ms grace, glide while holding Jump | Settings. |

The movement rules are a pure function (`stepMovement`), unit-tested for frame-rate independence.

## Sniff and dig

- Range 176 px; reveal range 44 px; cooldown 0.7 s. Only *hidden* things are detected (buried items and the secret
  wall), never visible pickups, so sniffing is about investigating, not a map overlay.
- Feedback is redundant on purpose: ring (visual), pings (audio, pitch = distance), arrows (shape, blink speed =
  distance), sparkle on the mound, prompt text.
- Buried spots also puff faint dust every few seconds, and the first reveal teaches "press E to dig".

## Items

| Item | Where | Use |
| --- | --- | --- |
| Salvaged Metal ×5 | ship, crates, canyon (buried), mesa, cavern | Solar repair (2), Thruster Boots (2) |
| Electronic Component ×4 | outpost (buried), pit floor, canyon (buried), rover (buried) | Solar repair (1), Thruster Boots (1) |
| Comms Module ×1 | buried by the rover | Receiver (mission-critical, can never be lost) |
| Geological Sample ×3 | mesa ledge (basalt), boots ledge (hematite "blueberry"), rim (gypsum vein, buried) | Optional; each shows a one-line fact |
| Golden Treat ×1 | secret room | Optional collectible |

## Narrative

Short, subtitled lines only. The mystery is set up and never resolved: the station crew left to find a signal that
"is not ours", it repeats every 88 minutes, and at the end a voice asks, "Laika? ...is that you, girl?". The
dedication to the real Laika appears on the title screen and in the credits.

## Audio

The original LAIKA soundtrack (title, gameplay playlist, ending theme on completion), synthesized SFX for every
action (steps alternate pitch, jump, land, sniff, pings, dig, collect, clank, sweep, repair, power-up, radio
static and voice blips, bridge segments, door, checkpoint, bark, fanfare) and layered ambience (Martian wind, ship
hum, outpost machinery after power returns, an eerie tone in the station). Music ducks under transmissions.

## Accessibility

Keyboard, touch and gamepad; remappable keys; large prompts that show the right key or button; text size up to
150 % (the overlay also scales with screen size); reduced motion (no pans or shakes, honours the OS setting);
transmission text speed (normal / slow / instant); optional hints (auto after ~50 s on one objective, or the ?
button); Easy jumps; every audio cue has a visual counterpart; prompts and markers use shapes and text, not colour
alone; no oxygen, hunger or time limits; no death (falling out of the world returns you to a checkpoint); pause any
time; auto-pause when the tab is hidden.
