"use client";

import { useEffect, useState } from "react";
import type { PlanetId } from "@/data/planets";
import type { NasaPlanetRecord } from "@/lib/nasa/types";

interface UseNasaPlanetFactsResult {
  data: NasaPlanetRecord | null;
  loading: boolean;
  error: string | null;
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

    fetch(`/api/planets/${id}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? `HTTP ${res.status}`,
          );
        }
        return res.json() as Promise<NasaPlanetRecord>;
      })
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
