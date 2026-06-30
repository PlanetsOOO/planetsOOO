"use client";

import { useTexture } from "@react-three/drei";
import { MOON } from "@/data/moon";
import { PLANETS } from "@/data/planets";
import { assetUrl } from "@/lib/assetUrl";

export const TEXTURE_URLS = [
  ...PLANETS.flatMap((p) =>
    [p.texture, p.clouds, p.nightMap, p.ringTexture].filter(Boolean) as string[],
  ),
  MOON.texture,
].map(assetUrl);

function TextureWarmupInner() {
  useTexture(TEXTURE_URLS);
  return null;
}

/** Preload planet/moon textures (must sit in Suspense with SolarSystemScene). */
export function TextureWarmup() {
  return <TextureWarmupInner />;
}
