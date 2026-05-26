"use client";

import { useEffect } from "react";
import { getPlanet } from "@/data/planets";
import { useExplorer } from "@/context/ExplorerContext";
import { useNasaPlanetFacts } from "@/hooks/useNasaPlanetFacts";

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function PlanetPanel() {
  const { selectedId, infoOpen, dismissInfo } = useExplorer();
  const { data: nasa, loading, error } = useNasaPlanetFacts(
    selectedId,
    infoOpen && !!selectedId,
  );

  useEffect(() => {
    if (!infoOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissInfo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [infoOpen, dismissInfo]);

  if (!infoOpen || !selectedId) return null;

  const planet = getPlanet(selectedId);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4 pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-label={`${planet.name} information`}
    >
      <button
        type="button"
        className="absolute inset-0 pointer-events-auto bg-black/40 backdrop-blur-[2px]"
        onClick={dismissInfo}
        aria-label="Close"
      />

      <aside className="pointer-events-auto relative w-full max-w-md max-h-[75vh] overflow-y-auto rounded-xl border border-white/10 bg-black/80 backdrop-blur-xl p-5 shadow-2xl">
        <button
          type="button"
          onClick={dismissInfo}
          className="absolute top-3 right-3 h-8 w-8 flex items-center justify-center rounded-full text-zinc-500 hover:text-white hover:bg-white/10 transition-colors text-lg leading-none"
          aria-label="Close panel"
        >
          ×
        </button>

        <div className="flex items-start gap-3 mb-3 pr-8">
          <div
            className="h-9 w-9 rounded-full shrink-0 border border-white/20"
            style={{
              background: `radial-gradient(circle at 30% 30%, ${planet.color}, #0a0a12)`,
            }}
          />
          <div>
            <h2 className="text-xl font-light text-white tracking-tight">
              {nasa?.name ?? planet.name}
            </h2>
            {loading && (
              <p className="text-[10px] text-zinc-500 mt-0.5">
                Loading NASA data…
              </p>
            )}
          </div>
        </div>

        {error && (
          <p className="text-xs text-amber-400/90 mb-3">
            Could not reach NASA Horizons API. {error}
          </p>
        )}

        {nasa && (
          <>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
              {nasa.description}
            </p>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              {nasa.diameterKm != null && (
                <Stat
                  label="Diameter"
                  value={`${formatNumber(nasa.diameterKm)} km`}
                />
              )}
              <Stat
                label="Distance from Sun"
                value={
                  nasa.distanceAu === 0
                    ? "Center"
                    : `${nasa.distanceAu} AU`
                }
              />
              {nasa.siderealDay && (
                <Stat label="Sidereal day" value={nasa.siderealDay} />
              )}
              {nasa.orbitalPeriod && (
                <Stat label="Orbital period" value={nasa.orbitalPeriod} />
              )}
              {nasa.moons != null && (
                <Stat label="Moons" value={String(nasa.moons)} />
              )}
              {nasa.meanTemperature && (
                <Stat label="Temperature" value={nasa.meanTemperature} />
              )}
              {nasa.massDescription && (
                <Stat
                  label="Mass"
                  value={nasa.massDescription}
                  className="col-span-2"
                />
              )}
            </dl>

            <p className="mt-4 pt-3 border-t border-white/10 text-[10px] text-zinc-500">
              Missions: {nasa.missions}
            </p>

            <div className="mt-3 space-y-1.5 text-[10px] text-zinc-600">
              <p>
                Physical data:{" "}
                <a
                  href={nasa.sources.horizons.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400/90 hover:underline"
                >
                  {nasa.sources.horizons.name}
                </a>
                {" · "}
                <a
                  href={nasa.sources.science.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400/90 hover:underline"
                >
                  NASA Science
                </a>
              </p>
              <p>
                Imagery:{" "}
                <a
                  href={nasa.sources.imagery.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400/90 hover:underline"
                >
                  {nasa.imageryCredit}
                </a>
              </p>
              <p className="text-zinc-700">
                Updated{" "}
                {new Date(nasa.fetchedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function Stat({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-zinc-500 uppercase tracking-wider mb-0.5">{label}</dt>
      <dd className="text-zinc-200 font-mono">{value}</dd>
    </div>
  );
}
