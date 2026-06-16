import { KM_PER_UNIT } from "@/data/astronomy";
import { MOON_SIDEREAL_PERIOD_DAYS } from "@/lib/astronomy/constants";
import { getHeliocentricPosition, julianDate } from "@/lib/astronomy/ephemeris";
import { getSimulationDate } from "@/lib/simulationTime";
import * as THREE from "three";

const DEG = Math.PI / 180;
const J2000 = 2_451_545.0;

/** Lunar orbital motion vs the shared simulation clock (1 = real-time ephemeris rate). */
export const MOON_ORBIT_TIME_SCALE = 1;

let moonAnchorSimMs: number | null = null;

const frozenGeo = {
  x: 0,
  y: 0,
  z: 0,
  lonDeg: 0,
  latRad: 0,
  distanceKm: 0,
};

let moonOrbitLocked = false;

export function isMoonOrbitLocked(): boolean {
  return moonOrbitLocked;
}

export function lockMoonOrbit(sim = getSimulationDate()): void {
  getGeocentricMoonEclipticKm(getMoonEphemerisDate(sim), frozenGeo);
  moonOrbitLocked = true;
}

export function unlockMoonOrbit(): void {
  moonOrbitLocked = false;
}

function getFrozenGeocentricMoonKm() {
  return frozenGeo;
}

/** Map simulation UTC to a slower Moon ephemeris clock. */
export function getMoonEphemerisDate(sim = getSimulationDate()): Date {
  const t = sim.getTime();
  if (moonAnchorSimMs === null) moonAnchorSimMs = t;
  return new Date(moonAnchorSimMs + (t - moonAnchorSimMs) * MOON_ORBIT_TIME_SCALE);
}

export function resetMoonEphemerisEpoch(sim = getSimulationDate()): void {
  moonAnchorSimMs = sim.getTime();
}

function normalizeDegrees(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Geocentric ecliptic position (km) — Meeus Ch. 47 (moderate precision). */
export function getGeocentricMoonEclipticKm(
  date: Date,
  target = { x: 0, y: 0, z: 0, lonDeg: 0, latRad: 0, distanceKm: 0 },
) {
  const jd = julianDate(date);
  const d = jd - J2000;

  const Lp = normalizeDegrees(218.3164477 + 481267.88123421 * d);
  const D = normalizeDegrees(297.8501921 + 445267.1114034 * d);
  const M = normalizeDegrees(357.5291092 + 35999.0502909 * d);
  const Mp = normalizeDegrees(134.9633964 + 477198.8675055 * d);
  const F = normalizeDegrees(93.272095 + 483202.0175233 * d);

  const LpR = Lp * DEG;
  const DR = D * DEG;
  const MR = M * DEG;
  const MpR = Mp * DEG;
  const FR = F * DEG;

  let lambda =
    Lp +
    6.289 * Math.sin(MpR) +
    1.274 * Math.sin(2 * DR - MpR) +
    0.658 * Math.sin(2 * DR) +
    0.214 * Math.sin(2 * MpR) -
    0.186 * Math.sin(MR) -
    0.114 * Math.sin(2 * FR) +
    0.059 * Math.sin(2 * DR - 2 * MpR) -
    0.057 * Math.sin(LpR - MpR - 2 * DR) +
    0.053 * Math.sin(2 * DR + MpR) -
    0.046 * Math.sin(LpR - MpR + 2 * DR) +
    0.041 * Math.sin(MpR - MR) -
    0.035 * Math.sin(DR) -
    0.031 * Math.sin(MpR + MR) -
    0.015 * Math.sin(2 * FR - 2 * MpR) +
    0.011 * Math.sin(2 * DR - MR - MpR);

  const beta =
    5.128 * Math.sin(FR) +
    0.281 * Math.sin(MpR + FR) +
    0.278 * Math.sin(MpR - FR) +
    0.173 * Math.sin(2 * DR - FR) +
    0.055 * Math.sin(2 * DR + FR - MpR) +
    0.046 * Math.sin(2 * DR - FR - MpR) +
    0.033 * Math.sin(2 * DR + FR) +
    0.017 * Math.sin(2 * MpR + FR);

  const distanceKm =
    385_000.56 -
    20_905.355 * Math.cos(MpR) -
    3_699.111 * Math.cos(2 * DR - MpR) -
    2_955.968 * Math.cos(2 * DR) -
    569.925 * Math.cos(2 * MpR) +
    48.888 * Math.cos(MR) -
    3.149 * Math.cos(2 * FR) +
    24.875 * Math.cos(2 * DR - MpR + MR) +
    14.276 * Math.cos(2 * DR - MR) +
    14.036 * Math.cos(2 * MpR + MR) +
    11.367 * Math.cos(2 * MpR - MR);

  lambda = normalizeDegrees(lambda);
  const betaRad = beta * DEG;
  const lambdaRad = lambda * DEG;
  const cosB = Math.cos(betaRad);

  target.x = distanceKm * cosB * Math.cos(lambdaRad);
  target.y = distanceKm * cosB * Math.sin(lambdaRad);
  target.z = distanceKm * Math.sin(betaRad);
  target.lonDeg = lambda;
  target.latRad = betaRad;
  target.distanceKm = distanceKm;
  return target;
}

const earthHelio = new THREE.Vector3();

/** Heliocentric ecliptic position in legacy scene units (1 unit = 1,000 km). */
export function getMoonHeliocentricPosition(
  date = getSimulationDate(),
  target = new THREE.Vector3(),
): THREE.Vector3 {
  const geo = isMoonOrbitLocked()
    ? getFrozenGeocentricMoonKm()
    : getGeocentricMoonEclipticKm(getMoonEphemerisDate(date));
  getHeliocentricPosition("earth", 0, date, earthHelio);
  return target.set(
    earthHelio.x + geo.x / KM_PER_UNIT,
    earthHelio.y + geo.y / KM_PER_UNIT,
    earthHelio.z + geo.z / KM_PER_UNIT,
  );
}

/** Tidal-lock spin (rad) — sub-Earth longitude. */
export function getMoonRotationAngle(date = getSimulationDate()): number {
  if (isMoonOrbitLocked()) {
    return getFrozenGeocentricMoonKm().lonDeg * DEG;
  }
  return getGeocentricMoonEclipticKm(getMoonEphemerisDate(date)).lonDeg * DEG;
}

/** Sample one lunar orbit around the current Earth position for path visualization. */
export function sampleMoonOrbitPath(
  segments: number,
  date = getSimulationDate(),
): Float32Array {
  const periodDays = MOON_SIDEREAL_PERIOD_DAYS;
  const epochMs = date.getTime();
  const out = new Float32Array((segments + 1) * 3);
  const geo = { x: 0, y: 0, z: 0, lonDeg: 0, latRad: 0, distanceKm: 0 };
  getHeliocentricPosition("earth", 0, date, earthHelio);

  for (let i = 0; i <= segments; i += 1) {
    const sampleDate = new Date(
      epochMs + (i / segments) * periodDays * 86_400_000,
    );
    getGeocentricMoonEclipticKm(sampleDate, geo);
    out[i * 3] = earthHelio.x + geo.x / KM_PER_UNIT;
    out[i * 3 + 1] = earthHelio.y + geo.y / KM_PER_UNIT;
    out[i * 3 + 2] = earthHelio.z + geo.z / KM_PER_UNIT;
  }

  return out;
}
