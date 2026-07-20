import * as satellite from "satellite.js";
import { KM_PER_UNIT } from "@/data/astronomy";
import { ISS } from "@/data/iss";
import { getHeliocentricPosition } from "@/lib/astronomy/ephemeris";
import { assetUrl } from "@/lib/assetUrl";
import { getSimulationDate } from "@/lib/simulationTime";
import * as THREE from "three";

export type IssState = {
  geocentricUnits: THREE.Vector3;
  velocityKmS: THREE.Vector3;
  altitudeKm: number;
};

let satrec: satellite.SatRec | null = null;
let tleFetchStarted = false;

const frozenGeo = new THREE.Vector3();
const frozenHelio = new THREE.Vector3();
const frozenVel = new THREE.Vector3();
let frozenOrbitEpoch: Date | null = null;
let issOrbitLocked = false;

/** ISS advances slower than real time for legibility (~93 min → ~10 hr visual period at 0.15). */
export const ISS_ORBIT_TIME_SCALE = 0.15;

/** Real-world LEO reference (not scaled): ~7.66 km/s, ~92–93 min per revolution. */
export const ISS_ORBITAL_VELOCITY_KM_S = 7.66;
export const ISS_ORBITAL_PERIOD_MIN = 92.9;

let issAnchorSimMs: number | null = null;

/** Map simulation UTC to a slower ISS ephemeris clock. */
export function getIssEphemerisDate(sim = getSimulationDate()): Date {
  const t = sim.getTime();
  if (issAnchorSimMs === null) issAnchorSimMs = t;
  return new Date(issAnchorSimMs + (t - issAnchorSimMs) * ISS_ORBIT_TIME_SCALE);
}

export function resetIssEphemerisEpoch(sim = getSimulationDate()): void {
  issAnchorSimMs = sim.getTime();
}

function ensureSatrec(): satellite.SatRec {
  if (!satrec) {
    satrec = satellite.twoline2satrec(ISS.fallbackLine1, ISS.fallbackLine2);
  }
  return satrec;
}

export function isIssOrbitLocked(): boolean {
  return issOrbitLocked;
}

export function lockIssOrbit(sim = getSimulationDate()): void {
  getIssHeliocentricPosition(sim, frozenHelio);
  getIssGeocentricPosition(sim, frozenGeo);
  propagateVelocityKmS(getIssEphemerisDate(sim), frozenVel);
  frozenOrbitEpoch = new Date(sim);
  issOrbitLocked = true;
}

export function unlockIssOrbit(): void {
  issOrbitLocked = false;
  frozenOrbitEpoch = null;
}

/** Orbital period from TLE mean motion (seconds). ISS ≈ 93 min. */
export function getIssOrbitalPeriodSec(date = getSimulationDate()): number {
  refreshIssTleFromBundle();
  const rec = ensureSatrec();
  const periodMin = (2 * Math.PI) / rec.no;
  return periodMin * 60;
}

/** Mean motion in revolutions per day (sanity check against TLE field). */
export function getIssMeanMotionRevPerDay(): number {
  refreshIssTleFromBundle();
  const rec = ensureSatrec();
  return (rec.no * 60 * 24) / (2 * Math.PI);
}

/** Load fresher TLE from `/data/iss.tle.json` (non-blocking). */
export function refreshIssTleFromBundle(): void {
  if (tleFetchStarted || typeof fetch === "undefined") return;
  tleFetchStarted = true;
  void fetch(assetUrl("/data/iss.tle.json"))
    .then((res) => (res.ok ? res.json() : null))
    .then((data: { line1?: string; line2?: string } | null) => {
      if (!data?.line1 || !data?.line2) return;
      satrec = satellite.twoline2satrec(data.line1, data.line2);
    })
    .catch(() => {
      /* keep bundled fallback */
    });
}

