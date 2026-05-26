import { ASTRONOMY, kmToUnits } from "./astronomy";

export type PlanetId =
  | "sun"
  | "mercury"
  | "venus"
  | "earth"
  | "mars"
  | "jupiter"
  | "saturn"
  | "uranus"
  | "neptune";

export interface PlanetConfig {
  id: PlanetId;
  name: string;
  texture: string;
  clouds?: string;
  nightMap?: string;
  ringTexture?: string;
  /** True radius in scene units (1 unit = 1,000 km) */
  radius: number;
  /** True semi-major axis in scene units */
  orbitRadius: number;
  tilt: number;
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
}

function body(id: PlanetId, extra: Omit<PlanetConfig, "id" | "radius" | "orbitRadius">): PlanetConfig {
  const astro = ASTRONOMY[id];
  return {
    id,
    radius: kmToUnits(astro.radiusKm),
    orbitRadius: kmToUnits(astro.semiMajorAxisKm),
    ...extra,
  };
}

export const PLANETS: PlanetConfig[] = [
  body("sun", {
    name: "Sun",
    texture: "/textures/2k_sun.jpg",
    tilt: 0,
    color: "#fff8e7",
    emissive: "#ffaa33",
    emissiveIntensity: 1.2,
  }),
  body("mercury", {
    name: "Mercury",
    texture: "/textures/2k_mercury.jpg",
    tilt: 0.03,
    color: "#b5b5b5",
  }),
  body("venus", {
    name: "Venus",
    texture: "/textures/2k_venus_surface.jpg",
    tilt: 3.1,
    color: "#e8cda8",
  }),
  body("earth", {
    name: "Earth",
    texture: "/textures/2k_earth_daymap.jpg",
    clouds: "/textures/2k_earth_clouds.jpg",
    nightMap: "/textures/2k_earth_nightmap.jpg",
    tilt: 0.41,
    color: "#6b93d6",
  }),
  body("mars", {
    name: "Mars",
    texture: "/textures/2k_mars.jpg",
    tilt: 0.44,
    color: "#c1440e",
  }),
  body("jupiter", {
    name: "Jupiter",
    texture: "/textures/2k_jupiter.jpg",
    tilt: 0.05,
    color: "#d4a574",
  }),
  body("saturn", {
    name: "Saturn",
    texture: "/textures/2k_saturn.jpg",
    ringTexture: "/textures/2k_saturn_ring_alpha.png",
    tilt: 0.47,
    color: "#f4e5c3",
  }),
  body("uranus", {
    name: "Uranus",
    texture: "/textures/2k_uranus.jpg",
    tilt: 1.7,
    color: "#b5e8e8",
  }),
  body("neptune", {
    name: "Neptune",
    texture: "/textures/2k_neptune.jpg",
    tilt: 0.49,
    color: "#5b7fde",
  }),
];

export function getPlanet(id: PlanetId): PlanetConfig {
  const planet = PLANETS.find((p) => p.id === id);
  if (!planet) throw new Error(`Unknown planet: ${id}`);
  return planet;
}
