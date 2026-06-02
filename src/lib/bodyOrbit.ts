import type { PlanetId } from "@/data/planets";
import { getPlanet } from "@/data/planets";
import { GRAVITATIONAL_PARAMETER_KM3_S2 } from "@/data/astronomy";
import * as THREE from "three";

/** All bodies that support idle showcase orbit. */
export const GRAVITY_BODY_IDS: PlanetId[] = [
  "sun",
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
];

/** Seconds without input before auto-orbit resumes within a body's zone. */
export const ORBIT_INACTIVITY_SEC = 20;

/**
 * Compresses real orbital periods for visible motion.
 * Closer orbits move faster (ω ∝ r^−3/2).
 */
export const ORBIT_VISUAL_TIME_SCALE = 90;

const _offset = new THREE.Vector3();
const _north = new THREE.Vector3(0, 1, 0);
const _tangent = new THREE.Vector3();
const _body = new THREE.Vector3();
const OVERSIZED_BODY_RADIUS_UNITS = 200;
const DEFAULT_ORBIT_RADIUS_SCALE = 6;
const OVERSIZED_BODY_ORBIT_RADIUS_SCALE = 14;

type Vec3Like = { x: number; y: number; z: number };

function copyVec3Like(v: Vec3Like, target = _body): THREE.Vector3 {
  return target.set(v.x, v.y, v.z);
}

export function distanceToBodyCenter(
  viewerHelio: Vec3Like,
  bodyHelio: Vec3Like,
): number {
  return Math.hypot(
    viewerHelio.x - bodyHelio.x,
    viewerHelio.y - bodyHelio.y,
    viewerHelio.z - bodyHelio.z,
  );
}

export function orbitZoneMin(bodyRadiusUnits: number): number {
  return bodyRadiusUnits * 2.5;
}

export function orbitZoneMax(bodyRadiusUnits: number): number {
  return bodyRadiusUnits * 20;
}

export function defaultOrbitRadius(bodyRadiusUnits: number): number {
  const scale =
    bodyRadiusUnits >= OVERSIZED_BODY_RADIUS_UNITS
      ? OVERSIZED_BODY_ORBIT_RADIUS_SCALE
      : DEFAULT_ORBIT_RADIUS_SCALE;
  return Math.max(bodyRadiusUnits * scale, bodyRadiusUnits * 2.5 + 2);
}

export function isWithinOrbitZone(
  distanceUnits: number,
  bodyRadiusUnits: number,
): boolean {
  return (
    distanceUnits >= orbitZoneMin(bodyRadiusUnits) &&
    distanceUnits <= orbitZoneMax(bodyRadiusUnits)
  );
}

/** Circular-orbit angular speed (rad/s) from body gravity at `radiusUnits`. */
export function circularOrbitAngularSpeed(
  radiusUnits: number,
  bodyId: PlanetId,
  bodyRadiusUnits: number,
): number {
  const mu = GRAVITATIONAL_PARAMETER_KM3_S2[bodyId];
  const rKm = Math.max(radiusUnits * 1_000, bodyRadiusUnits * 1_000);
  return Math.sqrt(mu / rKm ** 3);
}

export interface OrbitFrame {
  radius: number;
  phase: number;
  /** Unit vector from body to viewer at phase 0. */
  u: THREE.Vector3;
  /** Unit tangent in the orbital plane (prograde at phase 0). */
  v: THREE.Vector3;
}

export function clampOrbitRadius(
  radius: number,
  bodyRadiusUnits: number,
): number {
  return THREE.MathUtils.clamp(
    radius,
    orbitZoneMin(bodyRadiusUnits),
    orbitZoneMax(bodyRadiusUnits),
  );
}

/** Build an orbital frame from the viewer position relative to a body. */
export function captureOrbitFrame(
  viewerHelio: Vec3Like,
  bodyHelio: Vec3Like,
  bodyRadiusUnits: number,
  target: OrbitFrame,
): OrbitFrame {
  _offset.set(
    viewerHelio.x - bodyHelio.x,
    viewerHelio.y - bodyHelio.y,
    viewerHelio.z - bodyHelio.z,
  );
  target.radius = clampOrbitRadius(_offset.length(), bodyRadiusUnits);

  if (_offset.lengthSq() < 1e-6) {
    const fallback = defaultOrbitRadius(bodyRadiusUnits);
    _offset.set(fallback, 0, 0);
    target.radius = fallback;
  }

  target.u.copy(_offset).normalize();
  _tangent.crossVectors(_north, target.u);
  if (_tangent.lengthSq() < 1e-4) {
    _tangent.set(0, 0, 1);
  }
  _tangent.normalize();
  target.v.crossVectors(target.u, _tangent).normalize();
  if (target.v.lengthSq() < 1e-4) {
    target.v.crossVectors(_north, target.u).normalize();
  }
  target.phase = 0;
  return target;
}

/** Heliocentric viewer position on the circular orbit at `phase`. */
export function orbitPositionAtPhase(
  bodyHelio: Vec3Like,
  frame: OrbitFrame,
  phase: number,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  const r = frame.radius;
  return target
    .copy(frame.u)
    .multiplyScalar(Math.cos(phase) * r)
    .addScaledVector(frame.v, Math.sin(phase) * r)
    .add(copyVec3Like(bodyHelio));
}

/** Default inclined orbit frame for showcase spawn. */
export function defaultOrbitFrame(
  target: OrbitFrame,
  bodyRadiusUnits: number,
): OrbitFrame {
  target.radius = defaultOrbitRadius(bodyRadiusUnits);
  target.phase = 0;
  const inclination = 0.51;
  target.u.set(
    Math.cos(inclination),
    Math.sin(inclination) * 0.35,
    Math.sin(inclination) * 0.94,
  ).normalize();
  target.v.set(-target.u.z, 0.12, target.u.x).normalize();
  return target;
}

export function formatOrbitZoneKm(bodyId: PlanetId): {
  minKm: number;
  maxKm: number;
} {
  const radius = getPlanet(bodyId).radius;
  return {
    minKm: Math.round(orbitZoneMin(radius) * 1_000),
    maxKm: Math.round(orbitZoneMax(radius) * 1_000),
  };
}
