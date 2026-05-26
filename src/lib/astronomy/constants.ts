/**
 * Canonical physical constants for simulation scale and travel-time math.
 * 1 scene unit = 1,000 km (`KM_PER_UNIT` in `@/data/astronomy`).
 */
import { AU_KM, KM_PER_UNIT, kmToUnits } from "@/data/astronomy";

/** Speed of light (km/s) — CODATA exact. */
export const C_KM_S = 299_792.458;

/** Speed of light in scene units per second (1× lightspeed). */
export const C_UNITS_PER_S = C_KM_S / KM_PER_UNIT;

/** One astronomical unit in scene units. */
export const AU_UNITS = kmToUnits(AU_KM);

/** Light travel time across 1 AU (seconds) — Earth–Sun ≈ 8m 19s. */
export const AU_LIGHT_SECONDS = AU_KM / C_KM_S;

/** Lunar sidereal month (days). */
export const MOON_SIDEREAL_PERIOD_DAYS = 27.321661;

export function lightTimeSeconds(distanceKm: number): number {
  return distanceKm / C_KM_S;
}

export function lightTimeFromUnits(distanceUnits: number): number {
  return lightTimeSeconds(distanceUnits * KM_PER_UNIT);
}

/** Speed as a multiple of c (1.0 = lightspeed). */
export function speedMultipleOfC(unitsPerSec: number): number {
  return unitsPerSec / C_UNITS_PER_S;
}

/** Speed (units/s) required to cover `distanceUnits` in `etaSec` seconds. */
export function speedForEta(distanceUnits: number, etaSec: number): number {
  return distanceUnits / Math.max(etaSec, 1e-6);
}

/** c-multiple needed to traverse `distanceUnits` within `etaSec`. */
export function cMultipleForEta(distanceUnits: number, etaSec: number): number {
  return speedMultipleOfC(speedForEta(distanceUnits, etaSec));
}

export function formatLightTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}h ${min}m` : `${h}h`;
}

export function formatSpeedMultiple(multiple: number): string {
  if (multiple >= 100) return `${Math.round(multiple)}×`;
  if (multiple >= 10) return `${Math.round(multiple)}×`;
  if (multiple >= 1) return `${multiple.toFixed(1)}×`;
  return `${multiple.toFixed(2)}×`;
}

export type AstronomyScaleCheck = {
  name: string;
  expected: number;
  actual: number;
  tolerance: number;
  unit: string;
};

/** Runtime self-check — call from dev tools or the verify script. */
export function astronomyScaleChecks(): AstronomyScaleCheck[] {
  const earthSunLightSec = lightTimeFromUnits(AU_UNITS);
  return [
    {
      name: "c (km/s)",
      expected: 299_792.458,
      actual: C_UNITS_PER_S * KM_PER_UNIT,
      tolerance: 0.001,
      unit: "km/s",
    },
    {
      name: "1 AU (units)",
      expected: AU_KM / KM_PER_UNIT,
      actual: AU_UNITS,
      tolerance: 0.01,
      unit: "units",
    },
    {
      name: "Earth–Sun light time",
      expected: AU_LIGHT_SECONDS,
      actual: earthSunLightSec,
      tolerance: 0.5,
      unit: "s",
    },
    {
      name: "Earth–Sun light time (minutes)",
      expected: 499 / 60,
      actual: earthSunLightSec / 60,
      tolerance: 0.02,
      unit: "min",
    },
  ];
}

export function assertAstronomyScale(): void {
  const failures: string[] = [];
  for (const check of astronomyScaleChecks()) {
    if (Math.abs(check.actual - check.expected) > check.tolerance) {
      failures.push(
        `${check.name}: expected ${check.expected}${check.unit}, got ${check.actual}${check.unit}`,
      );
    }
  }
  if (failures.length > 0) {
    throw new Error(`Astronomy scale checks failed:\n${failures.join("\n")}`);
  }
}
