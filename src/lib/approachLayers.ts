import { orbitZoneMax } from "@/lib/bodyOrbit";
import * as THREE from "three";

/** Five bands from orbit shell (≈20× radius) down to the surface. */
export const APPROACH_LAYER_COUNT = 5;

/** Matches `orbitZoneMax` — outer edge of the approach stack. */
export const APPROACH_OUTER_RADIUS_RATIO = orbitZoneMax(1);

/** Inner edge — surface contact. */
export const APPROACH_INNER_RADIUS_RATIO = 1;

/** Outer bound of each layer index (distance / body radius). Length = layers + 1. */
export const APPROACH_LAYER_EDGES = [
  APPROACH_OUTER_RADIUS_RATIO,
  15.2,
  10.4,
  5.6,
  2.8,
  APPROACH_INNER_RADIUS_RATIO,
] as const;

/** Primary texture tier per layer: 0 = 2k, 1 = 4k, 2 = 8k. */
export const APPROACH_LAYER_TIER = [0, 0, 1, 1, 2] as const;

/** Sphere segments while in each layer. */
export const APPROACH_LAYER_SEGMENTS = [24, 48, 64, 96, 128] as const;

export type ApproachTierIndex = 0 | 1 | 2;

export type ApproachDetailState = {
  /** True when inside the orbit approach shell. */
  active: boolean;
  layer: number;
  tierA: ApproachTierIndex;
  tierB: ApproachTierIndex;
  /** 0 = tierA only, 1 = tierB only. */
  blend: number;
  segments: number;
  distanceRatio: number;
};

function clampRatio(ratio: number): number {
  return THREE.MathUtils.clamp(
    ratio,
    APPROACH_INNER_RADIUS_RATIO,
    APPROACH_OUTER_RADIUS_RATIO,
  );
}

/** Resolve layer index from distance / body radius. */
export function resolveApproachLayer(distanceRatio: number): number {
  const r = clampRatio(distanceRatio);
  for (let i = 0; i < APPROACH_LAYER_COUNT; i += 1) {
    const inner = APPROACH_LAYER_EDGES[i + 1];
    if (r > inner) return i;
  }
  return APPROACH_LAYER_COUNT - 1;
}

/**
 * Distance-driven detail for approach overlays.
 * Blends adjacent texture tiers through the inner portion of each band.
 */
export function computeApproachDetail(
  distanceRatio: number,
): ApproachDetailState {
  const r = clampRatio(distanceRatio);
  const active = r <= APPROACH_OUTER_RADIUS_RATIO;
  const layer = resolveApproachLayer(r);
  const outer = APPROACH_LAYER_EDGES[layer];
  const inner = APPROACH_LAYER_EDGES[layer + 1];

  const tierA = APPROACH_LAYER_TIER[layer] as ApproachTierIndex;
  let tierB = tierA;
  if (layer < APPROACH_LAYER_COUNT - 1) {
    const nextTier = APPROACH_LAYER_TIER[layer + 1] as ApproachTierIndex;
    tierB = nextTier > tierA ? nextTier : Math.min(tierA + 1, 2) as ApproachTierIndex;
  }

  const span = Math.max(outer - inner, 1e-6);
  const blendSpan = span * 0.38;
  const blend =
    tierA === tierB
      ? 0
      : THREE.MathUtils.clamp(1 - (r - inner) / blendSpan, 0, 1);

  return {
    active,
    layer,
    tierA,
    tierB,
    blend,
    segments: APPROACH_LAYER_SEGMENTS[layer] ?? 128,
    distanceRatio: r,
  };
}
