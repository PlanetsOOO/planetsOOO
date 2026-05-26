import {
  formatSpeedMultiple,
  speedMultipleOfC,
} from "@/lib/astronomy/constants";
import { LIGHTSPEED_MAX } from "@/lib/lightspeed";

/** Minimum time orbiting before departure can be considered (seconds). */
export const SCENIC_ORBIT_MIN_SEC = 18;
/** Fallback if alignment never occurs (seconds). */
export const SCENIC_ORBIT_MAX_SEC = 150;
/** Fraction of 2π required before fly-past (0–1). */
export const SCENIC_ORBIT_FULL_REV = 0.93;
/** Camera settle after entering orbit (seconds). */
export const SCENIC_ORBIT_SETTLE_SEC = 4;
/** Extra dwell on current body before look-ahead begins (seconds). */
export const SCENIC_ORBIT_LOOK_DELAY_SEC = 6;
/** @deprecated use SCENIC_ORBIT_MIN_SEC */
export const SCENIC_ORBIT_DWELL_SEC = SCENIC_ORBIT_MIN_SEC;
/** Transit ETA from alignment moment (seconds). */
export const SCENIC_TRANSIT_ETA_SEC = 38;
/** Hard cap if a leg overruns. */
export const SCENIC_TRANSIT_MAX_SEC = 60;
/** Search-bar fly-to: reach orbit shell within this many seconds. */
export const SEARCH_FOCUS_TRANSIT_ETA_SEC = 6;
/** Hard cap for search fly-to legs. */
export const SEARCH_FOCUS_TRANSIT_MAX_SEC = 10;
/** Ease-in at transit start (matches pass handoff). */
export const SCENIC_DEPART_RAMP_SEC = 7;
/** Look shift during fly-past (seconds). */
export const SCENIC_DEPART_BLEND_SEC = 12;
/** Fly-past the current body before interplanetary leg (seconds). */
export const SCENIC_PASS_SEC = 14;
/** Fly-past speed ramp (seconds). */
export const SCENIC_PASS_RAMP_SEC = 9;
/** @deprecated use SCENIC_PASS_RAMP_SEC */
export const SCENIC_DEPART_ESCORT_RAMP_SEC = SCENIC_PASS_RAMP_SEC;
/** Spread look-ahead toward next target during orbit (seconds). */
export const SCENIC_ORBIT_LOOK_RAMP_SEC = 85;
/** Return to autopilot POV after this much look inactivity (seconds). */
export const SCENIC_ORBIT_POV_IDLE_SEC = 10;
/** Begin slowing within this multiple of orbit standoff. */
export const SCENIC_APPROACH_ZONE_SCALE = 11;
/** Floor on approach speed as a fraction of cruise. */
export const SCENIC_APPROACH_MIN_SPEED = 0.025;

/** Gentle showcase orbit rate (rad/s). */
export const SCENIC_ORBIT_OMEGA = Math.PI / 65;

/** Cap for scenic warp as multiples of c. */
export const SCENIC_MAX_LIGHTSPEED_MULTIPLIER = 50;

/** Legacy aliases */
export const TOUR_TRANSIT_SEC = SCENIC_TRANSIT_ETA_SEC;
export const TOUR_MAX_TRANSIT_SEC = SCENIC_TRANSIT_MAX_SEC;
export const TOUR_OBSERVE_DWELL_SEC = SCENIC_ORBIT_MIN_SEC;
export const TOUR_OBSERVE_ISS_SEC = SCENIC_ORBIT_MIN_SEC;

export function observeDwellSec(): number {
  return SCENIC_ORBIT_MIN_SEC;
}

export function scenicTransitElapsedSec(alignmentMs: number, now = Date.now()): number {
  if (alignmentMs <= 0) return 0;
  return (now - alignmentMs) / 1000;
}

export function scenicTransitEtaSec(searchFocus = false): number {
  return searchFocus ? SEARCH_FOCUS_TRANSIT_ETA_SEC : SCENIC_TRANSIT_ETA_SEC;
}

