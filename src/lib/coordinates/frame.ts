import type { PlanetId } from "@/data/planets";
import { ASTRONOMY, AU_KM, KM_PER_UNIT } from "@/data/astronomy";
import { MOON } from "@/data/moon";
import type { NavTargetId } from "@/data/navigationTargets";
import { isMoonTarget } from "@/data/navigationTargets";
import {
  CELESTIAL_SPHERE_RADIUS,
  SUN_DISPLAY_RADIUS_SCALE,
} from "@/lib/astronomy/scale";
import { getSimulationDate } from "@/lib/simulationTime";
import { viewerPosition } from "@/lib/viewerState";
import * as THREE from "three";

/** Absolute positions remain in legacy units (1 unit = 1,000 km). */
export const AU_PER_LEGACY_UNIT = KM_PER_UNIT / AU_KM;

/** Rebase when the viewer drifts this far from the anchor (scene units = 1,000 km). */
export const ORIGIN_REBASE_THRESHOLD = 50_000;

export const floatingOriginState = {
  /** Absolute heliocentric anchor (1 unit = 1,000 km). */
  anchor: new THREE.Vector3(),
  /** Viewer offset from anchor — kept small via rebasing. */
  localOffset: new THREE.Vector3(),
  initialized: false,
};

export function initializeFloatingOriginAt(position = viewerPosition): void {
  floatingOriginState.anchor.copy(position);
  floatingOriginState.localOffset.set(0, 0, 0);
  floatingOriginState.initialized = true;
}

/** Sync local offset from absolute viewer position and rebase if needed. */
export function syncFloatingOrigin(): void {
  if (!floatingOriginState.initialized) {
    initializeFloatingOriginAt();
  }

  floatingOriginState.localOffset
    .copy(viewerPosition)
    .sub(floatingOriginState.anchor);

  if (floatingOriginState.localOffset.length() >= ORIGIN_REBASE_THRESHOLD) {
    floatingOriginState.anchor.add(floatingOriginState.localOffset);
    floatingOriginState.localOffset.set(0, 0, 0);
  }
}

export function updateCoordinateScaleMode(_date = getSimulationDate()): void {}

/** Convert absolute heliocentric position (1,000 km units) to render space. */
export function absoluteToRenderSpace(
  absolute: THREE.Vector3,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  return target
    .copy(absolute)
    .sub(floatingOriginState.anchor)
    .multiplyScalar(AU_PER_LEGACY_UNIT);
}

/** Floating-origin group offset so the viewer sits at the camera origin. */
export function getFloatingOriginOffset(target = new THREE.Vector3()): THREE.Vector3 {
  return target
    .copy(floatingOriginState.localOffset)
    .multiplyScalar(AU_PER_LEGACY_UNIT)
    .negate();
}

/** Camera-relative position for an absolute heliocentric point. */
export function absoluteToCameraSpace(
  absolute: THREE.Vector3,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  return target
    .copy(absolute)
    .sub(viewerPosition)
    .multiplyScalar(AU_PER_LEGACY_UNIT);
}

export function moonRenderRadius(): number {
  return (MOON.radius * KM_PER_UNIT) / AU_KM;
}

export function navTargetRenderRadius(id: NavTargetId): number {
  if (isMoonTarget(id)) return moonRenderRadius();
  return bodyRenderRadius(id);
}

/** Render-space radius for a planet mesh. */
export function bodyRenderRadius(bodyId: PlanetId): number {
  const radiusKm = ASTRONOMY[bodyId].radiusKm;
  const displayScale = bodyId === "sun" ? SUN_DISPLAY_RADIUS_SCALE : 1;
  return (radiusKm / AU_KM) * displayScale;
}

export function getRenderClipPlanes(): { near: number; far: number } {
  return {
    near: 1e-7,
    far: 400,
  };
}

export function getCelestialSphereRadius(): number {
  return 400;
}

/** Scale factor for the celestial sphere mesh built at legacy `CELESTIAL_SPHERE_RADIUS`. */
export function getCelestialSphereScale(): number {
  const target = getCelestialSphereRadius();
  const baseAu = CELESTIAL_SPHERE_RADIUS * AU_PER_LEGACY_UNIT;
  return target / baseAu;
}
