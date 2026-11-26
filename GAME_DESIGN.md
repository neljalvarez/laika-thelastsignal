# Game Design — LAIKA: THE LAST SIGNAL (Phases 1–4)

## Pitch

A small, curious dog in a bubble helmet explores Mars on foot. No menus to manage, no timers: you walk, jump, sniff,
dig, carry, repair and listen. The educational content (solar power and dust, batteries, radio, Martian geology)
comes from what you do and see.

Design references (principles only, no assets or IP borrowed): the approachable exploration of *A Short Hike*, the
gather-and-upgrade satisfaction of *Dome Keeper*, the ability-gated interconnected map of *SteamWorld Dig 2*, the
expressive animal characters of *Pikmin 4*, and the movement forgiveness of *Celeste*.

## Pillars and how the opening chapter serves them

| Pillar | In the slice |
| --- | --- |
| Exploration | Four connected areas with landmarks (the Red Spire, the rover wreck, the station dish), a tunnel under the canyon, optional ledges. |
| Discovery | Sniff pings and arrows, disturbed-soil mounds, a false rock wall hiding a room, three geological samples, readable logs. |
| Interaction | Every action is physical and contextual: walk up, press E. No confirmation dialogs during play. |
| Progression | Scanner unlock → power → radio → bridge; optional Thruster Boots open a high ledge. |
| Personality | Laika wakes, yawns and stretches; blinks, twitches her ears, wags, sits, lies down and naps when left alone; tilts her head at new machines, perks up near hidden things, skids when she turns, digs rear-up, sweeps with her tail, barks on request. |
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

## Mission 00: First Pawprints (Phase 2 tutorial)

New games start here: the spacecraft's **upper deck** (a sealed training bay above the Phase 1 interior). It teaches
one verb per stage, with one instruction on screen at a time. A stage advances only on what the player really does
(`src/systems/tutorial.ts`), never on a timer, and target objects glow while they are the current goal.

| # | Stage | Instruction (keyboard wording; touch and gamepad have their own) | Advances when |
| --- | --- | --- | --- |
| 1 | Wake | (Laika sleeps, the console beeps, she yawns, stretches and wags; any input skips) | Wake animation ends |
| 2 | Move | "A / D or ← / → to move." | She has really travelled 56 px (pushing a wall does not count) |
| 3 | Jump | "Hold Space to hop over the crate." | She is past the crate. A landing marker shows where to aim; after a failed hop, "Try holding Jump a little longer"; after three, an offer to turn on Easy Jumps |
| 4 | Console | "Walk up to the console and press E." | The practice console is used |
| 5 | Sniff | "Something is hiding nearby. Use Sniff!" | The scanner reveals the buried spot in the soil tray |
| 6 | Dig | "Dig here!" → "Found a spare component!" | The practice part is dug up |
| 7 | Repair | "Use the component to repair this machine." | The fan spins and the deck lights come on |
| 8 | Exit | "Ready to explore? Hop down the open hatch!" | Laika drops through the floor hatch to the lower deck |

Then two title cards, **MISSION 00 COMPLETE** and **MISSION 01 / A SIGNAL IN THE SILENCE**, and Mission 01 begins
on the lower deck exactly where Phase 1 began, with the scanner already learned.

Rules:

- **Practice state is isolated.** The practice part is not a campaign item, so finishing the tutorial adds nothing
  to the inventory. Only the save fields `tutorial.status` / `tutorial.stage` and the scanner unlock change.
- **Skip** (card button, with a confirmation) teleports to the lower deck and grants nothing: the scanner is then
  unlocked at the outpost receiver as in Phase 1. **Restart** resets the training bay. **Replay** (title screen or
  Pause) runs Mission 00 again as practice from anywhere in the campaign, then returns Laika to the exact spot she
  left, with campaign state untouched.
- **Saving mid-tutorial** stores the stage, so Continue resumes at the same step.
- **Prompts adapt** to the last device used and to remapped keys ("Hold Space" becomes "Hold W" if Jump is on W).
- **Old saves are never forced into the tutorial**: a migrated Phase 1 save is marked "skipped".

## Mission 01: A Signal in the Silence

The objective panel derives its text from the game state (`src/systems/mission.ts`), so it is always correct.

