import type { PlanetId } from "@/data/planets";

export interface NasaDataSource {
  name: string;
  url: string;
}

export interface NasaPlanetRecord {
  id: PlanetId;
  name: string;
  /** ISO timestamp when Horizons data was fetched */
  fetchedAt: string;
  sources: {
    horizons: NasaDataSource;
    science: NasaDataSource;
    imagery: NasaDataSource;
  };
  diameterKm: number | null;
  massDescription: string | null;
  distanceAu: number | null;
  siderealDay: string | null;
  orbitalPeriod: string | null;
  meanTemperature: string | null;
  moons: number | null;
  description: string;
  missions: string;
  imageryCredit: string;
  horizonsId: string;
}

export interface NasaSnapshot {
  version: 1;
  generatedAt: string;
  provider: string;
  bodies: Record<PlanetId, NasaPlanetRecord>;
}
