"use client";

import { useEffect, useState } from "react";
import type { PlanetId } from "@/data/planets";
import type { NasaPlanetRecord, NasaSnapshot } from "@/lib/nasa/types";
import { assetUrl } from "@/lib/assetUrl";
import { isExtensionPackaged } from "@/lib/screensaverConfig";

interface UseNasaPlanetFactsResult {
  data: NasaPlanetRecord | null;
  loading: boolean;
  error: string | null;
}

let offlineSnapshotPromise: Promise<NasaSnapshot> | null = null;

function loadOfflineSnapshot(): Promise<NasaSnapshot> {
  if (!offlineSnapshotPromise) {
    offlineSnapshotPromise = fetch(assetUrl("/data/nasa-snapshot.json")).then(
      async (res) => {
        if (!res.ok) throw new Error(`Offline NASA data unavailable (${res.status})`);
        return res.json() as Promise<NasaSnapshot>;
      },
    );
  }
  return offlineSnapshotPromise;
}

async function fetchPlanetRecord(id: PlanetId): Promise<NasaPlanetRecord> {
  if (isExtensionPackaged()) {
    const snapshot = await loadOfflineSnapshot();
    const record = snapshot.bodies[id];
    if (!record) throw new Error(`No offline NASA data for ${id}`);
    return record;
  }

  const res = await fetch(`/api/planets/${id}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<NasaPlanetRecord>;
}

export function useNasaPlanetFacts(
  id: PlanetId | null,
  enabled: boolean,
): UseNasaPlanetFactsResult {
  const [data, setData] = useState<NasaPlanetRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !id) return;

    const controller = new AbortController();
    let active = true;

    queueMicrotask(() => {
      if (!active) return;
      setLoading(true);
      setError(null);
    });

    fetchPlanetRecord(id)
      .then((record) => {
        if (active) setData(record);
      })
      .catch((err: Error) => {
        if (active && err.name !== "AbortError") {
          setError(err.message);
          setData(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [id, enabled]);

  if (!enabled || !id) {
    return { data: null, loading: false, error: null };
  }

  return { data, loading, error };
}
