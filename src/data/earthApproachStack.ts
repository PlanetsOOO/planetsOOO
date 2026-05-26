/**
 * Earth approach imagery — orbit shell to birds-eye.
 * Sources: Solar System Scope (visualization-grade) + NASA Blue Marble lineage.
 * Run `./scripts/download-textures.sh` to fetch 4K/8K assets.
 */

export type EarthApproachLayerId =
  | "orbit-shell"
  | "planetary-disk"
  | "continental"
  | "regional"
  | "birds-eye";

export type EarthApproachLayer = {
  id: EarthApproachLayerId;
  /** UI label for the approach HUD. */
  label: string;
  /** Approximate altitude band (km above surface). */
  altitudeLabel: string;
  /** Outer bound: distance from center / Earth radius. */
  outerRatio: number;
  /** Inner bound: distance from center / Earth radius. */
  innerRatio: number;
  /** Diffuse map for this band (lazy-loaded). */
  textureUrl: string;
  /** Descent speed scale vs layer 0 (0–1). */
  speedMultiplier: number;
  segments: number;
};

/** Five bands from orbit zone (20×R) down to just above the surface. */
export const EARTH_APPROACH_LAYERS: readonly EarthApproachLayer[] = [
  {
    id: "orbit-shell",
    label: "Orbit zone",
    altitudeLabel: "90,000–121,000 km",
    outerRatio: 20,
    innerRatio: 15.2,
    textureUrl: "/textures/2k_earth_daymap.jpg",
    speedMultiplier: 1,
    segments: 32,
  },
  {
    id: "planetary-disk",
    label: "Planetary disk",
    altitudeLabel: "58,000–90,000 km",
    outerRatio: 15.2,
    innerRatio: 10.4,
    textureUrl: "/textures/4k_earth_daymap.jpg",
    speedMultiplier: 0.42,
    segments: 48,
  },
  {
    id: "continental",
    label: "Continental",
    altitudeLabel: "29,000–58,000 km",
    outerRatio: 10.4,
    innerRatio: 5.6,
    textureUrl: "/textures/8k_earth_daymap.jpg",
    speedMultiplier: 0.18,
    segments: 64,
  },
  {
    id: "regional",
    label: "Regional",
    altitudeLabel: "11,000–29,000 km",
    outerRatio: 5.6,
    innerRatio: 2.8,
    textureUrl: "/textures/8k_earth_daymap.jpg",
    speedMultiplier: 0.07,
    segments: 96,
  },
  {
    id: "birds-eye",
    label: "Birds-eye",
    altitudeLabel: "130 km–11,000 km",
    outerRatio: 2.8,
    innerRatio: 1.02,
    textureUrl: "/textures/8k_earth_daymap.jpg",
    speedMultiplier: 0.02,
    segments: 128,
  },
] as const;

/** Distance band (center-radius / R) where the Land button is offered. */
export const EARTH_LAND_OFFER_OUTER_RATIO = 8;
export const EARTH_LAND_OFFER_INNER_RATIO = 2.5;

export const EARTH_SURFACE_RATIO = 1.001;

export const EARTH_LANDING_VIEW_RATIO = 1.0015;
