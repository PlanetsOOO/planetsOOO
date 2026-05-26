import * as THREE from "three";
import type { PlanetId } from "@/data/planets";
import { ORBIT_INACTIVITY_SEC, type OrbitFrame } from "@/lib/bodyOrbit";

/** Shared idle showcase orbit around the nearest / active gravitating body. */
export const idleOrbitState = {
  active: true,
  anchorId: "earth" as PlanetId,
  phase: 0,
  frame: {
    radius: 0,
    phase: 0,
    u: new THREE.Vector3(1, 0, 0),
    v: new THREE.Vector3(0, 0, 1),
  } satisfies OrbitFrame,
  lastActivityMs: 0,
};

export function markIdleOrbitUserActivity(): void {
  idleOrbitState.lastActivityMs = Date.now();
  idleOrbitState.active = false;
}

export function activateIdleOrbit(anchorId: PlanetId): void {
  idleOrbitState.anchorId = anchorId;
  idleOrbitState.active = true;
}

export function isIdleOrbitInactiveLongEnough(now = Date.now()): boolean {
  if (idleOrbitState.lastActivityMs <= 0) return false;
  return (now - idleOrbitState.lastActivityMs) / 1000 >= ORBIT_INACTIVITY_SEC;
}

export function resetIdleOrbitActivityClock(): void {
  idleOrbitState.lastActivityMs = Date.now();
}

/** @deprecated */
export const earthOrbitState = idleOrbitState;
/** @deprecated */
export const markEarthOrbitUserActivity = markIdleOrbitUserActivity;