| # | Stage | What the player does | What changes |
| --- | --- | --- | --- |
| 1 | Lower deck | After Mission 00 (or a skip), walk to the blinking ship radio, press E. | "NO CARRIER" transmission. |
| 2 | Leave the ship | Jump the fallen crate (first jump), open the hatch. | Hatch slides open. |
| 3 | Find a radio | Walk out to the outpost and inspect the comms receiver. | Receiver: no power, module missing. **Scanner unlocked.** |
| 4 | Restore the radio | Collect 2 Metal + 1 Electronics (one is on the crates, one buried right by the crates as a sniff tutorial), repair the solar array, sweep the 3 dusty panels, find the comms module (buried by the rover wreck in the canyon), install it, tune in. | Power runs down the cable: battery, lamps, habitat windows, workstation and receiver light up in turn. |
| 5 | Mysterious signal | Subtitled, partly garbled message from "Ares Station" with a handshake code. | Bridge control on the canyon rim turns on. |
| 6 | Follow the signal | Extend the bridge (camera frames it piece by piece), open the station door. | The chasm is crossed. |
| 7 | Find the source | Trace the signal at the station console. | Final transmission: a voice that knows Laika's name. Mission complete card; free exploration continues. |

Steps inside stage 4 can be done in any order. Optional: three samples, the Golden Treat, Thruster Boots, the
echo sensor (bark at it).

### Objectives and hints (Phase 2)

- The objective panel shows **one actionable line** with the key or button to press. "▾ Details" expands the full checklist and a separate **Optional** section (samples, treat, boots), so
  optional goals never compete with the next step. During "Restore the radio" the line recommends a single next step
  (repair if you hold the parts, then sweep, then carry the module, then tune; otherwise the nearest needed part).
- **Adaptive hints** respond to lack of *progress*, not inactivity: the clock only runs while the player is actively
  playing, and pauses during transmissions, cutscenes and in optional areas. After about 35 s of play without
  progress the target object glows, at 60 s a hint line appears in the objective panel, at 90 s an arrow at the
  screen edge points the way. Any progress resets the level. Hints can be turned off in Settings; the **?** button
  asks for one directly.
- **Struggle detection**: four jumps in the same spot within 25 s offers a tip once (and Easy Jumps at the crate).

## The expanded world (Phase 3)

Loop: **explore → notice something unusual → investigate → discover → solve → unlock → explore further.**

### Regions and how they connect

Three handcrafted maps hold five numbered regions. Only the map Laika is in is built and rendered.

```
                 [05 ECHO RIDGE] ---- cable car (shortcut, opens after Mission 03) -----.
                        | North Access hatch (opens after Mission 02)                    |
   [ship][01 LANDING OUTPOST] ===== [02 CRIMSON CANYON] ===== [03 ARES STATION] <--------'
          ^ survey lift (shortcut, opens in Mission 02)            | freight lift (opens after the relay logs)
          '------------ [04 FROZEN DEPTHS: lift hall ... survey entrance] <----'
```

The surface map runs west to east; the Frozen Depths lie *under* the plain between the station and the outpost,
so the survey lift really does come up beside the outpost workstation. Echo Ridge rises north-east of the station,
and its tower is visible on the ridge's skyline from the first screen.

| Region | Identity | What is new there |
| --- | --- | --- |
| 01 Landing Outpost | Home base, warm dusk, the ship | Survey lift arrival; analysing the relay cell at the receiver |
| 02 Crimson Canyon | Introductory traversal | Unchanged (Phase 2 pit, tunnel and signs kept) |
| 03 Ares Station | Was the Mission 01 ending; now the hub | Relay logs, freight lift down, cable car arrival |
| 04 Frozen Depths | Dark blue and purple caves, deep red rock, pale cyan water ice, abandoned survey lab | Darkness and light, the Headlamp, three puzzles, a service tunnel |
| 05 Echo Ridge | Tall, wind-scoured, warmer horizon, diagonal strata, antenna gear | Vertical climbing, relays, the tower, Thruster Boots routes |

### Mission 02: Beneath the Red

