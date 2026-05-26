import { EARTH_APPROACH_LAYERS } from "@/data/earthApproachStack";
import {
  computeEarthApproachDetail,
  earthApproachState,
  resolveEarthBodyPosition,
} from "@/lib/earthApproach";
import {
  directionToLatLon,
  earthFixedDirection,
} from "@/lib/earth/geodesy";
import type { EarthVeilPhase, ImagineRequest } from "@/lib/ai/imagineTypes";
import { viewerPosition } from "@/lib/viewerState";
import * as THREE from "three";

const _earth = new THREE.Vector3();
const _dir = new THREE.Vector3();

export function isEarthImageryAssistActive(distanceRatio: number): boolean {
  return (
    distanceRatio <= EARTH_APPROACH_LAYERS[0].outerRatio ||
    earthApproachState.active ||
    earthApproachState.phase === "landed"
  );
}

export function readEarthRegionHint(): string {
  const earth = resolveEarthBodyPosition(_earth);
  if (!earth) return "Earth limb — soft blue atmospheric glow";

  earthFixedDirection(viewerPosition, earth, undefined, _dir);
  const { lat, lon } = directionToLatLon(_dir);
  const latBand =
    Math.abs(lat) > 60
      ? "polar"
      : Math.abs(lat) > 30
        ? "mid-latitude"
        : "equatorial";
  const lonBand =
    lon > -30 && lon < 60 ? "Africa–Europe" : lon < -60 ? "Americas" : "Pacific–Asia";
  return `${latBand} ${lonBand} atmosphere — aerial perspective haze only`;
}

export function earthVeilPhaseLabel(phase: EarthVeilPhase): string {
  switch (phase) {
    case "approach-layer":
      return "approach layer crossfade";
    case "tile-blend":
      return "approach transition";
    case "surface-haze":
      return "low-altitude surface haze";
  }
}

export function buildEarthVeilImagineRequest(
  phase: EarthVeilPhase,
  distanceRatio: number,
): ImagineRequest {
  const detail = computeEarthApproachDetail(distanceRatio);

  return {
    scenario: "earthVeil",
    targetId: "earth",
    earthVeilPhase: phase,
    earthRegionHint: readEarthRegionHint(),
    approachLayer: detail.layer,
    aspectRatio: "16:9",
  };
}

export function layerLabel(layer: number): string {
  return EARTH_APPROACH_LAYERS[layer]?.label ?? "approach";
}