export function scenicTransitMaxSec(searchFocus = false): number {
  return searchFocus ? SEARCH_FOCUS_TRANSIT_MAX_SEC : SCENIC_TRANSIT_MAX_SEC;
}

export function scenicTransitRemainingSec(
  alignmentMs: number,
  now = Date.now(),
  etaSec = SCENIC_TRANSIT_ETA_SEC,
): number {
  return Math.max(0.25, etaSec - scenicTransitElapsedSec(alignmentMs, now));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smootherstep01(value: number): number {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Ease-in during the first seconds of transit (symmetric to approach ease-out). */
export function scenicTransitDepartEase(
  elapsedSec: number,
  rampSec = SCENIC_DEPART_RAMP_SEC,
): number {
  return smootherstep01(elapsedSec / rampSec);
}

/** Ease-out as the viewer enters the destination orbit shell. */
export function scenicTransitApproachEase(
  distToBody: number,
  standoffUnits: number,
): number {
  const inner = standoffUnits * 0.95;
  const outer = standoffUnits * SCENIC_APPROACH_ZONE_SCALE;
  if (distToBody >= outer) return 1;
  if (distToBody <= inner) return SCENIC_APPROACH_MIN_SPEED;
  const t = (distToBody - inner) / (outer - inner);
  return (
    SCENIC_APPROACH_MIN_SPEED +
    (1 - SCENIC_APPROACH_MIN_SPEED) * smootherstep01(t)
  );
}

/** Combined depart + approach speed multiplier for a scenic leg. */
export function scenicTransitSpeedEnvelope(
  distToBody: number,
  standoffUnits: number,
  elapsedSec: number,
  options?: { searchFocus?: boolean },
): number {
  const approach = scenicTransitApproachEase(distToBody, standoffUnits);
  if (options?.searchFocus) {
    return approach;
  }
  return scenicTransitDepartEase(elapsedSec) * approach;
}

/** Speed (scene units/s) to cover `distanceUnits` within the remaining ETA. */
export function scenicTransitSpeed(
  distanceUnits: number,
  alignmentMs: number,
  now = Date.now(),
  etaSec = SCENIC_TRANSIT_ETA_SEC,
): number {
  const maxSpeed = SCENIC_MAX_LIGHTSPEED_MULTIPLIER * LIGHTSPEED_MAX;
  return Math.min(
    maxSpeed,
    distanceUnits / scenicTransitRemainingSec(alignmentMs, now, etaSec),
  );
}

/** Speed as a multiple of c (1× = lightspeed). */
export function scenicLightspeedMultiple(speedUnitsPerSec: number): number {
  return speedMultipleOfC(speedUnitsPerSec);
}

export function formatScenicLightspeedMultiple(multiple: number): string {
  return formatSpeedMultiple(multiple);
}

export function isScenicTransitExpired(
  alignmentMs: number,
  now = Date.now(),
  maxSec = SCENIC_TRANSIT_MAX_SEC,
): boolean {
  return scenicTransitElapsedSec(alignmentMs, now) >= maxSec;
}

/** @deprecated */
export function scenicRequiredSpeed(
  distanceUnits: number,
  alignmentMs: number,
  now = Date.now(),
): number {
  return scenicTransitSpeed(distanceUnits, alignmentMs, now);
}

/** @deprecated */
export interface ScenicTransitPlan {
  targetSpeed: number;
  ramp: number;
  useWarp: boolean;
  lightspeedMultiple: number;
  cruiseTravelSpeed: number;
}

/** @deprecated */
export function planScenicTransit(
  distanceUnits: number,
  alignmentMs: number,
  now = Date.now(),
): ScenicTransitPlan {
  const targetSpeed = scenicTransitSpeed(distanceUnits, alignmentMs, now);
  const multiple = scenicLightspeedMultiple(targetSpeed);
  return {
    targetSpeed,
    ramp: 1,
    useWarp: multiple >= 1,
    lightspeedMultiple: multiple,
    cruiseTravelSpeed: 1,
  };
}
