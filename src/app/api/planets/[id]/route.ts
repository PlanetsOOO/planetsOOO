import { NextResponse } from "next/server";
import { PLANETS, type PlanetId } from "@/data/planets";
import { fetchNasaPlanetRecord } from "@/lib/nasa/fetchPlanet";
import { getSnapshotPlanet, loadNasaSnapshot } from "@/lib/nasa/snapshot";

const VALID_IDS = new Set(PLANETS.map((p) => p.id));

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!VALID_IDS.has(id as PlanetId)) {
    return NextResponse.json({ error: "Unknown body" }, { status: 404 });
  }

  const planetId = id as PlanetId;

  try {
    const record = await fetchNasaPlanetRecord(planetId);
    return NextResponse.json(record, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        "X-Data-Source": "NASA/JPL Horizons (live)",
      },
    });
  } catch (liveError) {
    const snapshot = await loadNasaSnapshot();
    const fallback = snapshot ? getSnapshotPlanet(snapshot, planetId) : null;

    if (fallback) {
      return NextResponse.json(fallback, {
        headers: {
          "Cache-Control": "public, s-maxage=3600",
          "X-Data-Source": "NASA/JPL Horizons (snapshot)",
        },
      });
    }

    console.error(`NASA data fetch failed for ${id}:`, liveError);
    return NextResponse.json(
      { error: "Unable to load NASA planetary data" },
      { status: 503 },
    );
  }
}
