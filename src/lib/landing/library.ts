import { promises as fs } from "fs";
import path from "path";
import type { LandingBodyId } from "@/lib/landing/locationCell";
import { buildLandingCell, landingNeighborCellIds } from "@/lib/landing/locationCell";

export type LandingLibraryEntry = {
  cellId: string;
  bodyId: LandingBodyId;
  lat: number;
  lon: number;
  tileZoom: number;
  tileX: number;
  tileY: number;
  videoPath: string;
  regionHint: string;
  source: "satellite-dem";
  durationSec: number;
  createdAt: string;
};

export type LandingLibraryManifest = {
  version: 1;
  entries: LandingLibraryEntry[];
};

const LIBRARY_DIR = path.join(process.cwd(), "public/data/landings");
const VIDEO_DIR = path.join(LIBRARY_DIR, "videos");
const MANIFEST_PATH = path.join(LIBRARY_DIR, "manifest.json");

export async function readLandingManifest(): Promise<LandingLibraryManifest> {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, "utf8");
    return JSON.parse(raw) as LandingLibraryManifest;
  } catch {
    return { version: 1, entries: [] };
  }
}

export async function writeLandingManifest(
  manifest: LandingLibraryManifest,
): Promise<void> {
  await fs.mkdir(LIBRARY_DIR, { recursive: true });
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

export function findLandingInManifest(
  manifest: LandingLibraryManifest,
  bodyId: LandingBodyId,
  lat: number,
  lon: number,
): LandingLibraryEntry | null {
  const cell = buildLandingCell(bodyId, lat, lon);
  const byId = new Map(manifest.entries.map((e) => [e.cellId, e]));

  const exact = byId.get(cell.cellId);
  if (exact) return exact;

  for (const neighborId of landingNeighborCellIds(cell)) {
    const neighbor = byId.get(neighborId);
    if (neighbor) return neighbor;
  }

  return null;
}

export function landingVideoFilename(cellId: string): string {
  return cellId.replace(/:/g, "-") + ".webm";
}

export async function saveLandingVideo(
  cellId: string,
  bytes: Buffer,
): Promise<string> {
  await fs.mkdir(VIDEO_DIR, { recursive: true });
  const filename = landingVideoFilename(cellId);
  const diskPath = path.join(VIDEO_DIR, filename);
  await fs.writeFile(diskPath, bytes);
  return `/data/landings/videos/${filename}`;
}

export async function upsertLandingEntry(
  entry: LandingLibraryEntry,
): Promise<void> {
  const manifest = await readLandingManifest();
  const idx = manifest.entries.findIndex((e) => e.cellId === entry.cellId);
  if (idx >= 0) {
    manifest.entries[idx] = entry;
  } else {
    manifest.entries.push(entry);
  }
  await writeLandingManifest(manifest);
}
