"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { OnlineAccessResult } from "@/lib/online/access";
import type { OrbitFaction } from "@/lib/online/factions";

interface OnlineContextValue {
  enabled: boolean;
  access: OnlineAccessResult | null;
  factions: OrbitFaction[];
  refreshAccess: () => Promise<void>;
  chooseFaction: (factionId: string) => Promise<void>;
}

const OnlineContext = createContext<OnlineContextValue | null>(null);

export function OnlineProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const [access, setAccess] = useState<OnlineAccessResult | null>(null);
  const [factions, setFactions] = useState<OrbitFaction[]>([]);

  const refreshAccess = useCallback(async () => {
    if (!enabled) {
      setAccess(null);
      setFactions([]);
      return;
    }
    const [accessRes, factionRes] = await Promise.all([
      fetch("/api/online/access"),
      fetch("/api/online/faction"),
    ]);
    const accessData = (await accessRes.json()) as OnlineAccessResult;
    setAccess(accessData);
    if (factionRes.ok) {
      const factionData = (await factionRes.json()) as {
        factions?: OrbitFaction[];
      };
      setFactions(factionData.factions ?? []);
    }
  }, [enabled]);

  const chooseFaction = useCallback(
    async (factionId: string) => {
      const res = await fetch("/api/online/faction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factionId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Unable to choose faction.");
      }
      await refreshAccess();
    },
    [refreshAccess],
  );

  useEffect(() => {
    void refreshAccess();
  }, [refreshAccess]);

  const value = useMemo(
    () => ({
      enabled,
      access,
      factions,
      refreshAccess,
      chooseFaction,
    }),
    [access, chooseFaction, enabled, factions, refreshAccess],
  );

  return (
    <OnlineContext.Provider value={value}>{children}</OnlineContext.Provider>
  );
}

export function useOnline(): OnlineContextValue {
  const ctx = useContext(OnlineContext);
  if (!ctx) {
    throw new Error("useOnline must be used within OnlineProvider");
  }
  return ctx;
}
