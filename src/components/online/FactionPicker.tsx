"use client";

import { useState } from "react";
import { useOnline } from "@/context/OnlineContext";

export function FactionPicker() {
  const { factions, chooseFaction } = useOnline();
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#030508]/90 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-black/80 p-6 shadow-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-sky-300/70">
          Orbit Online · Demo
        </p>
        <h1 className="mt-3 text-2xl font-light tracking-tight text-zinc-50">
          Choose your faction
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-6 text-zinc-400">
          Allegiance is locked for this demo season. Build influence for your
          people across the solar system.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {factions.map((faction) => (
            <li key={faction.id}>
              <button
                type="button"
                disabled={busyId != null}
                onClick={() => {
                  setError("");
                  setBusyId(faction.id);
                  void chooseFaction(faction.id)
                    .catch((err) => {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Unable to choose faction.",
                      );
                    })
                    .finally(() => setBusyId(null));
                }}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-white/25 hover:bg-white/[0.06] disabled:opacity-60"
                style={{ boxShadow: `inset 3px 0 0 ${faction.color}` }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-zinc-100">
                    {faction.name}
                  </span>
                  <span
                    className="font-mono text-[10px] tracking-wider"
                    style={{ color: faction.color }}
                  >
                    {faction.tag}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-5 text-zinc-500">
                  {faction.blurb}
                </p>
                {busyId === faction.id ? (
                  <p className="mt-2 text-[10px] uppercase tracking-wider text-zinc-500">
                    Joining…
                  </p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
        {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      </div>
    </div>
  );
}
