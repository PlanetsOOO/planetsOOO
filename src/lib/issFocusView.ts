import {
  ISS_ORBIT_SHOWCASE_RADIUS,
  ISS_VIEW_STANDOFF_UNITS,
} from "@/data/iss";
import { directionFromAngles } from "@/lib/navigation";
import {
  applyTrackableOrbitMotion,
  getTrackableShowcaseOrbitRadius,
  TRACKABLE_SHOWCASE_OMEGA,
} from "@/lib/trackableOrbit";
import type { OrbitFrame } from "@/lib/bodyOrbit";
import * as THREE from "three";

const _forward = new THREE.Vector3();
const _standoff = new THREE.Vector3();

/** True when the body lies behind the camera forward axis. */
export function isIssBehindCamera(
  bodyPos: THREE.Vector3,
  viewerPos: THREE.Vector3,
  yaw: number,
  pitch: number,
  roll = 0,
): boolean {
  directionFromAngles(yaw, pitch, _forward, roll);
  _standoff.subVectors(bodyPos, viewerPos);
  if (_standoff.lengthSq() < 1e-18) return false;
  _standoff.normalize();
  return _forward.dot(_standoff) < 0.12;
}

/** Transit standoff — body stays ahead of the camera. */
export function placeViewerAtIssStandoff(
  bodyPos: THREE.Vector3,
  yaw: number,
  pitch: number,
  target: THREE.Vector3,
  roll = 0,
  standoff = ISS_VIEW_STANDOFF_UNITS,
): THREE.Vector3 {
  directionFromAngles(yaw, pitch, _forward, roll);
  return target.copy(bodyPos).addScaledVector(_forward, -standoff);
}

export function maintainIssFocusStandoff(
  bodyPos: THREE.Vector3,
  viewerPos: THREE.Vector3,
  yaw: number,
  pitch: number,
  roll = 0,
  standoff = ISS_VIEW_STANDOFF_UNITS,
  blend = 1,
): void {
  placeViewerAtIssStandoff(bodyPos, yaw, pitch, _standoff, roll, standoff);
  if (blend >= 1) {
    viewerPos.copy(_standoff);
    return;
  }
  viewerPos.lerp(_standoff, blend);
}

/** Scenic orbit showcase around a frozen trackable body. */
export function applyIssShowcaseOrbit(
  bodyPos: THREE.Vector3,
  frame: OrbitFrame,
  phase: number,
  orbitFov: number,
  viewerPos: THREE.Vector3,
): void {
  const radius = getTrackableShowcaseOrbitRadius(orbitFov);
  applyTrackableOrbitMotion(bodyPos, frame, phase, radius, viewerPos);
}

export function advanceIssShowcasePhase(dt: number): number {
  return TRACKABLE_SHOWCASE_OMEGA * dt;
}

export function defaultIssShowcaseRadius(): number {
  return ISS_ORBIT_SHOWCASE_RADIUS;
}
