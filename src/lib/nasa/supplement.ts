import type { PlanetId } from "@/data/planets";

/**
 * Fields not exposed consistently by Horizons OBJ_DATA.
 * Moon counts and copy align with NASA Science (science.nasa.gov) as of 2025–2026.
 */
export const NASA_SUPPLEMENT: Record<
  PlanetId,
  {
    moons: number;
    description: string;
    missions: string;
    imageryCredit: string;
    imageryUrl: string;
  }
> = {
  sun: {
    moons: 0,
    description:
      "The Sun is a G-type main-sequence star containing more than 99% of the solar system's mass. NASA missions including SDO, Parker Solar Probe, and SOHO study its atmosphere, magnetic field, and space weather.",
    missions: "SDO · Parker Solar Probe · SOHO · Solar Orbiter (ESA/NASA)",
    imageryCredit: "NASA Solar Dynamics Observatory (SDO)",
    imageryUrl: "https://www.nasa.gov/mission_pages/sdo/main/index.html",
  },
  mercury: {
    moons: 0,
    description:
      "Mercury is the smallest planet and the closest to the Sun, with a heavily cratered surface and extreme temperature swings. NASA's MESSENGER and Mariner 10 missions mapped its geology and exosphere.",
    missions: "MESSENGER · Mariner 10",
    imageryCredit: "NASA/USGS MESSENGER global mosaic",
    imageryUrl: "https://science.nasa.gov/mercury/",
  },
  venus: {
    moons: 0,
    description:
      "Venus is wrapped in a thick carbon-dioxide atmosphere with surface pressure ~90 times Earth's. Magellan radar mapped the surface; future NASA missions DAVINCI and VERITAS will study its atmosphere and geology.",
    missions: "Magellan · Parker Solar Probe (flybys) · VERITAS · DAVINCI",
    imageryCredit: "NASA Magellan radar-derived topography",
    imageryUrl: "https://science.nasa.gov/venus/",
  },
  earth: {
    moons: 1,
    description:
      "Earth is the only known world with stable liquid water on its surface and life. NASA's fleet of Earth-observing satellites monitors climate, oceans, ice, and the atmosphere.",
    missions: "Earth Observing System · DSCOVR/EPIC · Terra · Aqua",
    imageryCredit: "NASA Blue Marble Next Generation",
    imageryUrl: "https://visibleearth.nasa.gov/",
  },
  mars: {
    moons: 2,
    description:
      "Mars is a cold desert world with the largest volcano and canyon in the solar system. NASA orbiters, landers, and rovers including Perseverance study its climate history and habitability.",
    missions: "MRO · MAVEN · Perseverance · Curiosity",
    imageryCredit: "NASA/USGS Mars MOLA shaded relief mosaic",
    imageryUrl: "https://science.nasa.gov/mars/",
  },
  jupiter: {
    moons: 95,
    description:
      "Jupiter is the largest planet, a gas giant with banded clouds and a centuries-old storm. NASA's Juno mission measures its gravity, magnetic field, and polar cyclones.",
    missions: "Juno · Galileo · Voyager",
    imageryCredit: "NASA/JPL-Caltech/SwRI Juno imagery",
    imageryUrl: "https://science.nasa.gov/jupiter/",
  },
  saturn: {
    moons: 146,
    description:
      "Saturn is distinguished by its extensive ring system of ice and rock particles. The Cassini-Huygens mission orbited Saturn for 13 years, studying rings, moons, and magnetosphere.",
    missions: "Cassini-Huygens · Voyager",
    imageryCredit: "NASA/JPL-Caltech/SSI Cassini natural-color composites",
    imageryUrl: "https://science.nasa.gov/saturn/",
  },
  uranus: {
    moons: 28,
    description:
      "Uranus is an ice giant rotating on its side, with a methane-rich atmosphere giving a blue-green hue. Voyager 2 is the only spacecraft to have visited the planet.",
    missions: "Voyager 2",
    imageryCredit: "NASA/JPL Voyager 2 calibrated imagery",
    imageryUrl: "https://science.nasa.gov/uranus/",
  },
  neptune: {
    moons: 16,
    description:
      "Neptune is the windiest planet, with supersonic jet streams and a deep blue atmosphere from methane absorption. Voyager 2 flew by in 1989.",
    missions: "Voyager 2",
    imageryCredit: "NASA/JPL Voyager 2 imagery",
    imageryUrl: "https://science.nasa.gov/neptune/",
  },
};
