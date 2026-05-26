/**
 * Terrarium-encoded elevation tiles (Mapzen/AWS open terrain).
 * Decoded height = (R * 256 + G + B / 256) - 32768 meters.
 */

import { EARTH_TILE_SIZE } from "@/lib/earth/tileImagery";

const terrainCache = new Map<string, Promise<HTMLImageElement>>();

export function terrainProxyUrl(z: number, x: number, y: number): string {
  return `/api/earth-terrain?z=${z}&x=${x}&y=${y}`;
}

function loadTerrainImage(z: number, x: number, y: number): Promise<HTMLImageElement> {
  const n = 2 ** z;
  const wrappedX = ((x % n) + n) % n;
  const wrappedY = Math.max(0, Math.min(n - 1, y));
  const key = `${z}:${wrappedX}:${wrappedY}`;
  const cached = terrainCache.get(key);
  if (cached) return cached;

  const load = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Terrain load failed ${key}`));
    img.src = terrainProxyUrl(z, wrappedX, wrappedY);
  });

  terrainCache.set(key, load);
  return load;
}

/** Sample terrarium RGB → elevation meters. */
export function terrariumHeight(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}

export async function loadStitchedHeightField(
  tileX: number,
  tileY: number,
  zoom: number,
  grid = 3,
): Promise<Float32Array> {
  const size = EARTH_TILE_SIZE * grid;
  const heights = new Float32Array(size * size);
  const offset = Math.floor(grid / 2);
  const canvas = document.createElement("canvas");
  canvas.width = EARTH_TILE_SIZE;
  canvas.height = EARTH_TILE_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas unavailable");

  for (let row = 0; row < grid; row += 1) {
    for (let col = 0; col < grid; col += 1) {
      const x = tileX + col - offset;
      const y = tileY + row - offset;
      try {
        const img = await loadTerrainImage(zoom, x, y);
        ctx.clearRect(0, 0, EARTH_TILE_SIZE, EARTH_TILE_SIZE);
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, EARTH_TILE_SIZE, EARTH_TILE_SIZE).data;
        for (let py = 0; py < EARTH_TILE_SIZE; py += 1) {
          for (let px = 0; px < EARTH_TILE_SIZE; px += 1) {
            const i = (py * EARTH_TILE_SIZE + px) * 4;
            const gx = col * EARTH_TILE_SIZE + px;
            const gy = row * EARTH_TILE_SIZE + py;
            heights[gy * size + gx] = terrariumHeight(data[i], data[i + 1], data[i + 2]);
          }
        }
      } catch {
        for (let py = 0; py < EARTH_TILE_SIZE; py += 1) {
          for (let px = 0; px < EARTH_TILE_SIZE; px += 1) {
            const gx = col * EARTH_TILE_SIZE + px;
            const gy = row * EARTH_TILE_SIZE + py;
            heights[gy * size + gx] = 0;
          }
        }
      }
    }
  }

  return heights;
}
