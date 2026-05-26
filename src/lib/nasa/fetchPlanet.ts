import type { PlanetId } from "@/data/planets";
import { parseHorizonsObjectData } from "./parseHorizons";
import {
  HORIZONS_COMMAND,
  horizonsApiUrl,
  NASA_SCIENCE_URL,
  NASA_SEMIMAJOR_AXIS_AU,
  PLANET_NAMES,
} from "./sources";
import { NASA_SUPPLEMENT } from "./supplement";
import type { NasaPlanetRecord } from "./types";

const HORIZONS_SOURCE = {
  name: "NASA/JPL Horizons System",
  url: "https://ssd.jpl.nasa.gov/horizons/",
};

interface HorizonsResponse {
  result?: string;
  error?: string;
}

export async function fetchHorizonsBody(id: PlanetId): Promise<string> {
  const command = `'${HORIZONS_COMMAND[id]}'`;
  const url = horizonsApiUrl(command);

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86_400 },
  });

  if (!res.ok) {
    throw new Error(`Horizons API HTTP ${res.status} for ${id}`);
  }

  const data = (await res.json()) as HorizonsResponse;
  if (!data.result) {
    throw new Error(data.error ?? `Horizons returned no data for ${id}`);
  }

  return data.result;
}

export function buildPlanetRecord(
  id: PlanetId,
  horizonsText: string,
  fetchedAt: string,
): NasaPlanetRecord {
  const parsed = parseHorizonsObjectData(horizonsText);
  const supplement = NASA_SUPPLEMENT[id];

  return {
    id,
    name: PLANET_NAMES[id],
    fetchedAt,
    sources: {
      horizons: HORIZONS_SOURCE,
      science: {
        name: "NASA Science",
        url: NASA_SCIENCE_URL[id],
      },
      imagery: {
        name: supplement.imageryCredit,
        url: supplement.imageryUrl,
      },
    },
    diameterKm: parsed.diameterKm,
    massDescription: parsed.massDescription,
    distanceAu: NASA_SEMIMAJOR_AXIS_AU[id],
    siderealDay: parsed.siderealDay,
    orbitalPeriod:
      id === "sun" ? null : parsed.orbitalPeriod ?? null,
    meanTemperature: parsed.meanTemperature,
    moons: supplement.moons,
    description: supplement.description,
    missions: supplement.missions,
    imageryCredit: supplement.imageryCredit,
    horizonsId: HORIZONS_COMMAND[id],
  };
}

export async function fetchNasaPlanetRecord(
  id: PlanetId,
): Promise<NasaPlanetRecord> {
  const horizonsText = await fetchHorizonsBody(id);
  return buildPlanetRecord(id, horizonsText, new Date().toISOString());
}
