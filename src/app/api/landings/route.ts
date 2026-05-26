import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import {
  findLandingInManifest,
  readLandingManifest,
  saveLandingVideo,
  upsertLandingEntry,
  type LandingLibraryEntry,
} from "@/lib/landing/library";
import {
  buildLandingCell,
  readEarthRegionHintAtLatLon,
} from "@/lib/landing/locationCell";

/** Look up a cached landing video for a geographic cell (exact tile + neighbors). */
export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  const bodyId = (request.nextUrl.searchParams.get("body") ?? "earth") as "earth";

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat and lon required" }, { status: 400 });
  }

  const manifest = await readLandingManifest();
  const entry = findLandingInManifest(manifest, bodyId, lat, lon);
  if (!entry) {
    return NextResponse.json({ cached: false, cell: buildLandingCell(bodyId, lat, lon) });
  }

  const diskPath = path.join(process.cwd(), "public", entry.videoPath);
  try {
    await fs.access(diskPath);
  } catch {
    return NextResponse.json({ cached: false, cell: buildLandingCell(bodyId, lat, lon) });
  }

  return NextResponse.json({ cached: true, entry });
}

/** Store a rendered landing video in the location library. */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const video = form.get("video");
  const metaRaw = form.get("metadata");

  if (!(video instanceof Blob) || typeof metaRaw !== "string") {
    return NextResponse.json({ error: "video and metadata required" }, { status: 400 });
  }

  const meta = JSON.parse(metaRaw) as {
    lat: number;
    lon: number;
    bodyId?: "earth";
    durationSec?: number;
    regionHint?: string;
  };

  if (!Number.isFinite(meta.lat) || !Number.isFinite(meta.lon)) {
    return NextResponse.json({ error: "Invalid metadata" }, { status: 400 });
  }

  const bodyId = meta.bodyId ?? "earth";
  const cell = buildLandingCell(bodyId, meta.lat, meta.lon);
  const bytes = Buffer.from(await video.arrayBuffer());
  const videoPath = await saveLandingVideo(cell.cellId, bytes);

  const entry: LandingLibraryEntry = {
    cellId: cell.cellId,
    bodyId,
    lat: meta.lat,
    lon: meta.lon,
    tileZoom: cell.zoom,
    tileX: cell.tileX,
    tileY: cell.tileY,
    videoPath,
    regionHint: meta.regionHint ?? readEarthRegionHintAtLatLon(meta.lat, meta.lon),
    source: "satellite-dem",
    durationSec: meta.durationSec ?? 12,
    createdAt: new Date().toISOString(),
  };

  await upsertLandingEntry(entry);
  return NextResponse.json({ entry });
}
