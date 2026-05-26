"use client";

import { useEffect, useState } from "react";
import { useExplorer } from "@/context/ExplorerContext";
import { getNavTargetName } from "@/data/navigationTargets";
import { getDiscoveryHudTargetId } from "@/lib/discoveryAutopilot";
import {
  computeEarthApproachDetail,
  earthApproachState,
  getEarthDistanceRatio,
} from "@/lib/earthApproach";
import { flightReticleState } from "@/lib/flightReticleState";
import { formatUtcDate, formatUtcTime } from "@/lib/formatUtc";
import { getSimulationDate } from "@/lib/simulationTime";

export function UtcClock() {
  const {
    discoveryAutopilotActive,
    autoNavigating,
    routeActive,
    navigationActive,
    navTargetId,
    routeWaypoints,
    routeLegIndex,
  } = useExplorer();
  const [stamp, setStamp] = useState<{
    date: string;
    time: string;
    objectName: string | null;
    autopilot: boolean;
  } | null>(null);

  useEffect(() => {
    const tick = () => {
      const clock = formatClock(getSimulationDate());
      let objectName: string | null = null;
      let autopilot = false;

      if (discoveryAutopilotActive) {
        autopilot = true;
        const hudId = getDiscoveryHudTargetId();
        if (earthApproachState.active && hudId === "earth") {
          const detail = computeEarthApproachDetail(getEarthDistanceRatio());
          const phase =
            earthApproachState.phase === "landed"
              ? "Surface"
              : detail.layerConfig.label;
          objectName = `Earth · ${phase}`;
        } else {
          objectName = hudId ? getNavTargetName(hudId) : null;
        }
      } else if (autoNavigating || routeActive) {
        autopilot = true;
        const id = navTargetId ?? routeWaypoints[routeLegIndex] ?? null;
        objectName = id ? getNavTargetName(id) : null;
      } else if (navigationActive) {
        const reticleId = flightReticleState.targetId;
        objectName = reticleId ? getNavTargetName(reticleId) : null;
      }

      setStamp({
        ...clock,
        objectName,
        autopilot,
      });
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [
    discoveryAutopilotActive,
    autoNavigating,
    routeActive,
    navigationActive,
    navTargetId,
    routeWaypoints,
    routeLegIndex,
  ]);

  return (
    <div
      className="fixed top-5 left-5 z-40 pointer-events-none select-none font-mono text-[10px] text-zinc-600/70 tabular-nums leading-relaxed"
      aria-live="polite"
    >
      <p>{stamp?.date ?? "—"}</p>
      <p>{stamp?.time ?? "—:—:— UTC"}</p>
      {stamp?.objectName && (
        <p className="mt-2 text-[10px] tracking-wide text-zinc-500/70 normal-case">
          {stamp.objectName}
        </p>
      )}
      {stamp?.autopilot && (
        <p className="mt-1 text-[9px] uppercase tracking-[0.22em] text-zinc-600/45">
          Autopilot
        </p>
      )}
    </div>
  );
}

function formatClock(date: Date) {
  return {
    date: formatUtcDate(date),
    time: formatUtcTime(date),
  };
}
