/**
 * Sentinel-2 cloudless tiles (EOX, CC BY-NC-SA 4.0) via `/api/earth-tile`.
 */

import * as THREE from "three";

export const EARTH_TILE_SIZE = 256;
export const EARTH_TILE_MIN_ZOOM = 2;
export const EARTH_TILE_MAX_ZOOM = 14;

const tileImageCache = new Map<string, Promise<HTMLImageElement>>();

export function latLonToTileXY(
  lat: number,
  lon: number,
  zoom: number,
): { x: number; y: number } {
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return {
    x: THREE.MathUtils.clamp(x, 0, n - 1),
    y: THREE.MathUtils.clamp(y, 0, n - 1),
  };
}

export function altitudeKmToTileZoom(altitudeKm: number): number {
  if (altitudeKm <= 0) return EARTH_TILE_MAX_ZOOM;
  const metersPerPixel = Math.max(altitudeKm * 6, 40);
  const zoom = Math.log2(40_075_016.686 / (metersPerPixel * EARTH_TILE_SIZE));
  return THREE.MathUtils.clamp(
    Math.floor(zoom),
    EARTH_TILE_MIN_ZOOM,
    EARTH_TILE_MAX_ZOOM,
  );
}

export function tileProxyUrl(z: number, x: number, y: number): string {
  return `/api/earth-tile?z=${z}&x=${x}&y=${y}`;
}

function loadTileImage(z: number, x: number, y: number): Promise<HTMLImageElement> {
  const n = 2 ** z;
  const wrappedX = ((x % n) + n) % n;
  const wrappedY = THREE.MathUtils.clamp(y, 0, n - 1);
  const key = `${z}:${wrappedX}:${wrappedY}`;
  const cached = tileImageCache.get(key);
  if (cached) return cached;

  const load = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Tile load failed ${key}`));
    img.src = tileProxyUrl(z, wrappedX, wrappedY);
  });

  tileImageCache.set(key, load);
  return load;
}

export async function loadStitchedTileCanvas(
  tileX: number,
  tileY: number,
  zoom: number,
  grid = 3,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = EARTH_TILE_SIZE * grid;
  canvas.height = EARTH_TILE_SIZE * grid;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const offset = Math.floor(grid / 2);
  const loads: Promise<void>[] = [];

  for (let row = 0; row < grid; row += 1) {
    for (let col = 0; col < grid; col += 1) {
      const x = tileX + col - offset;
      const y = tileY + row - offset;
      loads.push(
        loadTileImage(zoom, x, y)
          .then((img) => {
            ctx.drawImage(img, col * EARTH_TILE_SIZE, row * EARTH_TILE_SIZE);
          })
          .catch(() => {
            ctx.fillStyle = "#0a1628";
            ctx.fillRect(
              col * EARTH_TILE_SIZE,
              row * EARTH_TILE_SIZE,
              EARTH_TILE_SIZE,
              EARTH_TILE_SIZE,
            );
          }),
      );
    }
  }

  await Promise.all(loads);
  return canvas;
}
