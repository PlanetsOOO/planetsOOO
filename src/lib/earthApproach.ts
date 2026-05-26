import {
  EARTH_APPROACH_LAYERS,
  EARTH_LAND_OFFER_INNER_RATIO,
  EARTH_LAND_OFFER_OUTER_RATIO,
  EARTH_LANDING_VIEW_RATIO,
  EARTH_SURFACE_RATIO,
  type EarthApproachLayer,
} from "@/data/earthApproachStack";
import { getHeliocentricPosition } from "@/lib/astronomy/ephemeris";
import { getPlanet } from "@/data/planets";
import { earthFixedDirectionToHeliocentric } from "@/lib/earth/geodesy";
import { cameraAnglesFromPosition } from "@/lib/navigation";
import { getSimulationDate } from "@/lib/simulationTime";
import { getTargetPosition, setTargetPosition } from "@/lib/targetPositions";
import { viewerPosition } from "@/lib/viewerState";
import * as THREE from "three";

export type EarthApproachPhase = "idle" | "descent" | "cinematic" | "landed";

export type EarthApproachDetail = {
  active: boolean;
  layer: number;
  layerConfig: EarthApproachLayer;
  nextLayerConfig: EarthApproachLayer | null;
  blend: number;
  segments: number;
  distanceRatio: number;
  speedMultiplier: number;
  textureUrl: string;
  nextTextureUrl: string | null;
  altitudeKm: number;
};

export const earthApproachState = {
  active: false,
  phase: "idle" as EarthApproachPhase,
  landingNormal: new THREE.Vector3(1, 0, 0),
  landingEast: new THREE.Vector3(0, 0, 1),
};

const _body = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _east = new THREE.Vector3();
const _tangent = new THREE.Vector3();
const _look = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);

export function resetEarthApproach(): void {
  earthApproachState.active = false;
  earthApproachState.phase = "idle";
}

export function beginEarthDescent(): void {
  earthApproachState.active = true;
  earthApproachState.phase = "descent";
}

export function beginEarthLandCinematic(): void {
  earthApproachState.active = true;
  earthApproachState.phase = "cinematic";
}

export function isEarthLandOfferZone(distanceRatio: number): boolean {
  return (
    distanceRatio <= EARTH_LAND_OFFER_OUTER_RATIO &&
    distanceRatio > EARTH_LAND_OFFER_INNER_RATIO
  );
}

function finalizeLandingOrientation(
  yawRef: { current: number },
  pitchRef: { current: number },
): void {
  _tangent.crossVectors(_normal, _east).normalize();
  _look.copy(viewerPosition).add(_tangent);
  const angles = cameraAnglesFromPosition(viewerPosition, _look);
  yawRef.current = angles.yaw;
  pitchRef.current = THREE.MathUtils.clamp(angles.pitch, -0.12, 0.12);
  earthApproachState.phase = "landed";
  earthApproachState.active = true;
}

export function completeEarthLanding(
  yawRef: { current: number },
  pitchRef: { current: number },
): void {
  const bodyPos = getTargetPosition("earth");
  if (!bodyPos) return;

  const radius = getPlanet("earth").radius;
  _normal.copy(viewerPosition).sub(bodyPos);
  if (_normal.lengthSq() < 1e-8) {
    _normal.set(1, 0, 0);
  } else {
    _normal.normalize();
  }

  earthApproachState.landingNormal.copy(_normal);
  _east.crossVectors(_worldUp, _normal);
  if (_east.lengthSq() < 1e-6) {
    _east.set(0, 0, 1);
  } else {
    _east.normalize();
  }
  earthApproachState.landingEast.copy(_east);

  viewerPosition.copy(bodyPos).addScaledVector(_normal, radius * EARTH_SURFACE_RATIO);

  finalizeLandingOrientation(yawRef, pitchRef);
}

