import type { NavTargetId } from "@/data/navigationTargets";
import { isMoonTarget, NAV_TARGETS } from "@/data/navigationTargets";
import type { PlanetConfig } from "@/data/planets";
import { getPlanet } from "@/data/planets";
import { MOON } from "@/data/moon";
import { getHeliocentricPosition } from "@/lib/astronomy/ephemeris";
import { getMoonHeliocentricPosition } from "@/lib/astronomy/moonEphemeris";
import type { OrbitFrame } from "@/lib/bodyOrbit";
import {
  captureOrbitFrame,
  distanceToBodyCenter,
  isWithinOrbitZone,
  orbitZoneMax,
} from "@/lib/bodyOrbit";
import {
  floatingOriginState,
  initializeFloatingOriginAt,
  syncFloatingOrigin,
  updateCoordinateScaleMode,
} from "@/lib/coordinates/frame";
import { idleOrbitState } from "@/lib/idleOrbitState";
import { resetEarthApproach } from "@/lib/earthApproach";
import {
  getApproachPositionForTarget,
  getOrbitStandoffUnits,
  directionFromAngles,
} from "@/lib/navigation";
import { getSimulationDate } from "@/lib/simulationTime";
import { getTargetPosition, setTargetPosition } from "@/lib/targetPositions";
import { viewerPosition } from "@/lib/viewerState";
import {
  SCENIC_DEPART_BLEND_SEC,
  SCENIC_ORBIT_FULL_REV,
  SCENIC_ORBIT_LOOK_DELAY_SEC,
  SCENIC_ORBIT_LOOK_RAMP_SEC,
  SCENIC_ORBIT_MAX_SEC,
  SCENIC_ORBIT_MIN_SEC,
  SCENIC_ORBIT_OMEGA,
  SCENIC_ORBIT_POV_IDLE_SEC,
  SCENIC_ORBIT_SETTLE_SEC,
  SCENIC_PASS_RAMP_SEC,
  SCENIC_PASS_SEC,
  SCENIC_TRANSIT_ETA_SEC,
  SCENIC_TRANSIT_MAX_SEC,
  scenicTransitEtaSec,
  scenicTransitElapsedSec,
} from "@/lib/scenicTransit";
import { BASE_FOV } from "@/lib/lightspeed";
import {
  clampScenicOrbitFov,
  defaultScenicOrbitFov,
  SCENIC_ORBIT_FOV_STEP,
} from "@/lib/scenicOrbitZoom";
import * as THREE from "three";

export const DISCOVERY_TRANSIT_SEC = SCENIC_TRANSIT_ETA_SEC;
export const DISCOVERY_MAX_TRANSIT_SEC = SCENIC_TRANSIT_MAX_SEC;
export const DISCOVERY_ORBIT_DWELL_SEC = SCENIC_ORBIT_MIN_SEC;

/** Max angular separation (rad) for "next body behind current" alignment. */
const ALIGNMENT_MAX_ANGLE_RAD = 0.07;
/** POV / look blend high enough to begin leaving orbit. */
const DEPART_POV_ALIGNMENT = 0.85;
const DEPART_LOOK_BLEND = 0.78;

export type DiscoveryPhase = "idle" | "orbit" | "depart" | "transit";

export const discoveryAutopilotState = {
  active: false,
  phase: "idle" as DiscoveryPhase,
  currentTargetId: null as NavTargetId | null,
  queuedTargetId: null as NavTargetId | null,
  focusTargetId: null as NavTargetId | null,
  focusHandedOff: false,
  cameraSettleUntilMs: 0,
  alignmentMs: 0,
  orbitStartedMs: 0,
  /** Orbit phase (rad) when the current leg's showcase orbit began. */
  orbitStartPhase: 0,
  departStartedMs: 0,
  /** Look blend captured when depart phase begins (continues from orbit). */
  departStartLookBlend: 0,
  /** 0 = look at current body, 1 = look at queued next body. */
  focusLookBlend: 0,
  /** User has manually adjusted POV during orbit. */
  povUserActive: false,
  povLastActivityMs: 0,
  /** Orbit-phase field of view (ArrowUp/Down zoom). */
  orbitFov: BASE_FOV,
  planetOrbitPhase: 0,
  planetOrbitFrame: {
    radius: 0,
    phase: 0,
    u: new THREE.Vector3(1, 0, 0),
    v: new THREE.Vector3(0, 0, 1),
  } satisfies OrbitFrame,
  lockedApproachOffset: new THREE.Vector3(),
  approachLocked: false,
  legAdvancePending: false,
  /** Search bar selection — orbit one body until another pick or Tab. */
  searchFocusLocked: false,
};

