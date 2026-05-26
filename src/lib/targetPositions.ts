import type { NavTargetId } from "@/data/navigationTargets";
import type { PlanetId } from "@/data/planets";
import * as THREE from "three";

/** Absolute heliocentric positions (scene units). */
export const targetPositions = new Map<NavTargetId, THREE.Vector3>();

export function setTargetPosition(id: NavTargetId, position: THREE.Vector3) {
  const existing = targetPositions.get(id);
  if (existing) {
    existing.copy(position);
  } else {
    targetPositions.set(id, position.clone());
  }
}

export function getTargetPosition(id: NavTargetId): THREE.Vector3 | null {
  return targetPositions.get(id) ?? null;
}

/** @deprecated use setTargetPosition */
export function setPlanetPosition(id: PlanetId, position: THREE.Vector3) {
  setTargetPosition(id, position);
}

/** @deprecated use getTargetPosition */
export function getPlanetPosition(id: PlanetId): THREE.Vector3 | null {
  return getTargetPosition(id);
}

/** Live planet positions map (alias). */
export const planetWorldPositions = targetPositions;
