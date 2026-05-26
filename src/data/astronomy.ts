import type { PlanetId } from "@/data/planets";

/** 1 Three.js unit = 1,000 km */
export const KM_PER_UNIT = 1_000;

export const AU_KM = 149_597_870.7;

export interface BodyAstronomy {
  radiusKm: number;
  semiMajorAxisKm: number;
  orbitalPeriodDays: number;
  rotationPeriodHours: number;
}

export const ASTRONOMY: Record<PlanetId, BodyAstronomy> = {
  sun: {
    radiusKm: 696_000,
    semiMajorAxisKm: 0,
    orbitalPeriodDays: 0,
    rotationPeriodHours: 609.12,
  },
  mercury: {
    radiusKm: 2_439.7,
    semiMajorAxisKm: 57_909_050,
    orbitalPeriodDays: 87.969,
    rotationPeriodHours: 1407.6,
  },
  venus: {
    radiusKm: 6_051.8,
    semiMajorAxisKm: 108_209_475,
    orbitalPeriodDays: 224.701,
    rotationPeriodHours: -5832.5,
  },
  earth: {
    radiusKm: 6_371,
    semiMajorAxisKm: AU_KM,
    orbitalPeriodDays: 365.256,
    rotationPeriodHours: 23.934,
  },
  mars: {
    radiusKm: 3_389.5,
    semiMajorAxisKm: 227_943_824,
    orbitalPeriodDays: 686.98,
    rotationPeriodHours: 24.623,
  },
  jupiter: {
    radiusKm: 69_911,
    semiMajorAxisKm: 778_570_000,
    orbitalPeriodDays: 4332.59,
    rotationPeriodHours: 9.925,
  },
  saturn: {
    radiusKm: 58_232,
    semiMajorAxisKm: 1_433_530_000,
    orbitalPeriodDays: 10_759.22,
    rotationPeriodHours: 10.656,
  },
  uranus: {
    radiusKm: 25_362,
    semiMajorAxisKm: 2_872_460_000,
    orbitalPeriodDays: 30_688.5,
    rotationPeriodHours: 17.24,
  },
  neptune: {
    radiusKm: 24_622,
    semiMajorAxisKm: 4_495_060_000,
    orbitalPeriodDays: 60_182,
    rotationPeriodHours: 16.11,
  },
};

export function kmToUnits(km: number): number {
  return km / KM_PER_UNIT;
}

export function unitsToKm(units: number): number {
  return units * KM_PER_UNIT;
}

export function kmPerSecToUnitsPerSec(kmPerSec: number): number {
  return kmPerSec / KM_PER_UNIT;
}

export function unitsPerSecToKmPerSec(unitsPerSec: number): number {
  return unitsPerSec * KM_PER_UNIT;
}

export function kmPerSecToKph(kmPerSec: number): number {
  return kmPerSec * 3600;
}

export function kmPerSecToMph(kmPerSec: number): number {
  return kmPerSec * 2236.9362920544;
}

export function getEarthSpawnPosition(): { x: number; y: number; z: number } {
  const earthOrbit = kmToUnits(AU_KM);
  return { x: earthOrbit + 120, y: 30, z: 80 };
}

/** Standard gravitational parameter μ (km³/s²) for idle orbit mechanics. */
export const GRAVITATIONAL_PARAMETER_KM3_S2: Record<
  import("@/data/planets").PlanetId,
  number
> = {
  sun: 1.327_124_400_18e11,
  mercury: 22_031.868_551,
  venus: 324_858.592_000,
  earth: 398_600.4418,
  mars: 42_828.375_214,
  jupiter: 126_686_534.921_8,
  saturn: 37_931_187.362_4,
  uranus: 5_793_939.096,
  neptune: 6_836_830.0,
};
