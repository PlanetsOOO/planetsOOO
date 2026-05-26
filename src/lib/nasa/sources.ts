import type { PlanetId } from "@/data/planets";

/** NAIF ID codes for NASA/JPL Horizons */
export const HORIZONS_COMMAND: Record<PlanetId, string> = {
  sun: "10",
  mercury: "199",
  venus: "299",
  earth: "399",
  mars: "499",
  jupiter: "599",
  saturn: "699",
  uranus: "799",
  neptune: "899",
};

/** NASA Science solar system pages (official public outreach data) */
export const NASA_SCIENCE_URL: Record<PlanetId, string> = {
  sun: "https://science.nasa.gov/sun/facts/",
  mercury: "https://science.nasa.gov/mercury/facts/",
  venus: "https://science.nasa.gov/venus/facts/",
  earth: "https://science.nasa.gov/earth/facts/",
  mars: "https://science.nasa.gov/mars/facts/",
  jupiter: "https://science.nasa.gov/jupiter/facts/",
  saturn: "https://science.nasa.gov/saturn/facts/",
  uranus: "https://science.nasa.gov/uranus/facts/",
  neptune: "https://science.nasa.gov/neptune/facts/",
};

export const HORIZONS_API_DOC =
  "https://ssd.jpl.nasa.gov/api/horizons.api";

export function horizonsApiUrl(command: string): string {
  const params = new URLSearchParams({
    format: "json",
    COMMAND: command,
    MAKE_EPHEM: "NO",
    OBJ_DATA: "YES",
  });
  return `${HORIZONS_API_DOC}?${params.toString()}`;
}

/**
 * Semi-major axis (AU) from NASA Planetary Fact Sheet / JPL Horizons orbital data.
 * @see https://science.nasa.gov/solar-system/planets/
 */
export const NASA_SEMIMAJOR_AXIS_AU: Record<PlanetId, number> = {
  sun: 0,
  mercury: 0.387,
  venus: 0.723,
  earth: 1.0,
  mars: 1.524,
  jupiter: 5.203,
  saturn: 9.537,
  uranus: 19.191,
  neptune: 30.069,
};

/** Display names */
export const PLANET_NAMES: Record<PlanetId, string> = {
  sun: "Sun",
  mercury: "Mercury",
  venus: "Venus",
  earth: "Earth",
  mars: "Mars",
  jupiter: "Jupiter",
  saturn: "Saturn",
  uranus: "Uranus",
  neptune: "Neptune",
};
