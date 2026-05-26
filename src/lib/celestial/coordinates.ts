import * as THREE from "three";

const DEG = Math.PI / 180;

/** Normalize right ascension to [0, 360) degrees. */
export function normalizeRa(raDeg: number): number {
  return ((raDeg % 360) + 360) % 360;
}

/**
 * J2000 equatorial RA/Dec → Cartesian (Y = north celestial pole).
 * RA increases eastward; suitable for an inertial sky dome.
 */
export function raDecToVector3(
  raDeg: number,
  decDeg: number,
  radius: number,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  const ra = normalizeRa(raDeg) * DEG;
  const dec = decDeg * DEG;
  const cosDec = Math.cos(dec);
  return target.set(
    radius * cosDec * Math.cos(ra),
    radius * Math.sin(dec),
    radius * cosDec * Math.sin(ra),
  );
}

/** Apparent magnitude → relative brightness for point sprites. */
export function magnitudeToBrightness(mag: number): number {
  const clamped = THREE.MathUtils.clamp(mag, -1.5, 6.5);
  return THREE.MathUtils.clamp(Math.pow(10, -0.4 * (clamped + 1.2)), 0.12, 1);
}

/** B−V color index → approximate stellar color. */
export function bvToColor(bv: number, target = new THREE.Color()): THREE.Color {
  const t = THREE.MathUtils.clamp((bv + 0.4) / 2.2, 0, 1);
  // Blue (−0.2) → white (0.6) → orange-red (1.8)
  if (t < 0.5) {
    return target.setRGB(0.75 + 0.25 * (1 - t * 2), 0.82 + 0.12 * (1 - t * 2), 1);
  }
  return target.setRGB(1, 0.92 - 0.35 * ((t - 0.5) * 2), 0.78 - 0.45 * ((t - 0.5) * 2));
}

/** Galactic north pole (J2000) for reference / future use. */
export const GALACTIC_NORTH_POLE = { ra: 192.8595, dec: 27.1284 };

/** Galactic center direction (J2000). */
export const GALACTIC_CENTER = { ra: 266.4168, dec: -29.0078 };

/**
 * Solar System Scope equirectangular star maps place RA 0h at the image center
 * with +Dec upward. Three.js sphere UVs use a different seam; this Y rotation
 * aligns the texture with our equatorial frame.
 */
export const MILKY_WAY_Y_ROTATION = Math.PI;