| # | Step (objective line names the region first) | Notes |
| --- | --- | --- |
| 1 | Ares Station: check the relay logs at the signal console | Reveals the signal was *relayed* by the Echo Ridge tower; its power cell was stored underground. Freight lift unlocks. |
| 2 | Ride the freight lift down | Region card: REGION 04 Frozen Depths |
| 3 | Fix the survey lamp by the entrance | Gains the **Headlamp** |
| 4 | Follow the shining markers to the light sensor | **Puzzle A** |
| 5 | Find the junction, sniff out the power coupling, install it | **Puzzle B** |
| 6 | Run the core drill in the water-ice chamber | **Puzzle C**: water-ice sample + relay cell; an optional science card |
| 7 | Start the survey lift | **Shortcut 1**: lift hall ↔ Landing Outpost |
| 8 | Analyse the relay cell at the outpost receiver | Unseals the North Access: the route to Echo Ridge |

### Mission 03: Echoes Above

| # | Step | Notes |
| --- | --- | --- |
| 1 | Take the service tunnel to the North Access | Region card: REGION 05 Echo Ridge |
| 2 | Sweep the dust off Relay A △ | Tail sweep (Phase 1 verb, new use) |
| 3 | Climb to Ridge Camp; install the relay cell in the junction | Switchback ledges, 2-tile steps only |
| 4 | Align Relay B ○ on the antenna platform | Turn the dish until it matches its plaque |
| 5 | Find Relay C □ by following its faint signal; align it | Hidden inside a boulder |
| 6 | Climb the relay tower; trace the signal | The tower door opens when all three relays report in |
| 7 | Start the cable car | **Shortcut 2**: tower ↔ Ares Station. Mission 03 complete |

The final transmission confirms the source is still 1,200 km north, on the same 88-minute window, and is *older
than the station*. A faint voice says "...we waited where the lights go north... keep following...". Nothing is
resolved: the sender, the reason and Laika's past stay open. Mission 01's completion card and statistics remain;
the adventure simply continues, and free exploration is always available afterwards.

### Environmental puzzles

| Puzzle | Where | How it works | Why it is fair |
| --- | --- | --- | --- |
| A. Light the way | Dark observation chamber | Reflective arrows only shine in the Headlamp's beam and point along the lower walkway to a light sensor. Shining the beam on the sensor opens a shutter. | Paths and collision edges stay faintly visible without the lamp (never a black screen); the arrows add direction, they do not hide the floor. "Brighter caves" lightens everything further. |
| B. Restore the research circuit | Power junction | Battery bank → broken junction → lights, ice-chamber door, survey lift, service hatch. A crew note says the spare coupling is "in the frost by the door"; Sniff finds it. Installing it sends power visibly along the cables, lamp by lamp. | Every link has a visible state (dark/lit, symbols, a status screen in words). Nothing to guess. |
| C. The frozen survey chamber | Water-ice chamber | The core drill needs the circuit. Running it yields a water-ice sample and the relay cell. An optional card explains why water ice matters. | One action once powered; the science is optional and never blocks. |
| D. Align the relay network | Echo Ridge | Three relays, each with a symbol (△ ○ □) and a painted plaque showing the direction its dish must face. Relay A only needs sweeping; B and C turn one step per press and wrap around. The junction screen lists each relay with symbol, name and OK / not OK. | Physical visits, no menu; symbols and words, not colour alone. Any order works. Half-turned dishes keep their direction across saves. |
| E. Follow the strongest signal | Echo Ridge cliff | The Phase 2 scanner, re-used: sniffing near the cliff tracks Relay C's faint radio signal (weak / strong / located, warmer / colder) to a loose rock in a boulder. The buried-item scanner is unchanged. | Direction and distance are shown visually; hearing is never needed. |
| F. Bark and response (optional) | Scenic overlook | Barking near the acoustic sensor sends Laika's bark over her **suit radio**; the sensor answers and unfolds a small bridge to a cache. The card says why: Mars' air barely carries sound. | Optional; visual + caption feedback. |

### The Headlamp

Found on a crate beside the freight lift; one interaction repairs it. From then on it is always on: a small aura
around Laika plus a beam in the direction she faces. It lights the caves, makes reflective survey markers shine,
catches glints on equipment, reveals a reflective X on a false wall (a secret), and triggers light sensors. It is
saved as an ability (`abilities.headlamp`) and shown as a LAMP chip in the HUD next to SCAN and BOOTS, which is
the "contextual ability" strip future gadgets will join. Without it, the darkness never fully hides the route.

### Thruster Boots, used for real

