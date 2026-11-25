/**
 * One cohesive palette for the whole game. Laika's colours come straight from the original
 * LAIKA: Mission Red Planet sprite sheet so she stays recognisable.
 */
export const LAIKA_PAL = {
  N: "#2a1a22", // outline / eye / nose
  H: "#7d8fb8", // helmet rim
  G: "#cfe0f7", // helmet glass (drawn translucent)
  L: "#ffffff", // glass highlight
  B: "#8a4a2b", // ears
  O: "#e0903f", // orange fur
  W: "#fff1d0", // cream fur
  P: "#f08a9a", // tongue
  S: "#eef1f6", // suit
  D: "#b9c2d6", // suit shade
  R: "#e2483d", // suit trim
  Y: "#66708c", // steel (backpack / sensor)
  E: "#f2ca76", // yellow
  Z: "#5fb7f0", // sensor light
} as const;

export const C = {
  out: "#2a1a22",
  white: "#ffffff",
  cream: "#fff1d0",
  creamShade: "#e0cfa8",
  suit: "#eef1f6",
  suitShade: "#b9c2d6",
  red: "#e2483d",
  redDark: "#a8322c",
  steelL: "#9aa6c0",
  steel: "#66708c",
  steelD: "#3f4963",
  steelDD: "#2c3347",
  hullL: "#dfe4ee",
  hull: "#c3cad8",
  hullD: "#8e98ae",
  yellow: "#f2ca76",
  yellowD: "#c99a45",
  orange: "#e0903f",
  mint: "#81c995",
  green: "#4fae5d",
  blue: "#2f6fd0",
  blueL: "#6fb1f5",
  water: "#5fb7f0",
  glass: "#8fdcec",
  glassL: "#d6f5fb",
  navy: "#141c32",

  // Mars ground
  crustL: "#ec9a5c",
  crust: "#d9783f",
  soilL: "#c25d35",
  soil: "#a9492c",
  soilD: "#8a3a25",
  soilDD: "#6a2b1e",
  pebble: "#5c241b",
  dust: "#e9a873",

  // Canyon rock
  rockL: "#bf4f40",
  rock: "#9c3734",
  rockD: "#7a292c",
  rockDD: "#561c23",
  strata: "#b04a3b",

  // Cave
  caveL: "#4f2029",
  cave: "#3a1720",
  caveD: "#28101a",

  // Sky and distance
  sky0: "#24183a",
  sky1: "#3d2147",
  sky2: "#64294b",
  sky3: "#9a3c4b",
  sky4: "#cf6a4f",
  sky5: "#eea06a",
  far: "#6a2f4a",
  farL: "#7e3a52",
  mid: "#8a3536",
  midL: "#a5443c",
  midD: "#6c2830",
  near: "#ae5038",
  nearL: "#c4643f",
} as const;
