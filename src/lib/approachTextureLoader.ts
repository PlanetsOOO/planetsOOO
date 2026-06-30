import type { PlanetId } from "@/data/planets";
import {
  getPlanetApproachTierUrlByIndex,
  type ApproachTextureTier,
} from "@/data/planetApproachTextures";
import type { ApproachTierIndex } from "@/lib/approachLayers";
import { assetUrl } from "@/lib/assetUrl";
import * as THREE from "three";

const APPROACH_TIERS: ApproachTextureTier[] = ["2k", "4k", "8k"];

const tierCache = new Map<string, THREE.Texture>();
const tierLoads = new Map<string, Promise<THREE.Texture>>();

function configureApproachTexture(texture: THREE.Texture): THREE.Texture {
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function loadApproachTextureByUrl(
  url: string,
  fallback: THREE.Texture,
): Promise<THREE.Texture> {
  if (!url || url === fallback.userData?.sourceUrl) {
    return Promise.resolve(fallback);
  }

  const cached = tierCache.get(url);
  if (cached) return Promise.resolve(cached);

  const pending = tierLoads.get(url);
  if (pending) return pending;

  const load = new Promise<THREE.Texture>((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      assetUrl(url),
      (texture) => {
        configureApproachTexture(texture);
        tierCache.set(url, texture);
        tierLoads.delete(url);
        resolve(texture);
      },
      undefined,
      () => {
        tierLoads.delete(url);
        resolve(fallback);
      },
    );
  });

  tierLoads.set(url, load);
  return load;
}

/** Load a higher-res approach tier; falls back to `fallback` on 404 or error. */
export function loadApproachTierTexture(
  planetId: PlanetId,
  tierIndex: ApproachTierIndex,
  fallback: THREE.Texture,
): Promise<THREE.Texture> {
  if (tierIndex <= 0) {
    return Promise.resolve(fallback);
  }

  const url = getPlanetApproachTierUrlByIndex(planetId, tierIndex);
  const cached = tierCache.get(url);
  if (cached) return Promise.resolve(cached);

  const pending = tierLoads.get(url);
  if (pending) return pending;

  const load = new Promise<THREE.Texture>((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      assetUrl(url),
      (texture) => {
        configureApproachTexture(texture);
        tierCache.set(url, texture);
        tierLoads.delete(url);
        resolve(texture);
      },
      undefined,
      () => {
        tierLoads.delete(url);
        resolve(fallback);
      },
    );
  });

  tierLoads.set(url, load);
  return load;
}

export function getApproachTierLabel(tierIndex: ApproachTierIndex): ApproachTextureTier {
  return APPROACH_TIERS[tierIndex] ?? "2k";
}
