import { AU_KM, KM_PER_UNIT } from "@/data/astronomy";

/**
 * Scene scale (NASA/JPL heliocentric kilometers).
 * 1 unit = 1,000 km — see `src/data/astronomy.ts`.
 */

/** Camera far plane — must exceed Neptune aphelion (~4.55×10⁹ km). */
export const RENDER_DISTANCE_UNITS = 50_000_000;

/**
 * Celestial sphere radius (≈334 AU). Stars, DSOs, and the Milky Way sit here —
 * far beyond the planets but inside the clip plane, with zero parallax vs. each other.
 */
export const CELESTIAL_SPHERE_RADIUS = RENDER_DISTANCE_UNITS * 0.98;

/** Neptune semi-major axis (~30.07 AU) for reference. */
export const NEPTUNE_ORBIT_UNITS = 4_495_060;

const DEG = Math.PI / 180;

/** Physical angular radius (rad) of a sphere at distance d. */
export function angularRadius(radiusUnits: number, distanceUnits: number): number {
  const d = Math.max(distanceUnits, radiusUnits * 1.001);
  return Math.asin(Math.min(1, radiusUnits / d));
}

/** Projected angular diameter in screen pixels (perspective camera). */
export function angularDiameterPixels(
  radiusUnits: number,
  distanceUnits: number,
  fovVerticalDeg: number,
  viewportHeightPx: number,
): number {
  const alpha = angularRadius(radiusUnits, distanceUnits);
  const fovRad = fovVerticalDeg * DEG;
  return ((2 * alpha) / fovRad) * viewportHeightPx;
}

/** Parse d3-celestial DSO angular size (arcminutes). */
export function parseDsoArcmin(dim: string | undefined): number {
  if (!dim) return 8;
  const head = dim.split("x")[0]?.trim();
  const v = parseFloat(head);
  return Number.isFinite(v) ? v : 8;
}

/** Celestial object angular size → screen pixels (at infinite distance). */
export function arcminToPixelSize(arcmin: number): number {
  return Math.min(48, Math.max(2, arcmin * 0.22));
}

/** Stellar apparent magnitude → point sprite diameter (px, sizeAttenuation off). */
export function magnitudeToPixelSize(mag: number): number {
  return Math.min(7.5, Math.max(1.1, 6.8 - mag * 0.85));
}

export function auToUnits(au: number): number {
  return (au * AU_KM) / KM_PER_UNIT;
}

export function unitsToAu(units: number): number {
  return (units * KM_PER_UNIT) / AU_KM;
}

/** Celestial sphere radius in interplanetary render units (AU). */
export const CELESTIAL_SPHERE_RADIUS_AU = 400;

/**
 * Visual-only Sun disc enlargement in `bodyRenderRadius`.
 * Keeps true radius in `ASTRONOMY` / navigation; lighting stays at the solar center.
 */
export const SUN_DISPLAY_RADIUS_SCALE = 5;
