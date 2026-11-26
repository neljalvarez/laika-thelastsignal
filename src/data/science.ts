/**
 * Phase 4: the science journal. Every entry separates REAL science (with a source checked on
 * 2026-11-26, see ASSET_CREDITS.md) from what is FICTION in the game. Entries unlock through what
 * Laika actually does; they never pop up over gameplay, they wait in the journal.
 */
export type ScienceCategory =
  | "geology"
  | "water"
  | "solar"
  | "storage"
  | "lifeSupport"
  | "plants"
  | "radiation"
  | "comms";

export const CATEGORIES: Array<{ id: ScienceCategory; name: string; icon: string }> = [
  { id: "geology", name: "Mars Geology", icon: "sci_geology" },
  { id: "water", name: "Water and Ice", icon: "sci_water" },
  { id: "solar", name: "Solar Energy", icon: "sci_solar" },
  { id: "storage", name: "Energy Storage", icon: "sci_storage" },
  { id: "lifeSupport", name: "Life Support", icon: "sci_life" },
  { id: "plants", name: "Growing Plants", icon: "sci_plants" },
  { id: "radiation", name: "Radiation Protection", icon: "sci_radiation" },
  { id: "comms", name: "Communications", icon: "sci_comms" },
];

export interface ScienceEntry {
  id: string;
  category: ScienceCategory;
  title: string;
  /** A few sentences a child can follow. */
  short: string;
  /** Optional longer explanation for curious players. */
  more: string;
  /** What is made up for the game. */
  fiction: string;
  /** How it was unlocked (shown in the entry). */
  unlockedBy: string;
  source: { label: string; url: string };
}

