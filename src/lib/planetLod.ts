import * as THREE from "three";

export type LodLevel = 0 | 1 | 2 | 3;

/** True scale only — bodies are never enlarged for visibility. */
export function computeVisibilityScale(
  _distance: number,
  _trueRadius: number,
): number {
  return 1;
}

/** Crossfade factor: 0 = impostor, 1 = full mesh. */
export function computeImpostorMeshBlend(
  angularPx: number,
  forceFullMesh = false,
): number {
  if (forceFullMesh) return 1;
  return THREE.MathUtils.smoothstep(angularPx, 2, 12);
}

export function shouldUseImpostor(
  angularPx: number,
  currentlyUsingImpostor: boolean,
  forceFullMesh = false,
): boolean {
  if (forceFullMesh) return false;
  // Hysteresis keeps fast approaches from flickering at the mesh/impostor cutoff.
  return currentlyUsingImpostor ? angularPx < 4 : angularPx < 1.8;
}

/** Blend between adjacent LOD segment counts for smoother geometry transitions. */
export function blendLodSegments(
  dist: number,
  renderRadius: number,
  segmentsLow: number,
  segmentsHigh: number,
): number {
  const ratio = dist / Math.max(renderRadius, 1e-6);
  const t = 1 - THREE.MathUtils.smoothstep(ratio, 60, 400);
  return Math.round(THREE.MathUtils.lerp(segmentsLow, segmentsHigh, t));
}

export function computeLodLevel(
  distance: number,
  trueRadius: number,
): { level: LodLevel; segments: number } {
  const d = distance / Math.max(trueRadius, 0.001);
  if (d < 60) return { level: 3, segments: 128 };
  if (d < 400) return { level: 2, segments: 64 };
  if (d < 4000) return { level: 1, segments: 32 };
  return { level: 0, segments: 16 };
}

export function getAnisotropyForLod(level: LodLevel): number {
  switch (level) {
    case 3:
      return 16;
    case 2:
      return 8;
    case 1:
      return 4;
    default:
      return 1;
  }
}