The boots (built at the outpost workstation since Phase 1) now open alternate and optional routes: the Frozen
Depths ice shelf (R-2's antenna), Echo Ridge's high ledges (olivine sample, hidden weather station) and a quicker
way to the overlook cache. The first time Laika meets such an obstacle a one-line reminder appears. The mandatory
route never needs them (tested), and a salvage locker in the Frozen Depths gives enough parts to build them, so
no save can be stuck without boots.

### World map

Opened with **M** (or Tab), the ▦ HUD button, gamepad Back, or from Pause. It looks like a survey journal: the
current region, discovered regions and sections, connections (dashed while locked, green once a shortcut opens,
"?" while unexplored), visited checkpoints, known landmarks, Laika's position and the current mission
destination, with a legend. Sections appear as Laika walks into them; landmarks once she can see them. Secret
rooms are never drawn until she has been inside, and nothing reveals an undiscovered region.

### Optional discoveries (new in Phase 3)

| Discovery | Region | Placement rationale (what it rewards) |
| --- | --- | --- |
| Golden Treat, hidden alcove | Frozen Depths | **Headlamp**: a reflective X on a rock wall is only visible in the beam; the wall is false. |
| Survey recorder (research recording) | Frozen Depths | **An apparently unimportant passage**: the chamber's lower floor, found with Sniff. |
| Clay-rich mudstone (sample) | Frozen Depths | **Sniff** in the ice chamber; ties to Curiosity's clay finds. |
| R-2's lost antenna (rover part) | Frozen Depths | **Returning with an ability**: an ice shelf only Thruster Boots reach. |
| R-2's lost wheel (rover part) | Echo Ridge | **Environmental storytelling + Sniff**: buried where the rover tracks stop. |
| Olivine sand (sample) | Echo Ridge | **Thruster Boots**: the high-ledge route. |
| Hidden weather station (log) | Echo Ridge | **Thruster Boots** + **looking up**: on top of a rock pillar. |
| Crew recording, habitat ruin | Echo Ridge | **Looking behind terrain**: a rockfall at Ridge Camp is a false wall. |
| Golden Treat, overlook cache | Echo Ridge | **Bark** at the acoustic sensor (or boots). |

There are no random rewards and no grinding. The journal on the completion card counts samples, Golden Treats,
research recordings and rover parts across the whole world.

### Atmosphere and storytelling

Frozen Depths: cool palette, darkness with warm crew lamps and failing survey lights, frost motes, quiet mechanical
ambience with equipment hum. Echo Ridge: wide layered mountains, warm horizon, wind-blown dust, a blinking tower
light on the skyline, wind ambience. Ambience cross-fades between maps; reduced motion stops the blinking and
drifting. Stories are told by objects: rover tracks that stop at an abandoned hut, a crew lamp left warm in a
dark room, a half-repaired junction, sample racks, short optional logs. Information the mission needs is always
repeated in the objective line, so missing a log never blocks anyone.

### Accessibility in the new regions

Brighter caves (setting), Easy Jumps offered after repeated failed jumps on the ridge, captions for lifts, hatches
and relay responses, puzzle states shown with symbols and words, hints that first name the region and point to
the right lift or gate when the target is on another map, region-entrance and pre-climb checkpoints, and no
timing in any mandatory puzzle.

## The base comes alive (Phase 4)

Design rule from the brief: survival creates **decisions and environmental challenges, never chores**. There is no
food, oxygen or health meter, no death, no timer and no offline drain. What Laika manages is a small, visible
power network and her suit's energy, and both always recover.

### Mission 04: A Place to Call Home

After Mission 03 the Ares Station's console calls: the outpost is the only place with a crew-rated shelter and
water. Laika goes home and restores it. Fourteen steps; the objective always recommends one, but the work can be
done in any sensible order (the shelter or the greenhouse before life support, for example):

1. Answer the station call (suit energy starts here; the call also fills the suit).
2. Go home (hint: freight lift down, survey lift up). 3. Check the base terminal (opens Base Status).
4. Find the spare battery regulator in the ship's cargo locker. 5. Install it: the battery station runs and
   the lower level gets power.
6. Inspect the life-support recycler; 7. sniff out and dig up the pump cartridge in the maintenance bay; install
   it, connect the power box, start the recycler.
8. Inspect the water processor; 9. take the spare melt-line coupling from the Frozen Depths' core drill (survey
   lift both ways); install it: water flows to the tank, the recycler and the grow room.
