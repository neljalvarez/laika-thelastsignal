# Asset credits and origins

Last reviewed: 2026-11-25. This is a student/team project; it is **not affiliated with or endorsed by NASA**.

## Music (from the original LAIKA project)

Copied unmodified from [`neljalvarez/laikamars-nasa`](https://github.com/neljalvarez/laikamars-nasa) `public/audio/`.
The original project's `SOURCES.md` records them as custom-made for LAIKA (two confirmed by the team on 2026-11-15,
two marked "the team should confirm"). **The team remains responsible for confirming the rights to publish them.**

| Track | File | Used for |
| --- | --- | --- |
| Against the Crimson Sky | `public/audio/against-the-crimson-sky.mp3` | Title screen |
| Below the Red Horizon | `public/audio/below-the-red-horizon.mp3` | Gameplay (playlist, track 1) |
| Last Light On The Ridge | `public/audio/last-light-on-the-ridge.mp3` | Gameplay (playlist, track 2) |
| Across the Crimson Sands | `public/audio/across-the-crimson-sands.mp3` | Mission complete |

## Sound effects and ambience

Synthesized at runtime with the Web Audio API (`src/audio/AudioManager.ts`). No recorded audio files. The Martian
wind is filtered noise, not a recording from Mars. Phase 2 cues (skid, stage complete, console beep, rover beep,
yawn, scanner tracking) are synthesized the same way.

## Art

- **All pixel art is generated in code** (`src/art/`) for this project: Laika, tiles, machines, props, icons,
  backgrounds and the 3×5 lettering font. No image files are downloaded or bundled.
- **Laika's design** (bubble helmet, brown ears, orange and cream fur, white suit with red trim, steel backpack) and
  the palette come from the original LAIKA sprite data (`components/pixel/sprites.ts` in the original repository),
  redrawn here as a side view.
- The original project's memorial photograph was **not** copied (its photographer and licence are not recorded).
- `public/favicon.svg`: drawn for this project.
- **Phase 2 animation references.** The team supplied four reference images (a quadruped walk-cycle diagram, a
  digging-dog pose, a dog sprite sheet and dust/smoke effect shapes). They were used only as **references for
  timing and pose** (back leg one step behind the opposite front leg, equal stride; head down and rear up when
  digging; puff shapes). Nothing was traced or copied, and the images are not in the repository.
- **Phase 3 regions** (ice, frost and ridge-rock tiles, cave and lab back walls, survey lamps, relays, the tower,
  lifts, cable car, signs and markers, lighting stamps) are also generated in code (`src/art/regionProps.ts`,
  `src/art/tiles.ts`). The team shared three references: a region-connection sketch (used for the world layout),
  a screenshot of an icy cave from another game, and a red Martian landscape painting with a distant tower. The
  last two were used only for **mood and colour direction** (cool blues underground, a warm red horizon with a
  tower on the skyline). No shapes, characters or tiles were copied, and the images are not in the repository.

## Fonts and libraries

| Package | Licence | Role |
| --- | --- | --- |
| Phaser 3.90 | MIT | Game engine |
| @fontsource/pixelify-sans (Pixelify Sans) | SIL Open Font License 1.1 | HUD and menu font (bundled locally, no font CDN) |
| Vite, TypeScript, Vitest | MIT / Apache-2.0 | Build and tests (development only) |

## Science content

Every fact in the game is short and simplified. Sources checked on 2026-11-25:

