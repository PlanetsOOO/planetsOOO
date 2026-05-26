"use client";

import { useEffect, useState } from "react";
import {
  getNavTargetName,
  type NavTargetId,
} from "@/data/navigationTargets";
import { useExplorer } from "@/context/ExplorerContext";
import {
  buildTourWaypoints,
  isValidTour,
  TOUR_PRESETS,
} from "@/lib/route";
import { routeTourState, routeOrbitElapsedSec } from "@/lib/routeTour";
import {
  SCENIC_ORBIT_DWELL_SEC,
  SCENIC_TRANSIT_ETA_SEC,
} from "@/lib/scenicTransit";
import { PlanetAutocompleteField } from "./PlanetAutocompleteField";

const MAX_STOPS = 8;

export function RoutePathPlanner() {
  const {
    routeActive,
    routeLegIndex,
    routeWaypoints,
    autoNavigating,
    startRoute,
    cancelRoute,
    discoveryAutopilotActive,
  } = useExplorer();
  const [expanded, setExpanded] = useState(false);
  const [visits, setVisits] = useState<(NavTargetId | null)[]>([null, null]);
  const [, tick] = useState(0);

  const resolvedVisits = visits.filter((v): v is NavTargetId => v !== null);
  const canStart = isValidTour(resolvedVisits);
  const planningDisabled = routeActive || discoveryAutopilotActive;

  useEffect(() => {
    if (!routeActive) return;
    const id = window.setInterval(() => tick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [routeActive]);

  const addStop = () => {
    if (visits.length >= MAX_STOPS) return;
    setVisits((prev) => [...prev, null]);
  };

  const updateVisit = (index: number, id: NavTargetId | null) => {
    setVisits((prev) => prev.map((v, i) => (i === index ? id : v)));
  };

  const removeVisit = (index: number) => {
    setVisits((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length >= 2 ? next : [...next, null];
    });
  };

  const applyPreset = (presetVisits: NavTargetId[]) => {
    setVisits(presetVisits.map((id) => id));
  };

  const handleStart = () => {
    if (!canStart) return;
    startRoute(buildTourWaypoints(resolvedVisits));
  };

  const currentTarget = routeWaypoints[routeLegIndex];
  const observing = routeTourState.observing;
  const observeRemaining =
    observing && routeTourState.observeTargetId
      ? Math.max(
          0,
          SCENIC_ORBIT_DWELL_SEC - routeOrbitElapsedSec(),
        )
      : 0;

  return (
    <div className="mb-3 pb-3 border-b border-white/10">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors"
        aria-expanded={expanded}
      >
        Tour planner
        <span className="text-zinc-600 normal-case tracking-normal">
          {expanded ? "▾" : "▸"}
        </span>
      </button>

      {expanded && (
        <div className="mt-2.5 space-y-2.5">
          <p className="text-[10px] leading-relaxed text-zinc-600">
            Visit each stop in order. Orbit until the next target aligns, then
            next target aligns, then cruise (~30s, faster when farther).
          </p>

          {!planningDisabled && (
            <div className="flex flex-wrap gap-1">
              {TOUR_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset.visits)}
                  className="rounded px-1.5 py-0.5 text-[9px] text-zinc-500 border border-white/10 hover:border-white/20 hover:text-zinc-300 transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-zinc-600">
              Visit order
            </p>
            {visits.map((visit, i) => (
              <div key={i} className="flex gap-1 items-end">
                <div className="flex-1">
                  <PlanetAutocompleteField
                    label={`Stop ${i + 1}`}
                    value={visit}
                    onChange={(id) => updateVisit(i, id)}
                    placeholder="Planet or object…"
                    disabled={planningDisabled}
                  />
                </div>
                {!planningDisabled && visits.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeVisit(i)}
                    className="mb-0.5 px-1.5 py-1 text-xs text-zinc-500 hover:text-red-400"
                    aria-label={`Remove stop ${i + 1}`}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          {!planningDisabled && (
            <button
              type="button"
              onClick={addStop}
              disabled={visits.length >= MAX_STOPS}
              className="w-full rounded-md border border-dashed border-white/15 py-1 text-[10px] text-zinc-500 hover:border-white/25 hover:text-zinc-300 disabled:opacity-30 transition-colors"
            >
              + Add stop
            </button>
          )}

          {routeActive && currentTarget && (
            <p className="text-[10px] text-sky-400/80 text-center leading-relaxed">
              {observing ? (
                <>
                  Observing {getNavTargetName(currentTarget)} · stop{" "}
                  {routeLegIndex + 1} of {routeWaypoints.length}
                  {observeRemaining > 0 &&
                    ` · ~${Math.ceil(observeRemaining)}s`}
                </>
              ) : autoNavigating ? (
                <>
                  En route to {getNavTargetName(currentTarget)} · stop{" "}
                  {routeLegIndex + 1} of {routeWaypoints.length} · ~
                  {SCENIC_TRANSIT_ETA_SEC}s leg
                </>
              ) : (
                <>
                  Tour paused at {getNavTargetName(currentTarget)} · Tab to
                  exit
                </>
              )}
            </p>
          )}

          {canStart && !routeActive && (
            <button
              type="button"
              onClick={handleStart}
              className="w-full rounded-md bg-sky-600/80 hover:bg-sky-500/80 py-1.5 text-xs font-medium text-white transition-colors"
            >
              Begin tour
            </button>
          )}

          {routeActive && (
            <button
              type="button"
              onClick={cancelRoute}
              className="w-full rounded-md border border-white/15 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-white/5 transition-colors"
            >
              End tour
            </button>
          )}
        </div>
      )}
    </div>
  );
}
