import { AU_KM, KM_PER_UNIT } from "@/data/astronomy";
import { angularDiameterPixels } from "@/lib/astronomy/scale";

/** Default near clip in render AU (~15 km). */
export const RENDER_NEAR_AU = 1e-7;

/** On-screen diameter (px) for trackables during focus, transit, and showcase orbit. */
export const TRACKABLE_FOCUS_TARGET_PX = 32;

/** Max scale multiplier while focused (prevents warp at extreme distances). */
export const TRACKABLE_FOCUS_MAX_BOOST = 48;

/** km → render-space AU (camera-relative distances). */
export function kmToRenderAu(km: number): number {
  return (km / KM_PER_UNIT) * (KM_PER_UNIT / AU_KM);
}

/**
 * Dynamic near plane so km-scale trackables are not clipped (~15 km default).
 * `closestDistAu` — camera-space distance to the focused body.
 */
export function getTrackableNearClipAu(closestDistAu?: number): number {
  if (closestDistAu === undefined || !Number.isFinite(closestDistAu)) {
    return RENDER_NEAR_AU;
  }
  if (closestDistAu >= RENDER_NEAR_AU * 1.8) {
    return RENDER_NEAR_AU;
  }
  return Math.max(5e-10, closestDistAu * 0.12);
}

/**
 * Scale geometry to a consistent on-screen size while focused.
 * Transit and showcase orbit share the same target pixel diameter.
 */
export function getTrackableFocusDisplayScale(
  renderRadius: number,
  boundingRadius: number,
  angularPx: number,
  focused: boolean,
): number {
  const base = renderRadius / Math.max(boundingRadius, 1e-12);
  if (!focused) return base;

  const px = Math.max(angularPx, 0.02);
  const boost = Math.min(
    TRACKABLE_FOCUS_MAX_BOOST,
    TRACKABLE_FOCUS_TARGET_PX / px,
  );
  return base * boost;
}

/** Impostor sprite diameter while focused. */
export function getTrackableFocusImpostorPx(
  angularPx: number,
  focused: boolean,
): number {
  if (!focused) return Math.max(6, angularPx);
  return TRACKABLE_FOCUS_TARGET_PX;
}

/** Emissive intensity ramps up on approach and in Earth's shadow. */
export function getTrackableEmissiveIntensity(
  focused: boolean,
  inEarthShadow: boolean,
): number {
  if (!focused) return 0.08;
  if (inEarthShadow) return 0.55;
  return 0.28;
}

/** True when the Sun→ISS segment passes through Earth's disc (simple ray-sphere test). */
export function isTrackableInEarthShadow(
  issHelio: { x: number; y: number; z: number },
  earthHelio: { x: number; y: number; z: number },
  sunHelio: { x: number; y: number; z: number },
  earthRadiusUnits: number,
): boolean {
  const sx = issHelio.x - sunHelio.x;
  const sy = issHelio.y - sunHelio.y;
  const sz = issHelio.z - sunHelio.z;
  const lenSq = sx * sx + sy * sy + sz * sz;
  if (lenSq < 1e-18) return false;

  const ex = earthHelio.x - sunHelio.x;
  const ey = earthHelio.y - sunHelio.y;
  const ez = earthHelio.z - sunHelio.z;
  const t = Math.max(0, Math.min(1, (ex * sx + ey * sy + ez * sz) / lenSq));

  const cx = sunHelio.x + sx * t - earthHelio.x;
  const cy = sunHelio.y + sy * t - earthHelio.y;
  const cz = sunHelio.z + sz * t - earthHelio.z;
  const distSq = cx * cx + cy * cy + cz * cz;
  const r = earthRadiusUnits * 1.02;
  return distSq < r * r;
}

export function trackableShowcaseAngularPx(
  renderRadius: number,
  distAu: number,
  fovDeg: number,
  viewportHeight: number,
  displayScale: number,
  modelSceneScale: number,
): number {
  const effectiveRadius = renderRadius * displayScale * modelSceneScale;
  return angularDiameterPixels(effectiveRadius, distAu, fovDeg, viewportHeight);
}
