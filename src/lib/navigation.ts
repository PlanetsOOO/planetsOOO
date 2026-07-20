import type { PlanetConfig } from "@/data/planets";
import type { NavTargetId } from "@/data/navigationTargets";
import { isIssTarget, isMoonTarget } from "@/data/navigationTargets";
import { ISS, ISS_VIEW_STANDOFF_UNITS } from "@/data/iss";
import { MOON } from "@/data/moon";
import { placeViewerAtIssStandoff } from "@/lib/issFocusView";
import { SUN_DISPLAY_RADIUS_SCALE } from "@/lib/astronomy/scale";
import * as THREE from "three";

/** Default showcase standoff — closer framing for scenic focus. */
export const ORBIT_VIEW_RADIUS_SCALE = 3;
const OVERSIZED_BODY_RADIUS_UNITS = 200;
const OVERSIZED_BODY_ORBIT_VIEW_RADIUS_SCALE = 14;
const SUN_ORBIT_VIEW_RADIUS_SCALE =
  ORBIT_VIEW_RADIUS_SCALE * SUN_DISPLAY_RADIUS_SCALE;
/** Auto lightspeed when farther than this from the target (scene units). */
export const AUTO_NAV_WARP_DISTANCE = 120;

const _approach = new THREE.Vector3();
const _look = new THREE.Vector3();
const _toBody = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _north = new THREE.Vector3(0, 1, 0);
const _euler = new THREE.Euler(0, 0, 0, "YXZ");

function orbitStandoffUnits(config: PlanetConfig): number {
  const radiusScale =
    config.id === "sun"
      ? SUN_ORBIT_VIEW_RADIUS_SCALE
      : config.radius >= OVERSIZED_BODY_RADIUS_UNITS
      ? OVERSIZED_BODY_ORBIT_VIEW_RADIUS_SCALE
      : ORBIT_VIEW_RADIUS_SCALE;

  return Math.max(
    config.radius * radiusScale,
    config.radius * 2.5 + 2,
  );
}

export function getOrbitStandoffUnits(config: PlanetConfig): number {
  return orbitStandoffUnits(config);
}

/** Place the viewer on a low-inclination orbit shell, approaching from `fromPos`. */
export function getPlanetOrbitApproachPosition(
  planetPos: THREE.Vector3,
  config: PlanetConfig,
  fromPos: THREE.Vector3,
  target = _approach,
): THREE.Vector3 {
  const standoff = orbitStandoffUnits(config);

  _look.subVectors(fromPos, planetPos);
  if (_look.lengthSq() < standoff * standoff * 0.04) {
    _look.set(standoff, config.radius * 0.35, standoff * 0.6);
  } else {
    _look.setLength(standoff);
  }

  _tangent.crossVectors(_north, _look);
  if (_tangent.lengthSq() < 1e-4) {
    _tangent.set(0, 0, 1);
  }
  _tangent.normalize().multiplyScalar(config.radius * 0.15);

  return target.copy(planetPos).add(_look).add(_tangent);
}

export function getApproachPosition(
  planetPos: THREE.Vector3,
  config: PlanetConfig,
  fromPos: THREE.Vector3 = planetPos,
): THREE.Vector3 {
  return getPlanetOrbitApproachPosition(planetPos, config, fromPos);
}

export function getPlanetArrivalDistance(config: PlanetConfig): number {
  const standoff = orbitStandoffUnits(config);
  return Math.max(standoff * 0.12, config.radius * 0.35, 2);
}

export function getArrivalDistanceForTarget(
  targetId: NavTargetId,
  config: PlanetConfig,
): number {
  if (isIssTarget(targetId)) {
    return Math.max(ISS_VIEW_STANDOFF_UNITS * 0.18, ISS.boundingRadius * 6);
  }
  return getPlanetArrivalDistance(config);
}

