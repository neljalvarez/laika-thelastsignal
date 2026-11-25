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
wind is filtered noise, not a recording from Mars.

## Art

- **All pixel art is generated in code** (`src/art/`) for this project: Laika, tiles, machines, props, icons,
  backgrounds and the 3×5 lettering font. No image files are downloaded or bundled.
- **Laika's design** (bubble helmet, brown ears, orange and cream fur, white suit with red trim, steel backpack) and
  the palette come from the original LAIKA sprite data (`components/pixel/sprites.ts` in the original repository),
  redrawn here as a side view.
- The original project's memorial photograph was **not** copied (its photographer and licence are not recorded).
- `public/favicon.svg`: drawn for this project.

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
| Basalt (volcanic rock) is common on Mars; radio signals take minutes between Mars and Earth | General planetary-science facts, stated simply |

Game rules (power needing three clean panels, part costs, the 88-minute signal, Ares Station, rover R-2) are fiction.

## The real Laika

Laika flew on Sputnik 2 in November 1957 and was the first animal to orbit the Earth. She did not survive the flight.
LAIKA: THE LAST SIGNAL is a respectful, fictional, alternate-history adventure dedicated to her memory.
