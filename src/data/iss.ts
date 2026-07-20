import { kmToUnits } from "./astronomy";

/** International Space Station — LEO trackable (CelesTrak NORAD 25544). */
export const ISS = {
  id: "iss" as const,
  name: "ISS",
  noradId: 25544,
  /** Full span along the truss (m). */
  spanMeters: 109,
  /** Bounding sphere radius (~73 m solar-panel span). */
  boundingRadius: kmToUnits(0.075),
  color: "#d8e4f0",
  hullColor: "#c5d2e0",
  moduleColor: "#aebdcb",
  panelColor: "#142238",
  radiatorColor: "#8aa0b8",
  impostorColor: "#eef6ff",
  /** Bundled fallback when `/data/iss.tle.json` is unavailable. */
  fallbackLine1:
    "1 25544U 98067A   26194.12129675  .00004316  00000+0  86456-4 0  9991",
  fallbackLine2:
    "2 25544  51.6304 171.7447 0006685 289.3803  70.6462 15.48996109575778",
} as const;

export type IssId = typeof ISS.id;

/** Scene units from meters (1 unit = 1,000 km). */
export function metersToUnits(meters: number): number {
  return kmToUnits(meters / 1000);
}

/** Transit fly-to standoff from station center. */
export const ISS_VIEW_STANDOFF_UNITS = kmToUnits(30);

/** Scenic showcase orbit radius (~20 km — above ~15 km near-clip). */
export const ISS_ORBIT_SHOWCASE_RADIUS = kmToUnits(20);

/** Arrow-key zoom orbit radius bounds for ISS inspection. */
export const ISS_ORBIT_RADIUS_MIN = kmToUnits(17);
export const ISS_ORBIT_RADIUS_MAX = kmToUnits(35);