export function isSearchFocusActive(): boolean {
  return discoveryAutopilotState.searchFocusLocked;
}

const _approach = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _toCurrent = new THREE.Vector3();
const _toNext = new THREE.Vector3();
const _viewDir = new THREE.Vector3();
const _toTarget = new THREE.Vector3();

export function getOrbitZoneExitDistance(targetId: NavTargetId): number {
  if (isMoonTarget(targetId)) {
    return orbitZoneMax(MOON.radius) * 1.05;
  }
  return orbitZoneMax(getPlanet(targetId).radius) * 1.05;
}

export function isOutsideOrbitZone(
  viewer: THREE.Vector3,
  bodyPos: THREE.Vector3,
  targetId: NavTargetId,
): boolean {
  return (
    distanceToBodyCenter(viewer, bodyPos) >= getOrbitZoneExitDistance(targetId)
  );
}

export function beginDiscoveryDeparture(now = Date.now()): void {
  discoveryAutopilotState.phase = "depart";
  discoveryAutopilotState.departStartedMs = now;
  discoveryAutopilotState.departStartLookBlend =
    discoveryAutopilotState.focusLookBlend;
  discoveryAutopilotState.povUserActive = false;
  discoveryAutopilotState.povLastActivityMs = 0;
  discoveryAutopilotState.legAdvancePending = false;
}

export function markDiscoveryPovActivity(now = Date.now()): void {
  if (!discoveryAutopilotState.active) return;
  if (discoveryAutopilotState.phase !== "orbit") return;
  discoveryAutopilotState.povUserActive = true;
  discoveryAutopilotState.povLastActivityMs = now;
}

/** Autopilot drives camera during orbit unless the user recently moved POV. */
export function shouldDiscoveryAutopilotControlPov(now = Date.now()): boolean {
  if (!discoveryAutopilotState.active) return false;
  if (discoveryAutopilotState.phase !== "orbit") return true;
  if (!discoveryAutopilotState.povUserActive) return true;
  if (
    now - discoveryAutopilotState.povLastActivityMs >=
    SCENIC_ORBIT_POV_IDLE_SEC * 1000
  ) {
    discoveryAutopilotState.povUserActive = false;
    return true;
  }
  return false;
}

export function resetDiscoveryPovOverride(): void {
  discoveryAutopilotState.povUserActive = false;
  discoveryAutopilotState.povLastActivityMs = 0;
}

export function resetDiscoveryOrbitFov(): void {
  discoveryAutopilotState.orbitFov = defaultScenicOrbitFov();
}

/** ArrowUp zooms in, ArrowDown zooms out during scenic orbit. */
export function nudgeScenicOrbitFov(zoom: "in" | "out"): void {
  if (discoveryAutopilotState.phase !== "orbit") return;
  const delta = zoom === "in" ? -SCENIC_ORBIT_FOV_STEP : SCENIC_ORBIT_FOV_STEP;
  discoveryAutopilotState.orbitFov = clampScenicOrbitFov(
    discoveryAutopilotState.orbitFov + delta,
  );
}

export function getDiscoveryOrbitFov(): number {
  return discoveryAutopilotState.orbitFov;
}

export function departElapsedSec(now = Date.now()): number {
  if (discoveryAutopilotState.departStartedMs <= 0) return 0;
  return (now - discoveryAutopilotState.departStartedMs) / 1000;
}

