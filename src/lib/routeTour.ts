import type { NavTargetId } from "@/data/navigationTargets";
import type { PlanetConfig } from "@/data/planets";
import { getApproachPositionForTarget } from "@/lib/navigation";
import {
  SCENIC_ORBIT_MIN_SEC,
  SCENIC_ORBIT_MAX_SEC,
  scenicTransitElapsedSec,
} from "@/lib/scenicTransit";
import { isQueuedTargetAlignedBehindCurrent } from "@/lib/discoveryAutopilot";
import * as THREE from "three";

export const routeTourState = {
  observing: false,
  observeStartedMs: 0,
  observeTargetId: null as NavTargetId | null,
  queuedTargetId: null as NavTargetId | null,
  legAdvancePending: false,
  alignmentMs: 0,
  cameraSettleUntilMs: 0,
  approachLocked: false,
  lockedApproachOffset: new THREE.Vector3(),
};

const _approach = new THREE.Vector3();

export function resetRouteTourState(): void {
  routeTourState.observing = false;
  routeTourState.observeStartedMs = 0;
  routeTourState.observeTargetId = null;
  routeTourState.queuedTargetId = null;
  routeTourState.legAdvancePending = false;
  routeTourState.alignmentMs = 0;
  routeTourState.cameraSettleUntilMs = 0;
  routeTourState.approachLocked = false;
  routeTourState.lockedApproachOffset.set(0, 0, 0);
}

export function routeOrbitElapsedSec(now = Date.now()): number {
  if (routeTourState.observeStartedMs <= 0) return 0;
  return (now - routeTourState.observeStartedMs) / 1000;
}

export function beginRouteObserve(
  targetId: NavTargetId,
  nextTargetId?: NavTargetId | null,
): void {
  routeTourState.observing = true;
  routeTourState.observeTargetId = targetId;
  routeTourState.queuedTargetId = nextTargetId ?? null;
  routeTourState.observeStartedMs = Date.now();
  routeTourState.approachLocked = false;
  routeTourState.legAdvancePending = false;
  routeTourState.alignmentMs = 0;
  routeTourState.cameraSettleUntilMs = Date.now() + 3500;
}

export function canRouteDepartOrbit(
  viewer: THREE.Vector3,
  currentPos: THREE.Vector3,
  nextPos: THREE.Vector3 | null,
  now = Date.now(),
): boolean {
  const elapsed = routeOrbitElapsedSec(now);
  if (elapsed < SCENIC_ORBIT_MIN_SEC) return false;
  if (!nextPos || !routeTourState.queuedTargetId) {
    return elapsed >= SCENIC_ORBIT_MIN_SEC;
  }
  if (isQueuedTargetAlignedBehindCurrent(viewer, currentPos, nextPos)) {
    return true;
  }
  return elapsed >= SCENIC_ORBIT_MAX_SEC;
}

export function markRouteDeparture(now = Date.now()): void {
  routeTourState.alignmentMs = now;
}

export function beginRouteTransitLock(
  targetId: NavTargetId,
  bodyPos: THREE.Vector3,
  fromPos: THREE.Vector3,
  planetConfig?: PlanetConfig,
): void {
  routeTourState.approachLocked = true;
  routeTourState.legAdvancePending = false;

  _approach.copy(
    getApproachPositionForTarget(targetId, bodyPos, fromPos, planetConfig),
  );
  routeTourState.lockedApproachOffset.copy(_approach).sub(bodyPos);
}

export function getRouteDesiredPosition(
  targetId: NavTargetId,
  bodyPos: THREE.Vector3,
  fromPos: THREE.Vector3,
  planetConfig?: PlanetConfig,
  target = _approach,
): THREE.Vector3 {
  if (routeTourState.approachLocked) {
    return target.copy(bodyPos).add(routeTourState.lockedApproachOffset);
  }
  return getApproachPositionForTarget(targetId, bodyPos, fromPos, planetConfig);
}

export function routeTransitElapsedSec(now = Date.now()): number {
  return scenicTransitElapsedSec(routeTourState.alignmentMs, now);
}

export function markRouteLegAdvancePending(): boolean {
  if (routeTourState.legAdvancePending) return false;
  routeTourState.legAdvancePending = true;
  return true;
}

export function endRouteObserve(): void {
  routeTourState.observing = false;
  routeTourState.observeStartedMs = 0;
  routeTourState.observeTargetId = null;
  routeTourState.queuedTargetId = null;
  routeTourState.approachLocked = false;
}

/** @deprecated use canRouteDepartOrbit */
export function isRouteObserveComplete(now = Date.now()): boolean {
  return routeOrbitElapsedSec(now) >= SCENIC_ORBIT_MIN_SEC;
}

export function isRouteObserveTarget(id: NavTargetId): boolean {
  return routeTourState.observing && routeTourState.observeTargetId === id;
}

export function routeCameraBlendRate(now = Date.now()): number {
  return now < routeTourState.cameraSettleUntilMs ? 1.6 : 4.2;
}
