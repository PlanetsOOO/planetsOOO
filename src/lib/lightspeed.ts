/** Lightspeed travel — 1× = physical c; widened FOV for effect (no relativistic distortion). */

import {
  AU_UNITS,
  C_UNITS_PER_S,
  speedMultipleOfC,
} from "@/lib/astronomy/constants";

export { AU_UNITS };

/** Max manual / autopilot cruise at full lightspeed (1× c). */
export const LIGHTSPEED_MAX = C_UNITS_PER_S;

/** Manual ludicrous overdrive — 100× c (Shift+F+W). */
export const LUDICROUS_SPEED_MULTIPLIER = 100;
export const LUDICROUS_SPEED_MAX = LIGHTSPEED_MAX * LUDICROUS_SPEED_MULTIPLIER;

export const BASE_FOV = 55;

/** How quickly manual lightspeed spools up (1/s). */
export const LIGHTSPEED_ACCEL = 5;

/** Ludicrous spool — reaches 100× c faster than 1× c. */
export const LUDICROUS_ACCEL = 8;

/** FOV widens by this many degrees at full lightspeed. */
export const LIGHTSPEED_FOV_WIDEN = 32;

/** Extra FOV at full ludicrous (on top of lightspeed widen). */
export const LUDICROUS_FOV_WIDEN = 28;

/** Autopilot / route warp: lerp rate toward destination (1/s) — legacy fallback. */
export const LIGHTSPEED_AUTOPILOT_RATE = 14;

export function lightspeedTargetFov(intensity: number): number {
  return BASE_FOV + intensity * LIGHTSPEED_FOV_WIDEN;
}

/** 0–1 spool from current speed vs 100× c. */
export function ludicrousIntensity(speed: number): number {
  return Math.min(1, speed / LUDICROUS_SPEED_MAX);
}

export function ludicrousTargetFov(intensity: number): number {
  const ls = lightspeedTargetFov(Math.min(1, intensity * LUDICROUS_SPEED_MULTIPLIER));
  return ls + intensity * LUDICROUS_FOV_WIDEN;
}

/** FOV for manual warp in flight mode. */
export function warpTargetFov(speed: number, ludicrous: boolean): number {
  if (ludicrous) {
    return ludicrousTargetFov(ludicrousIntensity(speed));
  }
  return lightspeedTargetFov(lightspeedIntensity(speed));
}

/** 0–1 spool from current speed vs 1× c. */
export function lightspeedIntensity(speed: number): number {
  return Math.min(1, speed / LIGHTSPEED_MAX);
}

/** Speed as multiples of c. */
export function lightspeedMultiple(speed: number): number {
  return speedMultipleOfC(speed);
}

/** Scale autopilot warp rate by leg distance (short hops stay controlled). */
export function autopilotLightspeedRate(distanceUnits: number): number {
  const au = distanceUnits / AU_UNITS;
  if (au < 0.02) return LIGHTSPEED_AUTOPILOT_RATE * 0.65;
  if (au < 0.25) return LIGHTSPEED_AUTOPILOT_RATE;
  if (au < 2) return LIGHTSPEED_AUTOPILOT_RATE * 1.35;
  return LIGHTSPEED_AUTOPILOT_RATE * 2.2;
}

/** Warp rate to cover ~99.5% of the leg in `etaSec` seconds. */
export function autopilotLightspeedRateForEta(
  distanceUnits: number,
  etaSec: number,
): number {
  void distanceUnits;
  const fraction = 0.995;
  return -Math.log(1 - fraction) / Math.max(etaSec, 8);
}