10. Connect the grow-room power, open the valve, take seeds from the habitat locker, plant, switch on the lights.
11. Wake the shelter monitor, bark at the probe inside and the probe outside, log the readings.
12. LIGHTS OUT (below). 13. Sweep the dust off two panels. 14. Step outside: the finale.

A bot that knows the route needs about 3 minutes; the brief's target for a first-time player is 8–12 minutes
(not yet measured with people).

### The lower level

The habitat's ladder (E at the habitat dome) leads to a cut-away basement under the outpost, cols 40–88:
radiation shelter (thick hull walls) · maintenance bay with the power console and the buried cartridge ·
Laika's quarters (mat, storage locker, ladder up, a checkpoint) · life support · grow room (under the
greenhouse dome) · water room. Every room has a sign and a status light (a tick or a bar, not only a colour) and
is dark until its machine runs. Pipes along the ceiling flow when water runs; cables glow when powered.

### Visible base transformation

| Condition | What you see |
| --- | --- |
| Abandoned | Dark rooms with red status lights, a broken recycler with an empty cartridge slot (crossed), a dry cracked planter, dead power boxes, an unlit console |
| Partly restored | Lit rooms one by one, yellow cables, the recycler's drums filling and its fan turning, a vent on the habitat roof |
| Fully restored | Blue water pipes flowing, pink-and-blue grow lights, plants growing in the planter *and* in a glass greenhouse dome on the surface, steam from the vent, a blinking beacon on the habitat after the finale |

### Power

Three clean panels make 15 PU; a dusty one makes 1. The battery holds 100 BU (80 in Expedition) and moves
0.25 BU per PU-second of surplus or shortage, so it fills in about half a minute and drains slowly. Demand:
habitat 2, life support 3, shelter 1 (critical, always on) · water 1, greenhouse 3, research 2 (optional). When the
battery is empty and the sun is not enough, optional systems pause in the order greenhouse → research → water and
come back on their own. All values are in `src/data/engineering.ts` and are fictional units.

### LIGHTS OUT

A few seconds after the last facility comes online (while Laika is at the outpost), an alarm sounds, the view
takes a warm dust tint and sunlight drops to 62 % (70 % Relaxed, 50 % Expedition). The objective sends Laika to
the power console: life support, habitat and shelter are shown locked on; she chooses which optional systems keep
running and sees a "fits / too much" bar in words. Turning off only the grow lights is enough in Relaxed and
Adventure; Expedition also needs the research gear off. A wrong choice costs nothing (the battery simply keeps
draining slowly) and can be changed at once. When it fits, the haze passes but leaves two panels dusty; a tail
sweep on each restores full power and switches everything back on.

### Suit energy and Survival Assistance

From Mission 04 the suit meter appears. Walking, normal jumps, sniffing, barking and the headlamp are **always
free**. Thruster jumps cost energy, and the suit adds a **boosted second air jump** (Thruster Boots needed). A
scan costs a little; with too little energy the scanner still works at 55 % range, so no dig spot can be locked
away. After 4 s without spending, a reserve cell refills to a safe floor. Recharge posts (ϟ on the map) stand in
every region; the mat in Laika's quarters also recharges.

| | Relaxed | Adventure (default) | Expedition |
| --- | --- | --- | --- |
| Thruster jump / boost / scan | free | 10 / 25 / 2 | 16 / 36 / 4 |
| Reserve floor (always ≥ one thruster jump) | refills to full | 25 | 20 |
| Battery capacity | 100 | 100 | 80 |
| LIGHTS OUT sunlight | 70 % | 62 % | 50 % |
| Scanner range | full | full | 85 % |

The setting is in Settings and can change at any time; changing it clamps values, never removes progress.

### Optional challenges

- **A: Forgotten instrument (Crimson Canyon).** Sniff out a power cell on the canyon floor, repair the dead
  recharge post, then read the old seismometer (a recording and the Marsquakes journal entry). No boots needed.
- **B: Deep survey (Frozen Depths).** A recharge post at the chamber mouth, a thruster jump to an ice ledge, then
  the boosted jump to the deep probe (a sample and an ice-layer survey card).
- **C: High observation platform (Echo Ridge).** From the weather-station rock, the boosted jump to a scaffold
  with a telescope pointing north (a rover part and a story beat). B and C are 7 tiles up: Thruster Boots alone
  reach about 6, the boost about 8.6 (measured in play).

### Base Status and Science Journal

