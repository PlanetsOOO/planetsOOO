import type { PlanetId } from "@/data/planets";

export type ApproachTextureTier = "2k" | "4k" | "8k";

const APPROACH_TIERS: ApproachTextureTier[] = ["2k", "4k", "8k"];

const PLANET_TEXTURE_STEM: Record<PlanetId, string> = {
  sun: "sun",
  mercury: "mercury",
  venus: "venus_surface",
  earth: "earth_daymap",
  mars: "mars",
  jupiter: "jupiter",
  saturn: "saturn",
  uranus: "uranus",
  neptune: "neptune",
};

export function getPlanetApproachTextureStem(id: PlanetId): string {
  return PLANET_TEXTURE_STEM[id];
}

export function getPlanetApproachTextureUrl(
  id: PlanetId,
  tier: ApproachTextureTier,
): string {
  return `/textures/${tier}_${PLANET_TEXTURE_STEM[id]}.jpg`;
}

/** Unique 2k / 4k / 8k URLs for a planet (approach overlay stack). */
export function getPlanetApproachTierUrls(id: PlanetId): string[] {
  return APPROACH_TIERS.map((tier) => getPlanetApproachTextureUrl(id, tier));
}

export function getPlanetApproachTierUrlByIndex(
  id: PlanetId,
  tierIndex: number,
): string {
  const tier = APPROACH_TIERS[tierIndex] ?? "2k";
  return getPlanetApproachTextureUrl(id, tier);
}
