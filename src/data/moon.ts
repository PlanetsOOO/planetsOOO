import { kmToUnits } from "./astronomy";

/** Earth's Moon — navigable body (not a PlanetId). */
export const MOON = {
  id: "moon" as const,
  name: "Moon",
  texture: "/textures/2k_moon.jpg",
  /** Mean equatorial radius (scene units: 1 unit = 1,000 km). */
  radius: kmToUnits(1737.4),
  color: "#b8b8b8",
  /** Axial tilt (rad). */
  tilt: 0.089,
} as const;

export type MoonId = typeof MOON.id;
