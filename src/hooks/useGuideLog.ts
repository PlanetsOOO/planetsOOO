"use client";

import { useEffect, useRef, useState } from "react";
import { isPlanetTarget } from "@/data/navigationTargets";
import {
  collectGuideLogTelemetry,
  type GuideLogSnapshot,
} from "@/lib/ai/guideLogContext";
import { staticGuideFactLines } from "@/lib/ai/guideLogFacts";
import { useExplorer } from "@/context/ExplorerContext";

const TELEMETRY_MS = 450;
const FACT_DEBOUNCE_MS = 1400;
const MAX_LINES = 7;

type FactCacheEntry = {
  lines: string[];
  focusKey: string;
};

const factCache = new Map<string, FactCacheEntry>();
const inflight = new Map<string, Promise<string[]>>();

function focusCacheKey(snapshot: GuideLogSnapshot): string | null {
  if (!snapshot.focusId) return null;
  return `${snapshot.focusId}:${snapshot.phase}`;
}

async function fetchAiFactLines(
  snapshot: GuideLogSnapshot,
): Promise<string[]> {
  if (!snapshot.focusId || !snapshot.focusName) return [];

  const key = focusCacheKey(snapshot)!;
  const cached = factCache.get(key);
  if (cached) return cached.lines;

  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const res = await fetch("/api/ai/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          focusId: snapshot.focusId,
          focusName: snapshot.focusName,
          phase: snapshot.phase,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { lines?: string[] };
        const lines = (data.lines ?? []).filter(Boolean).slice(0, 3);
        if (lines.length > 0) {
          factCache.set(key, { focusKey: key, lines });
          return lines;
        }
      }

      if (isPlanetTarget(snapshot.focusId!)) {
        const planetRes = await fetch(`/api/planets/${snapshot.focusId}`);
        if (planetRes.ok) {
          const record = (await planetRes.json()) as { description?: string };
          const snippet = record.description?.split(/(?<=[.!?])\s+/)[0]?.trim();
          if (snippet) {
            const lines = [snippet.slice(0, 96)];
            factCache.set(key, { focusKey: key, lines });
            return lines;
          }
        }
      }

      const fallback = staticGuideFactLines(snapshot.focusId!);
      factCache.set(key, { focusKey: key, lines: fallback });
      return fallback;
    } catch {
      const fallback = staticGuideFactLines(snapshot.focusId!);
      factCache.set(key, { focusKey: key, lines: fallback });
      return fallback;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

export function useGuideLog(enabled: boolean): string[] {
  const explorer = useExplorer();
  const [lines, setLines] = useState<string[]>([]);
  const snapshotRef = useRef<GuideLogSnapshot | null>(null);
  const factKeyRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      let cancelled = false;
      queueMicrotask(() => {
        if (!cancelled) setLines([]);
      });
      return () => {
        cancelled = true;
      };
    }

    const tick = () => {
      const snapshot = collectGuideLogTelemetry({
        discoveryAutopilotActive: explorer.discoveryAutopilotActive,
        autoNavigating: explorer.autoNavigating,
        routeActive: explorer.routeActive,
        navigationActive: explorer.navigationActive,
        navTargetId: explorer.navTargetId,
        routeWaypoints: explorer.routeWaypoints,
        routeLegIndex: explorer.routeLegIndex,
        selectedId: explorer.selectedId,
        displaySpeedKmPerSec: explorer.displaySpeedKmPerSec,
        displayLightspeedMultiple: explorer.displayLightspeedMultiple,
      });
      snapshotRef.current = snapshot;

      const factKey = focusCacheKey(snapshot);
      const cachedFacts =
        factKey != null ? factCache.get(factKey)?.lines ?? [] : [];

      setLines(
        [...snapshot.telemetryLines, ...cachedFacts].slice(0, MAX_LINES),
      );

      if (factKey && factKey !== factKeyRef.current) {
        factKeyRef.current = factKey;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          void fetchAiFactLines(snapshot).then((factLines) => {
            if (factKeyRef.current !== factKey) return;
            const current = snapshotRef.current;
            if (!current || focusCacheKey(current) !== factKey) return;
            setLines(
              [...current.telemetryLines, ...factLines].slice(0, MAX_LINES),
            );
          });
        }, FACT_DEBOUNCE_MS);
      }
    };

    tick();
    const id = window.setInterval(tick, TELEMETRY_MS);
    return () => {
      window.clearInterval(id);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [
    enabled,
    explorer.discoveryAutopilotActive,
    explorer.autoNavigating,
    explorer.routeActive,
    explorer.navigationActive,
    explorer.navTargetId,
    explorer.routeWaypoints,
    explorer.routeLegIndex,
    explorer.selectedId,
    explorer.displaySpeedKmPerSec,
    explorer.displayLightspeedMultiple,
  ]);

  return lines;
}