function propagateGeocentricKm(
  date: Date,
  target = { x: 0, y: 0, z: 0 },
): { x: number; y: number; z: number } | null {
  const result = satellite.propagate(ensureSatrec(), date);
  if (!result?.position) return null;
  target.x = result.position.x;
  target.y = result.position.y;
  target.z = result.position.z;
  return target;
}

function propagateVelocityKmS(
  date: Date,
  target = new THREE.Vector3(),
): THREE.Vector3 | null {
  const result = satellite.propagate(ensureSatrec(), date);
  if (!result?.velocity) return null;
  return target.set(result.velocity.x, result.velocity.y, result.velocity.z);
}

/** Geocentric ECI position in scene units (1 unit = 1,000 km). */
export function getIssGeocentricPosition(
  date = getSimulationDate(),
  target = new THREE.Vector3(),
): THREE.Vector3 {
  if (issOrbitLocked) {
    return target.copy(frozenGeo);
  }
  refreshIssTleFromBundle();
  const km = propagateGeocentricKm(getIssEphemerisDate(date));
  if (!km) return target.set(0, 0, 0);
  return target.set(km.x / KM_PER_UNIT, km.y / KM_PER_UNIT, km.z / KM_PER_UNIT);
}

/** Heliocentric position for rendering and navigation. */
export function getIssHeliocentricPosition(
  date = getSimulationDate(),
  target = new THREE.Vector3(),
): THREE.Vector3 {
  if (issOrbitLocked) {
    return target.copy(frozenHelio);
  }
  const geo = getIssGeocentricPosition(date, target);
  const earth = new THREE.Vector3();
  getHeliocentricPosition("earth", 0, date, earth);
  return geo.add(earth);
}

export function getIssState(
  date = getSimulationDate(),
  out: IssState = {
    geocentricUnits: new THREE.Vector3(),
    velocityKmS: new THREE.Vector3(),
    altitudeKm: 0,
  },
): IssState {
  if (issOrbitLocked) {
    out.geocentricUnits.copy(frozenGeo);
    out.velocityKmS.copy(frozenVel);
    const radiusKm = frozenGeo.length() * KM_PER_UNIT;
    out.altitudeKm = Math.max(0, radiusKm - 6_371);
    return out;
  }
  refreshIssTleFromBundle();
  const ephDate = getIssEphemerisDate(date);
  const km = propagateGeocentricKm(ephDate);
  const vel = propagateVelocityKmS(ephDate, out.velocityKmS);
  if (!km) {
    out.geocentricUnits.set(0, 0, 0);
    out.altitudeKm = 0;
    if (vel) vel.set(0, 0, 0);
    return out;
  }

  out.geocentricUnits.set(km.x / KM_PER_UNIT, km.y / KM_PER_UNIT, km.z / KM_PER_UNIT);
  const radiusKm = Math.hypot(km.x, km.y, km.z);
  out.altitudeKm = Math.max(0, radiusKm - 6_371);
  return out;
}

/** One complete revolution sampled in geocentric scene units. */
export function sampleIssGeocentricOrbitPath(
  segments: number,
  date = getSimulationDate(),
): Float32Array {
  refreshIssTleFromBundle();
  const rec = ensureSatrec();
  const periodMin = (2 * Math.PI) / rec.no;
  const periodMs = periodMin * 60 * 1000;
  const epoch = issOrbitLocked && frozenOrbitEpoch ? frozenOrbitEpoch : date;
  const startMs = epoch.getTime();
  const out = new Float32Array((segments + 1) * 3);
  const scratch = { x: 0, y: 0, z: 0 };

  for (let i = 0; i <= segments; i += 1) {
    const t = new Date(startMs + (i / segments) * periodMs);
    const km = propagateGeocentricKm(t, scratch);
    const offset = i * 3;
    if (!km) {
      out[offset] = 0;
      out[offset + 1] = 0;
      out[offset + 2] = 0;
      continue;
    }
    out[offset] = km.x / KM_PER_UNIT;
    out[offset + 1] = km.y / KM_PER_UNIT;
    out[offset + 2] = km.z / KM_PER_UNIT;
  }

  return out;
}