Base Status (base terminal, or Pause → Base status) has a **simple** view (a network diagram from the reference
image: sun → battery → machines, water → life support and greenhouse; each machine with a symbol and ✔ / ✖ / ■ / !
plus a word) and a **detailed** view (sunlight, output, use, battery and trend, plant stage, suit energy, mode, and
a note that the units are made up). The Science Journal (Pause → Science journal) has 8 categories and 12 entries.
Each entry: a short line, "Learn more" (the real science), an "In the game" note (what is fiction) and its source.
Entries unlock from what Laika does and are announced with a quiet toast, never a pop-up over play.

## Phase 5: simpler to play, gear to build

Phase 5 started from one round of player feedback: too much text, overstimulating, "I don't know what to do",
confusing objectives, and "finishing Mission 01 feels like the end of the game". 60 % of the work went into
simplification, 30 % into crafting, 10 % into testing.

### Text budget

| Kind | Budget | Example (before → after) |
| --- | --- | --- |
| Objective | 3–7 words | "Frozen Depths: take the spare melt-line coupling from the core drill." → "Get the pipe connector" |
| Objective hint | a few words | "Ride the survey lift down (next to the workstation). The core drill is just east of the lift hall." → "At the ice drill, down the lift." |
| Action prompt | 1–3 words | "Ride the survey lift down" → "Lift down"; "Take the spare melt-line coupling" → "Take pipe connector" |
| Item | plain name | Electronic Component → Circuit; Comms Module → Radio Part; Pump Cartridge → Pump; Melt-Line Coupling → Pipe Connector; Battery Regulator → Battery Part |
| Transmission | 2 short lines | the unknown signal was 4 lines; now 2, the full text is kept in Journal → Radio |
| Tutorial step | one line + the control | "Let's get moving!" + "A / D or ← / → to move." → "Move right." + "(A) (D) or (← →)" |

Word budgets are enforced by unit tests (`tests/phase5.test.ts`, "simplified text").

### Screen

One objective line with a direction arrow and the action key. Everything else is contextual: the inventory peeks
when it changes, the suit meter appears when energy is low or after a boosted jump, the power chip at the base or
in LIGHTS OUT. Settings → Gameplay help → Screen info: **Simple** (default) or **Detailed** (the Phase 4 HUD).

### Chapters

| Chapter | Missions | Ends with |
| --- | --- | --- |
| Prologue | Mission 00 tutorial | straight into Chapter 1 |
| 1 The Lost Signal | Mission 01 | "Signal traced!" → relay logs arrive by radio |
| 2 Beneath the Red | Mission 02 | "Relay cell decoded!" |
| 3 Echoes Above | Mission 03 | "Tower online!" → the station calls by itself |
| 4 A Place to Call Home | Mission 04 | "Base restored!" → the call for better gear |
| 5 Built to Explore | Mission 05 | "Ready for the north!" → explore |

No completion screens: a milestone toast, then a chapter banner, then the next objective. The player never has to
walk back to a console to learn that the story continues (this also fixes the Phase 4 dead end where the habitat
ladder stayed shut until the Ares console was used).

### Guidance

Guided (default): the marker is always shown and follows a reachable route (around walls, via the habitat ladder,
to the nearest open lift). Explorer: only after the hint system decides the player is stuck. Minimal: only the
objective's direction arrow. The ? button shows the marker for a few seconds in every mode. Tapping a checkpoint on
the map sets a temporary marker there.

### Mission 04, fewer chores

Removed or merged: the base survey and logs, separate recycler inspect / power / switch-on presses, the grow valve
press, separate "lights on", and the trip back to the shelter monitor. Battery restored ⇒ rooms powered; one press
installs and starts life support; water repair opens the grow valve; planting switches the lights on; the second
probe bark finishes the shelter. Survival Assistance defaults to Relaxed for new players.

### Crafting and equipment

The outpost workstation is now the **workbench**: large cards, two materials, one BUILD button that says what is
missing (NEED MORE PARTS / NO POWER / ✔ BUILT). Building closes the bench so the player sees the gear appear on Laika.

