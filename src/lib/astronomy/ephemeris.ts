import type { PlanetId } from "@/data/planets";
import { ASTRONOMY } from "@/data/astronomy";
import { auToUnits } from "@/lib/astronomy/scale";

/** J2000 osculating elements — NASA/JPL Planetary Fact Sheet (heliocentric ecliptic). */
export interface KeplerianElements {
  /** Semi-major axis (AU) */
  a: number;
  e: number;
  /** Inclination (deg) */
  i: number;
  /** Longitude of ascending node Ω (deg) */
  node: number;
  /** Longitude of perihelion ϖ (deg) */
  peri: number;
  /** Mean longitude L at J2000 (deg) */
  L0: number;
  periodDays: number;
}

export const ORBITAL_ELEMENTS: Record<Exclude<PlanetId, "sun">, KeplerianElements> =
  {
    mercury: {
      a: 0.38709893,
      e: 0.20563069,
      i: 7.00487,
      node: 48.33167,
      peri: 77.45645,
      L0: 252.250323,
      periodDays: 87.969,
    },
    venus: {
      a: 0.72333199,
      e: 0.00677323,
      i: 3.39471,
      node: 76.68069,
      peri: 131.53298,
      L0: 181.979099,
      periodDays: 224.701,
    },
    earth: {
      a: 1.00000261,
      e: 0.01671123,
      i: -0.00001531,
      node: -11.26064,
      peri: 102.94719,
      L0: 100.464571,
      periodDays: 365.256,
    },
    mars: {
      a: 1.52366231,
      e: 0.09341233,
      i: 1.85061,
      node: 49.57854,
      peri: 336.04084,
      L0: 355.45332,
      periodDays: 686.98,
    },
    jupiter: {
      a: 5.20336301,
      e: 0.04839266,
      i: 1.3053,
      node: 100.55615,
      peri: 14.75385,
      L0: 34.40438,
      periodDays: 4332.59,
    },
    saturn: {
      a: 9.53707032,
      e: 0.0541506,
      i: 2.48446,
      node: 113.71504,
      peri: 92.43194,
      L0: 49.94432,
      periodDays: 10_759.22,
    },
    uranus: {
      a: 19.19126393,
      e: 0.04716771,
      i: 0.76986,
      node: 74.22988,
      peri: 170.96424,
      L0: 313.23218,
      periodDays: 30_688.5,
    },
    neptune: {
      a: 30.06896348,
      e: 0.00858587,
      i: 1.76917,
      node: 131.72169,
      peri: 44.97135,
      L0: 304.88003,
      periodDays: 60_182,
    },
  };

const J2000 = 2_451_545.0;
const DEG = Math.PI / 180;

function normalizeDegrees(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

export function julianDate(date: Date): number {
  return date.getTime() / 86_400_000 + 2_440_587.5;
}

function solveKepler(meanAnomalyRad: number, e: number): number {
  let E = meanAnomalyRad;
  for (let i = 0; i < 12; i++) {
    const dE = (E - e * Math.sin(E) - meanAnomalyRad) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-10) break;
  }
  return E;
}

/** Heliocentric ecliptic position (Y = north ecliptic pole) in scene units. */
export function getHeliocentricPosition(
  id: PlanetId,
  _legacyRadius: number,
  date: Date,
  target: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  if (id === "sun") {
    target.x = 0;
    target.y = 0;
    target.z = 0;
    return target;
  }

  const el = ORBITAL_ELEMENTS[id];
  const days = julianDate(date) - J2000;
  const L = normalizeDegrees(el.L0 + (360 / el.periodDays) * days);
  const M = normalizeDegrees(L - el.peri) * DEG;

  const E = solveKepler(M, el.e);
  const sinE = Math.sin(E);
  const cosE = Math.cos(E);
  const rAu = el.a * (1 - el.e * cosE);
  const trueAnomaly = Math.atan2(
    Math.sqrt(1 - el.e * el.e) * sinE,
    cosE - el.e,
  );

  const omega = (el.peri - el.node) * DEG;
  const u = trueAnomaly + omega;
  const cosU = Math.cos(u);
  const sinU = Math.sin(u);
  const cosNode = Math.cos(el.node * DEG);
  const sinNode = Math.sin(el.node * DEG);
  const cosI = Math.cos(el.i * DEG);
  const sinI = Math.sin(el.i * DEG);

  const xEcl =
    rAu * (cosNode * cosU - sinNode * sinU * cosI);
  const yEcl =
    rAu * (sinNode * cosU + cosNode * sinU * cosI);
  const zEcl = rAu * sinU * sinI;

  const scale = auToUnits(1);
  target.x = xEcl * scale;
  target.y = yEcl * scale;
  target.z = zEcl * scale;
  return target;
}

/** Sample one full orbit for path visualization (true Keplerian track). */
export function sampleOrbitPath(
  id: Exclude<PlanetId, "sun">,
  segments: number,
): Float32Array {
  const el = ORBITAL_ELEMENTS[id];
  const epoch = J2000;
  const out = new Float32Array((segments + 1) * 3);
  const pos = { x: 0, y: 0, z: 0 };

  for (let i = 0; i <= segments; i++) {
    const days = (i / segments) * el.periodDays;
    const jd = epoch + days;
    const date = new Date((jd - 2_440_587.5) * 86_400_000);
    getHeliocentricPosition(id, 0, date, pos);
    out[i * 3] = pos.x;
    out[i * 3 + 1] = pos.y;
    out[i * 3 + 2] = pos.z;
  }
  return out;
}

export function getOrbitLongitude(id: PlanetId, date: Date): number {
  if (id === "sun") return 0;
  const el = ORBITAL_ELEMENTS[id];
  const days = julianDate(date) - J2000;
  return normalizeDegrees(el.L0 + (360 / el.periodDays) * days) * DEG;
}

export function greenwichMeanSiderealTime(date: Date): number {
  const jd = julianDate(date);
  const T = (jd - J2000) / 36525;
  const gmst = normalizeDegrees(
    280.460_618_37 +
      360.985_647_366_29 * (jd - J2000) +
      0.000_387_933 * T * T -
      (T * T * T) / 38_710_000,
  );
  return gmst * DEG;
}

export function getRotationAngle(id: PlanetId, date: Date): number {
  if (id === "sun") return 0;
  if (id === "earth") return greenwichMeanSiderealTime(date);

  const astro = ASTRONOMY[id];
  const seconds = Math.abs(astro.rotationPeriodHours) * 3600;
  if (seconds <= 0) return 0;
  const dir = astro.rotationPeriodHours < 0 ? -1 : 1;
  const t = date.getTime() / 1000;
  return dir * ((t / seconds) * Math.PI * 2);
}