export function getApproachPositionForTarget(
  targetId: NavTargetId,
  bodyPos: THREE.Vector3,
  fromPos: THREE.Vector3,
  planetConfig?: PlanetConfig,
  target = _approach,
  viewAngles?: { yaw: number; pitch: number; roll?: number },
): THREE.Vector3 {
  if (isMoonTarget(targetId)) {
    return getPlanetOrbitApproachPosition(
      bodyPos,
      { radius: MOON.radius } as PlanetConfig,
      fromPos,
    );
  }
  if (isIssTarget(targetId)) {
    if (viewAngles) {
      return placeViewerAtIssStandoff(
        bodyPos,
        viewAngles.yaw,
        viewAngles.pitch,
        target,
        viewAngles.roll ?? 0,
        ISS_VIEW_STANDOFF_UNITS,
      );
    }
    _toBody.subVectors(bodyPos, fromPos);
    if (_toBody.lengthSq() < ISS_VIEW_STANDOFF_UNITS * ISS_VIEW_STANDOFF_UNITS * 0.04) {
      _toBody.set(ISS_VIEW_STANDOFF_UNITS, ISS.boundingRadius * 2, ISS_VIEW_STANDOFF_UNITS * 0.35);
    } else {
      _toBody.normalize().multiplyScalar(ISS_VIEW_STANDOFF_UNITS);
    }
    return target.copy(bodyPos).sub(_toBody);
  }
  if (!planetConfig) {
    throw new Error("Planet config required for planet approach");
  }
  return getPlanetOrbitApproachPosition(bodyPos, planetConfig, fromPos);
}

export function getLookTarget(planetPos: THREE.Vector3): THREE.Vector3 {
  return _look.copy(planetPos);
}

/** Radians per second for ← / → roll in flight and scenic tour. */
export const CAMERA_ROLL_SPEED = 1.35;

/**
 * Screen-space look input — counter-rotates by roll so trackpad/mouse panning
 * stays aligned with the view instead of the bank angle.
 */
export function applyPovLookDelta(
  deltaX: number,
  deltaY: number,
  yaw: number,
  pitch: number,
  roll: number,
  sensitivity: number,
): { yaw: number; pitch: number } {
  const c = Math.cos(roll);
  const s = Math.sin(roll);
  const localX = deltaX * c + deltaY * s;
  const localY = deltaY * c - deltaX * s;
  return {
    yaw: yaw - localX * sensitivity,
    pitch: pitch - localY * sensitivity,
  };
}

/** Unit look direction from YXZ yaw/pitch/roll (matches Three.js camera rotation). */
export function directionFromAngles(
  yaw: number,
  pitch: number,
  target = new THREE.Vector3(),
  roll = 0,
): THREE.Vector3 {
  return target
    .set(0, 0, -1)
    .applyEuler(_euler.set(pitch, yaw, roll))
    .normalize();
}

/** Camera-right axis from YXZ yaw/pitch/roll. */
export function rightFromAngles(
  yaw: number,
  pitch: number,
  roll: number,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  return target
    .set(1, 0, 0)
    .applyEuler(_euler.set(pitch, yaw, roll))
    .normalize();
}

/** Yaw/pitch for a camera at `cameraPos` looking toward `target`. */
export function cameraAnglesFromPosition(
  cameraPos: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
): { yaw: number; pitch: number } {
  _look.set(
    target.x - cameraPos.x,
    target.y - cameraPos.y,
    target.z - cameraPos.z,
  ).normalize();
  const yaw = Math.atan2(-_look.x, -_look.z);
  const pitch = Math.asin(THREE.MathUtils.clamp(_look.y, -1, 1));
  return { yaw, pitch };
}

/** Yaw/pitch for camera at world origin looking at a world-space point. */
export function cameraAnglesTowardWorldPoint(
  worldTarget: THREE.Vector3,
): { yaw: number; pitch: number } {
  return cameraAnglesFromPosition(new THREE.Vector3(0, 0, 0), worldTarget);
}

/** Apply YXZ rotation to a Three.js camera from yaw/pitch/roll refs. */
export function applyCameraAngles(
  camera: THREE.Camera,
  yaw: number,
  pitch: number,
  roll = 0,
): void {
  camera.rotation.order = "YXZ";
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
  camera.rotation.z = roll;
}
