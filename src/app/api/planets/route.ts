import { NextResponse } from "next/server";
import { PLANETS } from "@/data/planets";
import { fetchNasaPlanetRecord } from "@/lib/nasa/fetchPlanet";
import { loadNasaSnapshot } from "@/lib/nasa/snapshot";
import type { PlanetId } from "@/data/planets";
import type { NasaPlanetRecord } from "@/lib/nasa/types";

export async function GET() {
  const snapshot = await loadNasaSnapshot();
  const results: Partial<Record<PlanetId, NasaPlanetRecord>> = {};

  await Promise.all(
    PLANETS.map(async (planet) => {
      try {
        results[planet.id] = await fetchNasaPlanetRecord(planet.id);
      } catch {
        const fallback = snapshot?.bodies[planet.id];
        if (fallback) results[planet.id] = fallback;
      }
    }),
  );

  const count = Object.keys(results).length;
  if (count === 0) {
    return NextResponse.json(
      { error: "Unable to load NASA planetary data" },
      { status: 503 },
    );
  }

  return NextResponse.json(
    {
      provider: "NASA/JPL Horizons System",
      documentation: "https://ssd.jpl.nasa.gov/horizons/",
      count,
      bodies: results,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    },
  );
}