/** Ready to start transit after fly-past completes and look favors the next target. */
export function canDiscoveryBeginTransit(
  yaw?: number,
  pitch?: number,
  queuedPos?: THREE.Vector3 | null,
  currentPos?: THREE.Vector3 | null,
  targetId?: NavTargetId | null,
  now = Date.now(),
): boolean {
  if (discoveryAutopilotState.phase !== "depart") return false;

  const elapsed = departElapsedSec(now);
  let passComplete = elapsed >= SCENIC_PASS_SEC;
  if (currentPos && targetId) {
    passComplete =
      passComplete ||
      isOutsideOrbitZone(viewerPosition, currentPos, targetId);
  }
  if (!passComplete) return false;

  if (discoveryAutopilotState.focusLookBlend >= 0.9) return true;

  if (
    yaw !== undefined &&
    pitch !== undefined &&
    queuedPos &&
    discoveryPovAlignmentTowardTarget(yaw, pitch, queuedPos) >= 0.78
  ) {
    return true;
  }

  return elapsed >= SCENIC_PASS_SEC + SCENIC_DEPART_BLEND_SEC * 0.35;
}

/** How closely the camera POV faces a world target (0–1). */
export function discoveryPovAlignmentTowardTarget(
  yaw: number,
  pitch: number,
  targetPos: THREE.Vector3,
  from = viewerPosition,
): number {
  directionFromAngles(yaw, pitch, _viewDir);
  _toTarget.subVectors(targetPos, from);
  const dist = _toTarget.length();
  if (dist < 1e-6) return 1;
  _toTarget.multiplyScalar(1 / dist);
  const dot = _viewDir.dot(_toTarget);
  return smoothstep01((dot - 0.55) / 0.4);
}