export const SCIENCE: ScienceEntry[] = [
  {
    id: "hematite",
    category: "geology",
    title: "Blueberries made by water",
    short: "Little grey balls called hematite 'blueberries' formed in water long ago. Rovers found them on Mars.",
    more: "The Opportunity rover found millions of these small hematite spheres at Meridiani Planum. They are one of the clues that liquid water once soaked the rocks there.",
    fiction: "The hematite ledge in Crimson Canyon is a made-up place.",
    unlockedBy: "Found the hematite sample (Crimson Canyon).",
    source: { label: "NASA Science: Meridiani Planum", url: "https://science.nasa.gov/resource/meridiani-planum-2/" },
  },
  {
    id: "marsquakes",
    category: "geology",
    title: "Marsquakes",
    short: "Mars shakes too! A seismometer listens to the ground. NASA's InSight lander heard more than 1,300 marsquakes.",
    more: "Quakes travel through the inside of a planet. By timing them, scientists learned how thick Mars' crust, mantle and core are. InSight also recorded meteorite impacts.",
    fiction: "The canyon seismometer and its recharge post are fictional.",
    unlockedBy: "Woke the old seismometer in Crimson Canyon.",
    source: { label: "NASA: InSight retired after years of science", url: "https://www.nasa.gov/?p=285060" },
  },
  {
    id: "water_ice",
    category: "water",
    title: "Ice under the ground",
    short: "Mars has water ice under its surface and at its poles. Future explorers could use it for drinking water and rocket fuel.",
    more: "In 2008 the Phoenix lander dug up bright ice that slowly vanished into the thin air over four days. Orbiters now map where buried ice is close to the surface.",
    fiction: "The survey caves, the core drill and the melt line are fictional.",
    unlockedBy: "Ran the core drill in the Frozen Depths.",
    source: { label: "NASA: NASA Is Locating Ice on Mars With This New Map", url: "https://www.nasa.gov/solar-system/nasa-is-locating-ice-on-mars-with-this-new-map/" },
  },
  {
    id: "water_loop",
    category: "water",
    title: "Water goes round and round",
    short: "In a base, water is precious. It is cleaned and used again and again instead of being thrown away.",
    more: "A water loop connects the place water comes from (here: melted ice) to a tank and to everything that uses it, like life support and plants. Recovering water means you need to bring or dig up much less.",
    fiction: "The outpost's melt-line processor and tank are simplified game machines.",
    unlockedBy: "Restored the outpost's water circulation.",
    source: { label: "NASA: Water recovery milestone on the ISS", url: "https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station" },
  },
  {
    id: "solar_dust",
    category: "solar",
    title: "Dust and sunlight",
    short: "Solar panels turn sunlight into electricity. Mars dust can cover them and make less power, so clean panels matter.",
    more: "Mars gets less than half the sunlight Earth does. NASA's InSight lander ended its mission in 2022 when dust on its solar panels left it without enough power.",
    fiction: "Sweeping panels with a tail is just for fun! The power numbers in the game are made up.",
    unlockedBy: "The outpost's solar array is working.",
    source: { label: "NASA: InSight retired after years of science", url: "https://www.nasa.gov/?p=285060" },
  },
  {
    id: "battery",
    category: "storage",
    title: "Saving power for later",
    short: "A battery stores spare electricity so machines keep running when the Sun is weak or it is night.",
    more: "Mars rovers use rechargeable lithium-ion batteries. Perseverance's two batteries help when the rover needs more power than its generator gives at that moment.",
    fiction: "Battery units (BU) and the outpost's battery station are made up for the game.",
    unlockedBy: "Restored the Battery Station.",
    source: { label: "NASA JPL: Perseverance power system", url: "https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/spacecraft/power" },
  },
  {
    id: "priority",
    category: "storage",
    title: "Most important first",
    short: "When there is not enough power, the most important machines get it first. Others wait until there is more.",
    more: "Engineers plan power budgets: how much is made, how much is stored, and what each machine needs. When power is short, keeping people safe comes first.",
    fiction: "The Lights Out event and the distribution console are a simplified game puzzle.",
    unlockedBy: "Balanced the power network during Lights Out.",
    source: { label: "NASA JPL: Perseverance power system", url: "https://www.jpl.nasa.gov/news/press_kits/mars_2020/landing/mission/spacecraft/power" },
  },
  {
    id: "water_recovery",
    category: "lifeSupport",
    title: "Recycling water and air",
    short: "On the International Space Station, machines turn used water, even sweat and breath, back into clean drinking water.",
    more: "The station's life support system recovers about 98% of its water. It also makes oxygen to breathe by splitting water with electricity (electrolysis).",
    fiction: "The outpost recycler and its pump cartridge are fictional.",
    unlockedBy: "Started the Life Support Recycler.",
    source: { label: "NASA: Water recovery milestone on the ISS", url: "https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station" },
  },
  {
    id: "plants",
    category: "plants",
    title: "Plants need water and light",
    short: "Plants grow with water and light. In space, special lamps called LEDs give plants the light they need.",
    more: "NASA's Veggie garden on the space station grows lettuce under LED lights. In 2015 astronauts ate red romaine lettuce they had grown there.",
    fiction: "Real plants take weeks to grow. The outpost greenhouse is sped up for the game.",
    unlockedBy: "Planted the first crop in the greenhouse.",
    source: { label: "NASA: Veggie fact sheet", url: "https://www.nasa.gov/wp-content/uploads/2019/04/veggie_fact_sheet_508.pdf" },
  },
  {
    id: "radiation",
    category: "radiation",
    title: "Shelter from space radiation",
    short: "Mars has no magnetic shield and thin air, so more space radiation reaches the ground. Rock and soil above you block some of it.",
    more: "Curiosity's Radiation Assessment Detector (RAD) measured less radiation when the rover parked next to a tall cliff that blocked part of the sky. Thick walls and soil can help protect future explorers.",
    fiction: "The shelter's readings are fictional numbers for a game exercise. No one in the game is ever hurt.",
    unlockedBy: "Restored the radiation shelter's monitor.",
    source: { label: "NASA: How Curiosity is making Mars safer for astronauts", url: "https://www.nasa.gov/missions/mars-science-laboratory/how-nasas-curiosity-rover-is-making-mars-safer-for-astronauts/" },
  },
  {
    id: "relays",
    category: "comms",
    title: "Relays in the sky",
    short: "Rovers send most of their pictures and data up to orbiters, which pass them on to Earth.",
    more: "The Mars Relay Network is a group of orbiters that relay rover data. Orbiters have bigger radios and more power than a rover.",
    fiction: "Echo Ridge's relay tower and the 88-minute signal are fiction.",
    unlockedBy: "Brought the Echo Ridge relay network online.",
    source: { label: "NASA Science: Mars Relay Network", url: "https://science.nasa.gov/mars/mars-relay-network/" },
  },
  {
    id: "delay",
    category: "comms",
    title: "Messages take minutes",
    short: "Radio travels at the speed of light, but Mars is so far away that a message takes minutes to arrive.",
    more: "Depending on where Earth and Mars are in their orbits, a command to a rover takes between about 3 and 22 minutes to arrive.",
    fiction: "The station console's messages arrive instantly in the game.",
    unlockedBy: "Heard the mysterious signal at the Ares Station.",
    source: { label: "NASA Science: Speaking Percy's language", url: "https://science.nasa.gov/missions/mars-2020-perseverance/speaking-percys-language-how-to-talk-so-perseverance-will-listen/" },
  },
];

export const SCIENCE_IDS = new Set(SCIENCE.map((e) => e.id));

export function scienceEntry(id: string): ScienceEntry | undefined {
  return SCIENCE.find((e) => e.id === id);
}