| Equipment | Cost | Needs | Effect | Optional use |
| --- | --- | --- | --- | --- |
| Thruster Boots | 2 Metal, 1 Circuit | – | double jump (Phase 1 ability) | high ledges everywhere |
| Signal Booster | 2 Metal, 1 Circuit | – | scanner range ×1.6, reveal ×1.35, finds faint caches | lost Nav Beacon (Mission 05), a metal cache in the canyon |
| Thruster Upgrade (efficient boots) | 3 Metal, 2 Circuits | boots | thrust and boost cost half | longer climbs on one charge |
| Survey Headlamp | 1 Metal, 2 Circuits | Headlamp | light ×1.35 | a survey cache in the Frozen Depths fissure |
| Reserve Battery | 3 Metal, 1 Circuit | – | suit energy 150, higher reserve floor | Expedition-mode climbs |

The world holds 13 Metal and 9 Circuits, exactly what Mission 01 and every upgrade need; every new part is reachable
with the starting jump (unit-tested). Recipes can never use mission items. Upgrades are permanent and automatic; there
are no loadouts. Blueprints: boots from the start, booster in Chapter 5, the rest after Chapter 5.

### Mission 05: Built to Explore (3–5 minutes)

The station call → the workbench (new blueprint) → two Metal and a Circuit downstairs → build the Signal Booster →
sniff out the lost Nav Beacon near the canyon entrance → link it at the radio dish. Ends with a short radio reply and
"Explore. The signal waits north".

### Rewards

Five looks (Survey Stripe, Mission Patch, Blue Trim, Copper Pack, Star Collar), unlocked by play, toggled in the
Journal's Gear tab, purely visual. Laika's room fills up by itself: a sample shelf (3 samples), the mission patch
poster (Chapter 4), a photo (a Golden Treat), a rover model (2 rover parts).

## World layout (tiles are 16 px; the world is 240 × 34 tiles)

```
cols:  0       24                         94          133    147 150   184  200     212         239
       [SHIP]  [LANDING OUTPOST]          [CRIMSON CANYON ..........................] [CHASM] [ARES STATION]
       hatch   solar battery hab dish ws  gate  pit   mesa (cavern below)  rover  rim  bridge  door  console
                                          \_secret room  \__survey tunnel__/  \_shaft
```

- **A. Spacecraft** (cols 3–23): two decks. The **upper deck** (rows 8–13) is the Mission 00 training bay: bed,
  bowl, poster, window, a crate to hop, practice console, soil tray and a broken fan, plus a floor hatch that only
  opens when the tutorial is finished. The **lower deck** (rows 16–21) is the Phase 1 interior: cockpit, radio,
  cargo, hatch to the surface. The hull shell fades away whenever Laika is inside.
- **B. Landing outpost** (24–93): solar array + control box, three panels, battery station, HAB-1 dome, comms
  receiver mast, repair workstation, lamps, cables, crates (first loot), the canyon sign.
- **C. Crimson Canyon** (94–211): stepped descent; a "JUMP OR TUNNEL" sign and an "EXIT →" sign at the **jump pit** with two rock stepping stones (3 easy gaps) and, since Phase 2, a low step in the west gap so a jump that falls short heading west climbs straight out; a
  **false rock wall** off the pit hiding the Golden Treat; the **survey tunnel** under the floor and a crystal-lit
  **cavern** under the Twin Mesa (lamps light the way, and rover tracks lead out of the shaft toward the wreck); the mesa's 2-tile ledge climb to a basalt sample and a boots-only ledge with a
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

| Value | Phase 2 | Phase 1 | Notes |
| --- | --- | --- | --- |
| Walk / sprint speed | 100 / 156 px/s | 96 / 150 | A little brisker. |
| Ground accel / decel / turn | 1500 / 1900 / 2600 px/s² | 1000 / 1300 / 1900 | Stops in under 3 px from a walk (Phase 1: 3.5 px); turning around is faster than stopping. |
| Air accel / decel / air turn | 950 / 520 / 1500 px/s² | 760 / 420 / (none) | Mid-air reversals respond, but momentum is kept. |
| Max fall speed | 400 px/s | 380 | |
| Gravity | 640 px/s² rising, ×1.5 falling | ×1.35 falling | Floaty rise, weightier fall. |
| Apex hang | ×0.55 gravity while Jump is held and \|vy\| < 45 | none | A short float at the top for aiming. |
| Full jump height | ≈ 56 px (3.5 tiles) | same | Unchanged on purpose: every Phase 1 jump still works. Release early for a hop (× 0.45). |
| Walking jump distance | > 4 tiles | | Unit-tested against the level's "easy jump" rule. |
| Coyote time / jump buffer | 110 ms / 140 ms | same | |
| Corner correction / ledge assist | 5 px / 7 px | none | Clipping a ceiling corner or a ledge lip nudges Laika past it. |
| Thruster Boots | +1 air jump (≈ 2.7 tiles) | same | Orange thrust puff. |
| **Easy jumps** assist | Higher jump, 220/260 ms grace, glide while holding Jump | same | Settings (also offered after repeated failed hops in Mission 00). |

