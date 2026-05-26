import { readFile } from "fs/promises";
import path from "path";
import type { PlanetId } from "@/data/planets";
import type { NasaPlanetRecord, NasaSnapshot } from "./types";

const SNAPSHOT_PATH = path.join(
  process.cwd(),
  "public/data/nasa-snapshot.json",
);

let cachedSnapshot: NasaSnapshot | null = null;

export async function loadNasaSnapshot(): Promise<NasaSnapshot | null> {
  if (cachedSnapshot) return cachedSnapshot;
  try {
    const raw = await readFile(SNAPSHOT_PATH, "utf-8");
    cachedSnapshot = JSON.parse(raw) as NasaSnapshot;
    return cachedSnapshot;
  } catch {
    return null;
  }
}

export function getSnapshotPlanet(
  snapshot: NasaSnapshot,
  id: PlanetId,
): NasaPlanetRecord | null {
  return snapshot.bodies[id] ?? null;
}
