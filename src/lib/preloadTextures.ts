import { useTexture } from "@react-three/drei";
import { MOON } from "@/data/moon";
import { PLANETS } from "@/data/planets";

export const TEXTURE_URLS = [
  ...PLANETS.flatMap((p) =>
    [p.texture, p.clouds, p.nightMap, p.ringTexture].filter(Boolean) as string[],
  ),
  MOON.texture,
];

/** Suspends until all planet/moon textures are GPU-ready (must render inside Canvas). */
export function TextureWarmup() {
  useTexture(TEXTURE_URLS);
  return null;
}