The movement rules are a pure function (`stepMovement`), unit-tested for frame-rate independence (jump height and
horizontal distance at 30, 60 and 144 fps) and checked in the browser at 30 and 60 fps.

## Animation (Phase 2)

All of Laika's frames are composed in code from parts (`src/art/laika.ts`). Legs follow a gait table of phases, so
the walk, trot and gallop are consistent: each back leg trails the opposite front leg, with an equal stride.
`src/systems/animState.ts` picks the state: jump start, rise, apex, fall, land (scaled to fall speed), turn skid,
walk / trot / run by speed, and the action poses (sniff, dig with the rear raised, two-step repair, sweep, bark,
celebrate). Standing still runs an idle personality: blinks, ear twitches, wags and look-backs; after 9 s she sits,
after 22 s she lies down, after 38 s she sleeps. Near unrevealed treasure she perks up; near new machines she tilts
her head.

## Sniff, dig and bark

- Range 176 px; reveal range 44 px; cooldown 0.7 s. Only *hidden* things are detected (buried items and the secret
  wall), never visible pickups, so sniffing is about investigating, not a map overlay.
- Feedback is redundant on purpose: ring (visual), pings (audio, pitch = distance), arrows (shape, blink speed =
  distance), sparkle on the mound, prompt text.
- Buried spots also puff faint dust every few seconds, and the first reveal teaches "press E to dig".
- **Tracking (Phase 2):** after a sniff the suit keeps tracking the nearest hidden thing for 6 s. A signal meter
  shows *weak*, *strong* (≤ 100 px) or *located* (≤ 44 px) and whether you are getting warmer or colder; the rings
  pulse faster and one or two chevrons point the way, then a sparkle column marks the spot.
- **Bark (B / BARK / LB)** is optional and never required. It shows a sound-wave ring and a "Woof!" caption. At the
  outpost's echo sensor it plays back and teaches that sound is quieter and slower on Mars; the rover wreck answers
  with a beep.

## Items

| Item | Where | Use |
| --- | --- | --- |
| Metal ×13 (Phase 1: 5) | ship, crates, canyon, mesa, cavern; Phase 5 adds the lower level, Frozen Depths, Echo Ridge and a booster cache | Solar repair (2) and the workbench |
| Circuit ×9 (Phase 1: 4) | outpost, pit floor, canyon, rover; Phase 5 adds the lower level, Frozen Depths, Echo Ridge and a lamp cache | Solar repair (1) and the workbench |
| Radio Part ×1 (was Comms Module) | buried by the rover | Receiver (mission-critical, can never be lost) |
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
Phase 2 adds cues for turn skids, stage completion, the console beep, the rover's answer, the wake-up yawn and the
scanner's tracking ticks, and makes the tail sweep quieter. All of them were checked programmatically (they play
without errors, on the right bus, at the right moment); nobody has listened to them yet, so the mix still needs a
human ear.

## Accessibility

Keyboard, touch and gamepad; remappable keys; large prompts that show the right key or button; text size up to
150 % (the overlay also scales with screen size); reduced motion (no pans or shakes, honours the OS setting);
transmission text speed (normal / slow / instant); adaptive hints (on lack of progress, can be turned off, or the ?
button); **sound captions** (on by default: every sound that matters also appears as a short caption, e.g.
"♪ Woof!", "♪ Beep beep!"); Easy jumps (also offered after repeated failed hops); a skippable, replayable tutorial
whose prompts match the device in use; an in-game Controls reference in Pause; every audio cue has a visual counterpart; prompts and markers use shapes and text, not colour
alone; no oxygen, hunger or time limits; no death (falling out of the world returns you to a checkpoint); pause any
time; auto-pause when the tab is hidden; on phones, safe-area padding, no pinch-zoom / double-tap zoom / page scroll,
and every touch control is released on pause, blur or tab switch, so nothing can stay stuck down.