/** Place viewer on surface at a locked earth-fixed lat/lon after cinematic landing. */
export function completeEarthLandingAtLatLon(
  latDeg: number,
  lonDeg: number,
  yawRef: { current: number },
  pitchRef: { current: number },
): void {
  const bodyPos = getTargetPosition("earth");
  if (!bodyPos) return;

  const radius = getPlanet("earth").radius;
  earthFixedDirectionToHeliocentric(latDeg, lonDeg, undefined, _normal);
  _normal.normalize();

  earthApproachState.landingNormal.copy(_normal);
  _east.crossVectors(_worldUp, _normal);
  if (_east.lengthSq() < 1e-6) {
    _east.set(0, 0, 1);
  } else {
    _east.normalize();
  }
  earthApproachState.landingEast.copy(_east);

  viewerPosition.copy(bodyPos).addScaledVector(_normal, radius * EARTH_SURFACE_RATIO);
  finalizeLandingOrientation(yawRef, pitchRef);
}

export function getEarthBodyRadius(): number {
  return getPlanet("earth").radius;
}

export function getEarthDistanceRatio(
  viewer = viewerPosition,
  bodyPos = getTargetPosition("earth") ?? _body,
): number {
  if (!bodyPos) return Number.POSITIVE_INFINITY;
  return viewer.distanceTo(bodyPos) / getEarthBodyRadius();
}

export function computeEarthApproachDetail(
  distanceRatio: number,
): EarthApproachDetail {
  const radius = getEarthBodyRadius();
  const r = THREE.MathUtils.clamp(
    distanceRatio,
    EARTH_SURFACE_RATIO,
    EARTH_APPROACH_LAYERS[0].outerRatio,
  );

  let layer = EARTH_APPROACH_LAYERS.length - 1;
  for (let i = 0; i < EARTH_APPROACH_LAYERS.length; i += 1) {
    if (r <= EARTH_APPROACH_LAYERS[i].outerRatio && r > EARTH_APPROACH_LAYERS[i].innerRatio) {
      layer = i;
      break;
    }
  }

  const layerConfig = EARTH_APPROACH_LAYERS[layer];
  const nextLayerConfig =
    layer < EARTH_APPROACH_LAYERS.length - 1
      ? EARTH_APPROACH_LAYERS[layer + 1]
      : null;

  const span = Math.max(layerConfig.outerRatio - layerConfig.innerRatio, 1e-6);
  const blendSpan = span * 0.58;
  const blend =
    nextLayerConfig &&
    layerConfig.textureUrl !== nextLayerConfig.textureUrl
      ? THREE.MathUtils.clamp(1 - (r - layerConfig.innerRatio) / blendSpan, 0, 1)
      : nextLayerConfig
        ? THREE.MathUtils.clamp(1 - (r - layerConfig.innerRatio) / blendSpan, 0, 1) * 0.35
        : 0;

  const altitudeKm = Math.max(0, (r - 1) * radius * 1_000);

  return {
    active: r <= EARTH_APPROACH_LAYERS[0].outerRatio,
    layer,
    layerConfig,
    nextLayerConfig,
    blend,
    segments: layerConfig.segments,
    distanceRatio: r,
    speedMultiplier: layerConfig.speedMultiplier,
    textureUrl: layerConfig.textureUrl,
    nextTextureUrl: nextLayerConfig?.textureUrl ?? null,
    altitudeKm,
  };
}

export function isEarthLandingPhase(distanceRatio: number): boolean {
  return distanceRatio <= EARTH_LANDING_VIEW_RATIO;
}

export function getEarthDescentTargetRatio(_detail: EarthApproachDetail): number {
  return EARTH_SURFACE_RATIO;
}

/** Radial descent speed (scene units/s) for the current band. */
export function getEarthDescentSpeed(detail: EarthApproachDetail): number {
  const base = getPlanet("earth").radius * 0.42;
  const landingScale = isEarthLandingPhase(detail.distanceRatio) ? 0.35 : 1;
  return base * detail.speedMultiplier * landingScale;
}

export function resolveEarthBodyPosition(target = _body): THREE.Vector3 | null {
  const live = getTargetPosition("earth");
  if (live) return target.copy(live);
  getHeliocentricPosition("earth", 0, getSimulationDate(), target);
  setTargetPosition("earth", target);
  return target;
}
