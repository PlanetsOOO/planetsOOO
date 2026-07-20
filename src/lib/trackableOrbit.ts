import {
  ISS_ORBIT_RADIUS_MAX,
  ISS_ORBIT_RADIUS_MIN,
  ISS_ORBIT_SHOWCASE_RADIUS,
} from "@/data/iss";
import type { OrbitFrame } from "@/lib/bodyOrbit";
import { orbitPositionAtPhase } from "@/lib/bodyOrbit";
import { BASE_FOV } from "@/lib/lightspeed";
import { clampTrackableOrbitFov } from "@/lib/scenicOrbitZoom";
import { SCENIC_ORBIT_OMEGA } from "@/lib/scenicTransit";
import * as THREE from "three";

const _offset = new THREE.Vector3();
const _north = new THREE.Vector3(0, 1, 0);
const _tangent = new THREE.Vector3();

type Vec3Like = { x: number; y: number; z: number };

function clampTrackableOrbitRadius(radius: number): number {
  return THREE.MathUtils.clamp(
    radius,
    ISS_ORBIT_RADIUS_MIN,
    ISS_ORBIT_RADIUS_MAX,
  );
}

/** Build an orbital frame for small trackables (km-scale standoff). */
export function captureTrackableOrbitFrame(
  viewerHelio: Vec3Like,
  bodyHelio: Vec3Like,
  preferredRadius: number,
  target: OrbitFrame,
): OrbitFrame {
  _offset.set(
    viewerHelio.x - bodyHelio.x,
    viewerHelio.y - bodyHelio.y,
    viewerHelio.z - bodyHelio.z,
  );

  if (_offset.lengthSq() < 1e-12) {
    _offset.set(preferredRadius, preferredRadius * 0.12, preferredRadius * 0.35);
  }

  target.radius = clampTrackableOrbitRadius(
    Math.max(_offset.length(), preferredRadius * 0.85),
  );
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

/** Orbit radius from scenic FOV — ArrowUp narrows FOV and pulls the camera closer. */
export function getTrackableShowcaseOrbitRadius(
  orbitFov: number,
  baseRadius = ISS_ORBIT_SHOWCASE_RADIUS,
): number {
  const fov = clampTrackableOrbitFov(orbitFov);
  const zoom = BASE_FOV / fov;
  return clampTrackableOrbitRadius(baseRadius / zoom);
}

export function applyTrackableOrbitMotion(
  bodyHelio: Vec3Like,
  frame: OrbitFrame,
  phase: number,
  radius: number,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  return orbitPositionAtPhase(
    bodyHelio,
    { ...frame, radius: clampTrackableOrbitRadius(radius) },
    phase,
    target,
  );
}

export const TRACKABLE_SHOWCASE_OMEGA = SCENIC_ORBIT_OMEGA * 0.55;