/** Keep look blend in sync when the user steers POV during orbit. */
export function syncDiscoveryFocusFromPov(
  yaw: number,
  pitch: number,
  currentPos: THREE.Vector3,
  nextPos: THREE.Vector3,
): void {
  const towardNext = discoveryPovAlignmentTowardTarget(
    yaw,
    pitch,
    nextPos,
  );
  const towardCurrent = discoveryPovAlignmentTowardTarget(
    yaw,
    pitch,
    currentPos,
  );
  if (towardNext > towardCurrent + 0.05) {
    discoveryAutopilotState.focusLookBlend = Math.max(
      discoveryAutopilotState.focusLookBlend,
      towardNext,
    );
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep01(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

/** How aligned the queued target is for a smooth outbound look shift. */
export function discoveryAlignmentProgress(
  viewer: THREE.Vector3,
  currentPos: THREE.Vector3,
  nextPos: THREE.Vector3,
): number {
  _toCurrent.subVectors(currentPos, viewer);
  _toNext.subVectors(nextPos, viewer);

  const distCurrent = _toCurrent.length();
  const distNext = _toNext.length();
  if (distCurrent < 1e-6 || distNext <= distCurrent * 1.002) return 0;

  _toCurrent.normalize();
  _toNext.normalize();

  const dotT = smoothstep01(( _toCurrent.dot(_toNext) - 0.7) / 0.24);
  const angleT = 1 - smoothstep01(
    _toCurrent.angleTo(_toNext) / (ALIGNMENT_MAX_ANGLE_RAD * 1.6),
  );
  return clamp01(Math.min(dotT, angleT));
}

function smootherstep01(value: number): number {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** True once opening settle is done, dwell passed, and a full revolution is complete. */
export function isDiscoveryOrbitLookAheadActive(now = Date.now()): boolean {
  if (now < discoveryAutopilotState.cameraSettleUntilMs) return false;
  const targetId = discoveryAutopilotState.currentTargetId;
  if (!targetId || !hasDiscoveryCompletedFullOrbit(targetId)) return false;
  return (
    orbitElapsedSec(now) >=
    SCENIC_ORBIT_MIN_SEC + SCENIC_ORBIT_LOOK_DELAY_SEC
  );
}

export function getDiscoveryOrbitPhase(_targetId: NavTargetId): number {
  return discoveryAutopilotState.planetOrbitPhase;
}

/** Progress through one showcase revolution (0–1). */
export function discoveryOrbitRevolutionProgress(targetId: NavTargetId): number {
  let delta =
    getDiscoveryOrbitPhase(targetId) - discoveryAutopilotState.orbitStartPhase;
  while (delta < 0) delta += Math.PI * 2;
  return clamp01(delta / (Math.PI * 2));
}

export function hasDiscoveryCompletedFullOrbit(targetId: NavTargetId): boolean {
  return discoveryOrbitRevolutionProgress(targetId) >= SCENIC_ORBIT_FULL_REV;
}

/** Gradually shift look toward the queued target while orbiting. */
export function updateDiscoveryOrbitLookBlend(
  viewer: THREE.Vector3,
  currentPos: THREE.Vector3,
  nextPos: THREE.Vector3,
  dt: number,
  now = Date.now(),
): number {
  if (!isDiscoveryOrbitLookAheadActive(now)) {
    const reset = 1 - Math.exp(-3 * dt);
    discoveryAutopilotState.focusLookBlend *= 1 - reset;
    return discoveryAutopilotState.focusLookBlend;
  }

  const elapsed = orbitElapsedSec(now);
  const timeT = smootherstep01(
    (elapsed - SCENIC_ORBIT_MIN_SEC - SCENIC_ORBIT_LOOK_DELAY_SEC) /
      SCENIC_ORBIT_LOOK_RAMP_SEC,
  );
  const alignmentT = discoveryAlignmentProgress(viewer, currentPos, nextPos);
  const target = clamp01(Math.max(timeT * 0.45, alignmentT * 0.85));
  const blend = 1 - Math.exp(-0.75 * dt);
  discoveryAutopilotState.focusLookBlend +=
    (target - discoveryAutopilotState.focusLookBlend) * blend;
  return discoveryAutopilotState.focusLookBlend;
}

/** Finish the look shift during orbit→depart (continues from orbit blend). */
export function updateDiscoveryDepartLookBlend(dt: number, now = Date.now()): number {
  if (discoveryAutopilotState.departStartedMs <= 0) {
    return discoveryAutopilotState.focusLookBlend;
  }
  const elapsed = departElapsedSec(now);
  const passT = smootherstep01(elapsed / SCENIC_PASS_SEC);
  const progress = smootherstep01(
    Math.max(passT, elapsed / SCENIC_DEPART_BLEND_SEC),
  );
  const start = discoveryAutopilotState.departStartLookBlend;
  const target = start + (1 - start) * progress;
  const blend = 1 - Math.exp(-1.1 * dt);
  discoveryAutopilotState.focusLookBlend +=
    (target - discoveryAutopilotState.focusLookBlend) * blend;
  return discoveryAutopilotState.focusLookBlend;
}

/** @deprecated use updateDiscoveryDepartLookBlend */
export function updateDiscoveryFocusBlend(now = Date.now()): number {
  return updateDiscoveryDepartLookBlend(1 / 60, now);
}

export function getDiscoveryOrbitRadius(_targetId: NavTargetId): number {
  return discoveryAutopilotState.planetOrbitFrame.radius;
}

/** Outbound fly-past speed — faster than showcase orbit tangential. */
export function discoveryPassSpeed(targetId: NavTargetId): number {
  return SCENIC_ORBIT_OMEGA * getDiscoveryOrbitRadius(targetId) * 2.8;
}

/** @deprecated use discoveryPassSpeed */
export function discoveryEscortSpeed(targetId: NavTargetId): number {
  return discoveryPassSpeed(targetId);
}

/** Ramp fly-past motion during depart. */
export function discoveryPassProgressFactor(now = Date.now()): number {
  return smootherstep01(departElapsedSec(now) / SCENIC_PASS_RAMP_SEC);
}

/** @deprecated use discoveryPassProgressFactor */
export function discoveryDepartEscortFactor(now = Date.now()): number {
  return discoveryPassProgressFactor(now);
}

/** Prograde + outward direction to fly past the current body. */
export function getDiscoveryPassDirection(
  viewer: THREE.Vector3,
  bodyPos: THREE.Vector3,
  targetId: NavTargetId,
  out = _toCurrent,
): THREE.Vector3 {
  const frame = discoveryAutopilotState.planetOrbitFrame;
  const phase = getDiscoveryOrbitPhase(targetId);

  out
    .copy(frame.u)
    .multiplyScalar(-Math.sin(phase))
    .addScaledVector(frame.v, Math.cos(phase));
  if (out.lengthSq() < 1e-8) {
    out.copy(frame.v);
  }
  out.normalize();

  _viewDir.subVectors(viewer, bodyPos);
  if (_viewDir.lengthSq() > 1e-8) {
    _viewDir.normalize();
  } else {
    _viewDir.copy(frame.u);
  }

  _toNext.copy(out).multiplyScalar(0.78).addScaledVector(_viewDir, 0.42).normalize();
  return out.copy(_toNext);
}

/** Camera blend slows as look shifts off the current body. */
export function discoveryOrbitCameraBlendRate(lookBlend: number, now = Date.now()): number {
  const settle = now < discoveryAutopilotState.cameraSettleUntilMs ? 2.2 : 2.8;
  return THREE.MathUtils.lerp(settle, 0.9, clamp01(lookBlend));
}

export function discoveryDepartCameraBlendRate(lookBlend: number): number {
  return THREE.MathUtils.lerp(1.1, 0.72, clamp01(lookBlend));
}

export function pickRandomNavTarget(exclude?: NavTargetId | null): NavTargetId {
  const pool = exclude ? NAV_TARGETS.filter((t) => t.id !== exclude) : NAV_TARGETS;
  return pool[Math.floor(Math.random() * pool.length)].id;
}

/** Nearest searchable body to the viewer (for extension flight idle return). */
export function pickClosestNavTarget(
  from = viewerPosition,
  exclude?: NavTargetId | null,
): NavTargetId {
  let bestId: NavTargetId = NAV_TARGETS[0]?.id ?? "earth";
  let bestDistSq = Infinity;

  for (const target of NAV_TARGETS) {
    if (exclude && target.id === exclude) continue;
    const bodyPos = getTargetPosition(target.id);
    if (!bodyPos) continue;
    const distSq = from.distanceToSquared(bodyPos);
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestId = target.id;
    }
  }

  return bestId;
}

export function queueNextDiscoveryTarget(): NavTargetId {
  if (discoveryAutopilotState.searchFocusLocked) {
    return discoveryAutopilotState.currentTargetId ?? NAV_TARGETS[0].id;
  }
  const next = pickRandomNavTarget(discoveryAutopilotState.currentTargetId);
  discoveryAutopilotState.queuedTargetId = next;
  return next;
}

export function getDiscoveryHudTargetId(): NavTargetId | null {
  if (!discoveryAutopilotState.active) return null;
  return discoveryAutopilotState.currentTargetId;
}

export function discoveryCameraBlendRate(now = Date.now()): number {
  return now < discoveryAutopilotState.cameraSettleUntilMs ? 2.2 : 3.8;
}

export function isQueuedTargetAlignedBehindCurrent(
  viewer: THREE.Vector3,
  currentPos: THREE.Vector3,
  nextPos: THREE.Vector3,
): boolean {
  _toCurrent.subVectors(currentPos, viewer);
  _toNext.subVectors(nextPos, viewer);

  const distCurrent = _toCurrent.length();
  const distNext = _toNext.length();
  if (distCurrent < 1e-6 || distNext <= distCurrent * 1.002) return false;

  _toCurrent.normalize();
  _toNext.normalize();

  if (_toCurrent.dot(_toNext) < 0.94) return false;
  return _toCurrent.angleTo(_toNext) <= ALIGNMENT_MAX_ANGLE_RAD;
}

export function orbitElapsedSec(now = Date.now()): number {
  if (discoveryAutopilotState.orbitStartedMs <= 0) return 0;
  return (now - discoveryAutopilotState.orbitStartedMs) / 1000;
}

/** Orbit showcase has finished its camera settle — body is fully in focus. */
export function isDiscoveryOrbitFocusSettled(now = Date.now()): boolean {
  if (!discoveryAutopilotState.active) return false;
  if (discoveryAutopilotState.phase !== "orbit") return false;
  if (discoveryAutopilotState.orbitStartedMs <= 0) return false;
  return now >= discoveryAutopilotState.cameraSettleUntilMs;
}

/** Leave orbit after a full revolution and POV favors leaving for the next target. */
export function canDiscoveryDepartOrbit(
  viewer: THREE.Vector3,
  currentPos: THREE.Vector3,
  nextPos: THREE.Vector3 | null,
  yaw?: number,
  pitch?: number,
  now = Date.now(),
): boolean {
  if (discoveryAutopilotState.searchFocusLocked) return false;

  const targetId = discoveryAutopilotState.currentTargetId;
  if (!targetId || !hasDiscoveryCompletedFullOrbit(targetId)) return false;

  const elapsed = orbitElapsedSec(now);
  if (elapsed < SCENIC_ORBIT_MIN_SEC) return false;
  if (!nextPos || !discoveryAutopilotState.queuedTargetId) {
    return elapsed >= SCENIC_ORBIT_MIN_SEC + SCENIC_ORBIT_LOOK_DELAY_SEC;
  }
  if (isQueuedTargetAlignedBehindCurrent(viewer, currentPos, nextPos)) {
    return true;
  }
  if (
    isDiscoveryOrbitLookAheadActive(now) &&
    discoveryAutopilotState.focusLookBlend >= DEPART_LOOK_BLEND
  ) {
    return true;
  }
  if (yaw !== undefined && pitch !== undefined) {
    const towardQueued = discoveryPovAlignmentTowardTarget(
      yaw,
      pitch,
      nextPos,
      viewer,
    );
    if (towardQueued >= DEPART_POV_ALIGNMENT) {
      discoveryAutopilotState.focusLookBlend = Math.max(
        discoveryAutopilotState.focusLookBlend,
        towardQueued,
      );
      return true;
    }
  }
  return elapsed >= SCENIC_ORBIT_MAX_SEC;
}

function syncFloatingOriginAtViewer(): void {
  if (!floatingOriginState.initialized) {
    initializeFloatingOriginAt(viewerPosition);
  } else {
    syncFloatingOrigin();
  }
  updateCoordinateScaleMode(getSimulationDate());
}

/** Orbit the chosen body from search until another selection or Tab. */
export function beginSearchFocusAtTarget(targetId: NavTargetId, now = Date.now()): void {
  resetDiscoveryAutopilotState();
  discoveryAutopilotState.active = true;
  discoveryAutopilotState.searchFocusLocked = true;
  discoveryAutopilotState.currentTargetId = targetId;
  discoveryAutopilotState.queuedTargetId = null;

  let bodyPos = getTargetPosition(targetId);
  if (!bodyPos && isMoonTarget(targetId)) {
    getMoonHeliocentricPosition(getSimulationDate(), _approach);
    setTargetPosition(targetId, _approach);
    bodyPos = _approach;
  }
  if (!bodyPos && !isMoonTarget(targetId)) {
    const config = getPlanet(targetId);
    getHeliocentricPosition(
      targetId,
      config.orbitRadius,
      getSimulationDate(),
      _approach,
    );
    setTargetPosition(targetId, _approach);
    bodyPos = _approach;
  }
  if (!bodyPos) {
    resetDiscoveryAutopilotState();
    return;
  }

  const planetConfig = isMoonTarget(targetId)
    ? ({ radius: MOON.radius } as PlanetConfig)
    : getPlanet(targetId);
  const dist = distanceToBodyCenter(viewerPosition, bodyPos);

  if (isWithinOrbitZone(dist, planetConfig.radius)) {
    beginDiscoveryOrbitAtTarget(targetId, now);
    return;
  }

  discoveryAutopilotState.phase = "transit";
  discoveryAutopilotState.orbitStartedMs = 0;
  discoveryAutopilotState.departStartedMs = 0;
  discoveryAutopilotState.departStartLookBlend = 0;
  discoveryAutopilotState.focusLookBlend = 0;
  discoveryAutopilotState.focusTargetId = targetId;
  discoveryAutopilotState.focusHandedOff = false;
  resetDiscoveryPovOverride();
  resetDiscoveryOrbitFov();
  resetDiscoveryLegLock();
  markDiscoveryDeparture(now);
  discoveryAutopilotState.approachLocked = false;
  idleOrbitState.active = false;
  syncFloatingOriginAtViewer();
}

export function beginDiscoveryOrbitAtTarget(targetId: NavTargetId, now = Date.now()): void {
  resetDiscoveryLegLock();

  let bodyPos = getTargetPosition(targetId);
  if (!bodyPos && isMoonTarget(targetId)) {
    getMoonHeliocentricPosition(getSimulationDate(), _approach);
    setTargetPosition(targetId, _approach);
    bodyPos = _approach;
  }
  if (!bodyPos && !isMoonTarget(targetId)) {
    const config = getPlanet(targetId);
    getHeliocentricPosition(
      targetId,
      config.orbitRadius,
      getSimulationDate(),
      _approach,
    );
    setTargetPosition(targetId, _approach);
    bodyPos = _approach;
  }

  if (!bodyPos) return;

  const planetConfig = isMoonTarget(targetId)
    ? ({ radius: MOON.radius } as PlanetConfig)
    : getPlanet(targetId);
  const approach = getApproachPositionForTarget(
    targetId,
    bodyPos,
    viewerPosition,
    planetConfig,
  );
  viewerPosition.copy(approach);

  discoveryAutopilotState.phase = "orbit";
  discoveryAutopilotState.currentTargetId = targetId;
  discoveryAutopilotState.orbitStartedMs = now;
  discoveryAutopilotState.departStartedMs = 0;
  discoveryAutopilotState.departStartLookBlend = 0;
  discoveryAutopilotState.focusLookBlend = 0;
  resetDiscoveryPovOverride();
  resetDiscoveryOrbitFov();
  discoveryAutopilotState.focusTargetId = targetId;
  discoveryAutopilotState.focusHandedOff = false;
  discoveryAutopilotState.cameraSettleUntilMs =
    now + SCENIC_ORBIT_SETTLE_SEC * 1000;
  if (!discoveryAutopilotState.searchFocusLocked) {
    queueNextDiscoveryTarget();
  }

  captureOrbitFrame(
    viewerPosition,
    bodyPos,
    planetConfig.radius,
    discoveryAutopilotState.planetOrbitFrame,
  );
  captureDiscoveryPlanetOrbit(discoveryAutopilotState.planetOrbitFrame, 0);

  discoveryAutopilotState.orbitStartPhase = getDiscoveryOrbitPhase(targetId);

  idleOrbitState.active = false;
  syncFloatingOriginAtViewer();
}

export function captureDiscoveryPlanetOrbit(frame: OrbitFrame, phase = 0): void {
  const target = discoveryAutopilotState.planetOrbitFrame;
  target.radius = frame.radius;
  target.phase = frame.phase;
  target.u.copy(frame.u);
  target.v.copy(frame.v);
  discoveryAutopilotState.planetOrbitPhase = phase;
}

export function resetDiscoveryLegLock(): void {
  discoveryAutopilotState.approachLocked = false;
  discoveryAutopilotState.lockedApproachOffset.set(0, 0, 0);
  discoveryAutopilotState.alignmentMs = 0;
  discoveryAutopilotState.legAdvancePending = false;
}

export function markDiscoveryDeparture(now = Date.now()): void {
  discoveryAutopilotState.alignmentMs = now;
}

export function beginDiscoveryTransitLock(
  targetId: NavTargetId,
  bodyPos: THREE.Vector3,
  fromPos: THREE.Vector3,
  planetConfig?: PlanetConfig,
): void {
  discoveryAutopilotState.approachLocked = true;
  discoveryAutopilotState.legAdvancePending = false;
  _approach.copy(
    getApproachPositionForTarget(targetId, bodyPos, fromPos, planetConfig),
  );
  discoveryAutopilotState.lockedApproachOffset.copy(_approach).sub(bodyPos);
}

/** Transit flies toward the locked orbit approach point (body center before lock). */
export function getDiscoveryDesiredPosition(
  targetId: NavTargetId,
  bodyPos: THREE.Vector3,
  fromPos: THREE.Vector3,
  planetConfig?: PlanetConfig,
  target = _desired,
): THREE.Vector3 {
  if (discoveryAutopilotState.approachLocked) {
    return target.copy(bodyPos).add(discoveryAutopilotState.lockedApproachOffset);
  }
  return getApproachPositionForTarget(targetId, bodyPos, fromPos, planetConfig);
}

/** @deprecated use getDiscoveryDesiredPosition */
export function getDiscoveryTransitTarget(
  bodyPos: THREE.Vector3,
  target = _desired,
): THREE.Vector3 {
  return target.copy(bodyPos);
}

export function getDiscoveryStandoffUnits(
  targetId: NavTargetId,
  planetConfig?: PlanetConfig,
): number {
  if (isMoonTarget(targetId)) {
    return getOrbitStandoffUnits({ radius: MOON.radius } as PlanetConfig);
  }
  if (!planetConfig) return 2;
  return getOrbitStandoffUnits(planetConfig);
}

export function discoveryTransitElapsedSec(now = Date.now()): number {
  return scenicTransitElapsedSec(discoveryAutopilotState.alignmentMs, now);
}

export function shouldDiscoveryArrive(
  distToBody: number,
  standoffUnits: number,
  now = Date.now(),
): boolean {
  if (distToBody <= standoffUnits * 1.06) return true;
  return (
    discoveryTransitElapsedSec(now) >=
    scenicTransitEtaSec(discoveryAutopilotState.searchFocusLocked)
  );
}

export function ensureDiscoveryQueuedTarget(): void {
  if (!discoveryAutopilotState.active) return;
  if (discoveryAutopilotState.searchFocusLocked) return;
  if (
    (discoveryAutopilotState.phase === "orbit" ||
      discoveryAutopilotState.phase === "depart") &&
    !discoveryAutopilotState.queuedTargetId
  ) {
    queueNextDiscoveryTarget();
  }
}

export function resetDiscoveryAutopilotState(): void {
  discoveryAutopilotState.active = false;
  discoveryAutopilotState.phase = "idle";
  discoveryAutopilotState.currentTargetId = null;
  discoveryAutopilotState.queuedTargetId = null;
  discoveryAutopilotState.focusTargetId = null;
  discoveryAutopilotState.focusHandedOff = false;
  discoveryAutopilotState.orbitStartedMs = 0;
  discoveryAutopilotState.orbitStartPhase = 0;
  discoveryAutopilotState.departStartedMs = 0;
  discoveryAutopilotState.departStartLookBlend = 0;
  discoveryAutopilotState.focusLookBlend = 0;
  resetDiscoveryPovOverride();
  resetDiscoveryOrbitFov();
  resetDiscoveryLegLock();
  discoveryAutopilotState.searchFocusLocked = false;
  resetEarthApproach();
}

export function beginDiscoveryOrbitPhase(): void {
  const targetId = discoveryAutopilotState.currentTargetId;
  discoveryAutopilotState.phase = "orbit";
  discoveryAutopilotState.orbitStartedMs = Date.now();
  discoveryAutopilotState.departStartedMs = 0;
  discoveryAutopilotState.departStartLookBlend = 0;
  discoveryAutopilotState.focusLookBlend = 0;
  discoveryAutopilotState.approachLocked = false;
  resetDiscoveryPovOverride();
  resetDiscoveryOrbitFov();
  discoveryAutopilotState.legAdvancePending = false;
  discoveryAutopilotState.focusTargetId = targetId;
  discoveryAutopilotState.focusHandedOff = false;
  discoveryAutopilotState.cameraSettleUntilMs =
    discoveryAutopilotState.orbitStartedMs + SCENIC_ORBIT_SETTLE_SEC * 1000;
  idleOrbitState.active = false;

  if (targetId) {
    const bodyPos = getTargetPosition(targetId);
    if (bodyPos) {
      const radius = isMoonTarget(targetId)
        ? MOON.radius
        : getPlanet(targetId).radius;
      captureOrbitFrame(
        viewerPosition,
        bodyPos,
        radius,
        discoveryAutopilotState.planetOrbitFrame,
      );
      captureDiscoveryPlanetOrbit(discoveryAutopilotState.planetOrbitFrame, 0);
    }
  }

  if (targetId) {
    discoveryAutopilotState.orbitStartPhase = getDiscoveryOrbitPhase(targetId);
  }

  syncFloatingOriginAtViewer();
  if (
    !discoveryAutopilotState.searchFocusLocked &&
    !discoveryAutopilotState.queuedTargetId
  ) {
    queueNextDiscoveryTarget();
  }
}

export function markDiscoveryLegAdvancePending(): boolean {
  if (discoveryAutopilotState.legAdvancePending) return false;
  discoveryAutopilotState.legAdvancePending = true;
  return true;
}

/** @deprecated */
export function isDiscoveryOrbitDwellComplete(now = Date.now()): boolean {
  return orbitElapsedSec(now) >= SCENIC_ORBIT_MIN_SEC;
}
