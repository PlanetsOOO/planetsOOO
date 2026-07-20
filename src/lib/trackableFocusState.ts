import type { NavTargetId } from "@/data/navigationTargets";
import type { OrbitFrame } from "@/lib/bodyOrbit";
import { BASE_FOV } from "@/lib/lightspeed";
import * as THREE from "three";

/** Scenic showcase orbit for small trackables (ISS, future satellites). */
export const trackableFocusState = {
  active: false,
  targetId: null as NavTargetId | null,
  phase: 0,
  orbitFov: BASE_FOV,
  frame: {
    radius: 0,
    phase: 0,
    u: new THREE.Vector3(1, 0, 0),
    v: new THREE.Vector3(0, 0, 1),
  } satisfies OrbitFrame,
};

export function activateTrackableFocus(
  targetId: NavTargetId,
  frame: OrbitFrame,
  phase = 0,
): void {
  trackableFocusState.active = true;
  trackableFocusState.targetId = targetId;
  trackableFocusState.phase = phase;
  trackableFocusState.orbitFov = BASE_FOV;
  copyTrackableFocusFrame(frame);
}

export function deactivateTrackableFocus(): void {
  trackableFocusState.active = false;
  trackableFocusState.targetId = null;
  trackableFocusState.phase = 0;
}

export function copyTrackableFocusFrame(frame: OrbitFrame): void {
  const target = trackableFocusState.frame;
  target.radius = frame.radius;
  target.phase = frame.phase;
  target.u.copy(frame.u);
  target.v.copy(frame.v);
}

export function getTrackableFocusOrbitFov(): number {
  return trackableFocusState.orbitFov;
}

export function setTrackableFocusOrbitFov(fov: number): void {
  trackableFocusState.orbitFov = fov;
}

export function isTrackableFocusOrbitActive(): boolean {
  return trackableFocusState.active;
}
