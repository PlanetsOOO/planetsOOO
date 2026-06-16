import type { NavTargetId } from "@/data/navigationTargets";
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