| In game | Source |
| --- | --- |
| Mars gravity is about 38 % of Earth's | [NASA JPL, InSight press kit: Mars at a glance](https://www.jpl.nasa.gov/news/press_kits/insight/launch/facts/mars-at-a-glance) |
| Hematite "blueberries" formed in water, found by Opportunity | [NASA Science, Meridiani Planum](https://science.nasa.gov/resource/meridiani-planum-2/); [NASA Astrobiology, Iron Blueberries (2004)](https://astrobiology.nasa.gov/news/check-type-iron-blueberries/) |
| Gypsum veins left by water, found by Curiosity | [NASA JPL, Curiosity Finds Calcium-Rich Deposits (2013)](https://www.jpl.nasa.gov/videos/curiosity-finds-calcium-rich-deposits/) |
| Dust on panels reduces solar power; batteries store it | Same principle as the original game's "Power on Mars" card ([NASA JPL, Opportunity recovery, 2018](https://www.jpl.nasa.gov/news/six-things-about-opportunitys-recovery-efforts/)) |
| Sound is quieter on Mars and travels slower than on Earth (echo sensor, Phase 2) | [NASA JPL, What Sounds Captured by NASA's Perseverance Rover Reveal About Mars (2022)](https://www.jpl.nasa.gov/news/what-sounds-captured-by-nasas-perseverance-rover-reveal-about-mars/): about 240–250 m/s on Mars vs 343 m/s on Earth; [NASA Science, Sounds of Mars](https://science.nasa.gov/mission/mars-2020-perseverance/sounds-of-mars/): quieter and more muffled |
| **Phase 3:** Mars has water ice under its surface and in its polar caps; it could give explorers drinking water, oxygen and rocket fuel (drill chamber card, Frozen Depths) | [NASA, NASA Is Locating Ice on Mars With This New Map (SWIM)](https://www.nasa.gov/solar-system/nasa-is-locating-ice-on-mars-with-this-new-map/): buried ice as drinking water and a key ingredient for rocket fuel; [NASA Astrobiology, The Mars Water Story](https://astrobiology.nasa.gov/news/the-mars-water-story-gets-ever-more-interesting/): water combined with atmospheric CO₂ to make oxygen and methane propellant |
| **Phase 3:** In 2008 the Phoenix lander dug up bright ice that slowly vanished into the thin air (ice-core log) | [NASA JPL, Bright Chunks at Phoenix Lander's Mars Site Must Have Been Ice (2008)](https://www.jpl.nasa.gov/news/bright-chunks-at-phoenix-landers-mars-site-must-have-been-ice/); [NASA Science, Ice on Mars — Now it's Gone (PIA10911)](https://science.nasa.gov/photojournal/ice-on-mars-now-its-gone): sublimated over four days in the "Dodo-Goldilocks" trench |
| **Phase 3:** Clay minerals form in water; Curiosity found clay in Gale Crater mudstone (clay sample) | [NASA JPL, Curiosity Mars Rover Sees Trend in Water Presence (2013)](https://www.jpl.nasa.gov/news/curiosity-mars-rover-sees-trend-in-water-presence/); Bristow et al., *Science Advances* (2018), [Clay mineral diversity in Gale crater](https://pmc.ncbi.nlm.nih.gov/articles/PMC5990309): Yellowknife Bay mudstone ~20 wt % clay |
| **Phase 3:** Olivine, a green mineral from volcanic rock, found by rovers in sand and rocks (olivine sample) | [NASA JPL, Rover's First Soil Studies Help Fingerprint Martian Minerals (2012)](https://www.jpl.nasa.gov/news/nasa-rovers-first-soil-studies-help-fingerprint-martian-minerals/): olivine in the Rocknest sand; [NASA JPL, Minerals at Rocknest and John Klein (PIA16830)](https://www.jpl.nasa.gov/images/pia16830-minerals-at-rocknest-and-john-klein/) |
| **Phase 3:** Mars has dust devils that rovers have filmed (weather station log) | [NASA JPL, Perseverance Rover Witnesses One Martian Dust Devil Eating Another (2025)](https://www.jpl.nasa.gov/news/perseverance-rover-witnesses-one-martian-dust-devil-eating-another/); [NASA JPL, Perseverance Captures Dust-Filled Martian Whirlwind (2023)](https://www.jpl.nasa.gov/news/nasas-perseverance-captures-dust-filled-martian-whirlwind) |
| **Phase 3:** Rovers send most of their data to Earth through orbiters acting as relays (Echo Ridge relay log) | [NASA Science, Mars Relay Network](https://science.nasa.gov/mars/mars-relay-network/); [NASA, The Mars Relay Network Connects Us to NASA's Martian Explorers](https://www.nasa.gov/missions/the-mars-relay-network-connects-us-to-nasas-martian-explorers/) |
| **Phase 3:** Mars gets less than half the sunlight Earth does (headlamp card) | Inverse-square law at Mars' ~1.5 AU orbit: about 43–44 % of Earth's sunlight ([timeanddate.com, Sunlight on other planets](https://timeanddate.com/astronomy/sun/sunlight-planets)). A reference site, not NASA; the figure is basic physics |
| **Phase 3:** Mars' air is so thin that sound barely carries (acoustic sensor) | Same Perseverance sources as the Phase 2 echo sensor above |
| Basalt (volcanic rock) is common on Mars; radio signals take minutes between Mars and Earth | General planetary-science facts, stated simply |

Game rules (power needing three clean panels, part costs, the 88-minute signal, Ares Station, rover R-2) are fiction.

**Phase 3, what is real and what is not.** *Verified findings* are only the rows marked Phase 3 above; in game they
appear on optional cards or in log lines prefixed "REAL:". *Fictional technology:* the Frozen Depths research
facility, survey lifts, core drill, relay cells, the Echo Ridge relay network and tower, the cable car, the
acoustic sensor that "hears" Laika's bark through her suit radio, and the Headlamp's reflective markers.
*Simplified gameplay rules:* the research circuit (one missing coupling stops everything downstream), turning
relay dishes to match a plaque, and the scanner following a radio signal. *Alternate history:* everything about
Laika being on Mars, the station crew and the signal.

## The real Laika

Laika flew on Sputnik 2 in November 1957 and was the first animal to orbit the Earth. She did not survive the flight.
LAIKA: THE LAST SIGNAL is a respectful, fictional, alternate-history adventure dedicated to her memory.
