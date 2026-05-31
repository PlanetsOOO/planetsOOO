import { KM_PER_UNIT, unitsPerSecToKmPerSec } from "@/data/astronomy";
import {
  getNavTargetName,
  isPlanetTarget,
  type NavTargetId,
} from "@/data/navigationTargets";
import { getPlanet } from "@/data/planets";
import {
  discoveryAutopilotState,
  getDiscoveryHudTargetId,
  getDiscoveryStandoffUnits,
  orbitElapsedSec,
} from "@/lib/discoveryAutopilot";
import {
  computeEarthApproachDetail,
  earthApproachState,
  getEarthDistanceRatio,
} from "@/lib/earthApproach";
import {
  formatLightTime,
  formatSpeedMultiple,
  lightTimeFromUnits,
} from "@/lib/astronomy/constants";
import { flightReticleState } from "@/lib/flightReticleState";
import { getTargetPosition } from "@/lib/targetPositions";
import {
  routeOrbitElapsedSec,
  routeTourState,
} from "@/lib/routeTour";
import {
  scenicLightspeedMultiple,
  scenicTransitEtaSec,
  scenicTransitRemainingSec,
  scenicTransitSpeed,
} from "@/lib/scenicTransit";
import { viewerPosition } from "@/lib/viewerState";
import * as THREE from "three";

export type GuideLogPhase =
  | "idle"
  | "orbit"
  | "depart"
  | "transit"
  | "route-orbit"
  | "route-transit"
  | "autopilot"
  | "flight";

export interface GuideLogTelemetryInput {
  discoveryAutopilotActive: boolean;
  autoNavigating: boolean;
  routeActive: boolean;
  navigationActive: boolean;
  navTargetId: NavTargetId | null;
  routeWaypoints: NavTargetId[];
  routeLegIndex: number;
  selectedId: NavTargetId | null;
  displaySpeedKmPerSec: number;
  displayLightspeedMultiple: number;
}

export interface GuideLogSnapshot {
  focusId: NavTargetId | null;
  focusName: string | null;
  phase: GuideLogPhase;
  telemetryLines: string[];
}

const _delta = new THREE.Vector3();

export function formatCompactKm(km: number): string {
  const value = Math.max(0, km);
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} Gm`;
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)} Mm`;
  return `${Math.round(value).toLocaleString()} km`;
}

function distanceKmToTarget(targetId: NavTargetId): number | null {
  const pos = getTargetPosition(targetId);
  if (!pos) return null;
  return viewerPosition.distanceTo(pos) * KM_PER_UNIT;
}

function resolveFocusName(focusId: NavTargetId | null): string | null {
  if (!focusId) return null;
  if (earthApproachState.active && focusId === "earth") {
    const detail = computeEarthApproachDetail(getEarthDistanceRatio());
    const phase =
      earthApproachState.phase === "landed"
        ? "Surface"
        : detail.layerConfig.label;
    return `Earth · ${phase}`;
  }
  return getNavTargetName(focusId);
}

function appendTransitLines(
  lines: string[],
  targetId: NavTargetId,
  alignmentMs: number,
  searchFocus: boolean,
  now: number,
): void {
  const pos = getTargetPosition(targetId);
  if (!pos || alignmentMs <= 0) return;

  const distUnits = viewerPosition.distanceTo(pos);
  const distKm = distUnits * KM_PER_UNIT;
  const etaSec = scenicTransitEtaSec(searchFocus);
  const remainingSec = scenicTransitRemainingSec(alignmentMs, now, etaSec);
  const speedUnits = scenicTransitSpeed(
    distUnits,
    alignmentMs,
    now,
    etaSec,
  );
  const multiple = scenicLightspeedMultiple(speedUnits);
  const speedKmS = unitsPerSecToKmPerSec(speedUnits);

  lines.push(`${formatCompactKm(distKm)} remaining · ~${formatLightTime(remainingSec)}`);
  if (multiple >= 0.05) {
    lines.push(
      `Cruise · ${formatSpeedMultiple(multiple)} c · ${speedKmS.toLocaleString(undefined, { maximumFractionDigits: 0 })} km/s`,
    );
  } else {
    lines.push(
      `Approach · ${speedKmS.toLocaleString(undefined, { maximumFractionDigits: 0 })} km/s`,
    );
  }
}

function appendNextLegHint(
  lines: string[],
  fromId: NavTargetId,
  nextId: NavTargetId,
): void {
  const fromPos = getTargetPosition(fromId);
  const nextPos = getTargetPosition(nextId);
  if (!fromPos || !nextPos) return;

  _delta.subVectors(nextPos, fromPos);
  const legKm = _delta.length() * KM_PER_UNIT;
  const lightSec = lightTimeFromUnits(_delta.length());
  lines.push(
    `Next · ${getNavTargetName(nextId)} · ${formatCompactKm(legKm)} · light ${formatLightTime(lightSec)}`,
  );
}

export function collectGuideLogTelemetry(
  input: GuideLogTelemetryInput,
  now = Date.now(),
): GuideLogSnapshot {
  const lines: string[] = [];
  let focusId: NavTargetId | null = null;
  let phase: GuideLogPhase = "idle";

  if (input.discoveryAutopilotActive && discoveryAutopilotState.active) {
    phase = discoveryAutopilotState.phase;
    focusId = getDiscoveryHudTargetId();

    if (phase === "orbit") {
      lines.push(`Showcase orbit · ${Math.round(orbitElapsedSec(now))}s`);
      const nextId = discoveryAutopilotState.queuedTargetId;
      if (nextId && focusId) appendNextLegHint(lines, focusId, nextId);
    } else if (phase === "depart") {
      if (focusId) {
        const distKm = distanceKmToTarget(focusId);
        if (distKm != null) {
          lines.push(`Departure pass · ${formatCompactKm(distKm)} out`);
        }
      }
      const nextId = discoveryAutopilotState.queuedTargetId;
      if (nextId) {
        lines.push(`Heading · ${getNavTargetName(nextId)}`);
      }
    } else if (phase === "transit") {
      const targetId = discoveryAutopilotState.currentTargetId;
      if (targetId) {
        lines.push(`Transit · ${getNavTargetName(targetId)}`);
        appendTransitLines(
          lines,
          targetId,
          discoveryAutopilotState.alignmentMs,
          discoveryAutopilotState.searchFocusLocked,
          now,
        );
      }
    }
  } else if (input.routeActive) {
    if (routeTourState.observing && routeTourState.observeTargetId) {
      phase = "route-orbit";
      focusId = routeTourState.observeTargetId;
      lines.push(`Route orbit · ${Math.round(routeOrbitElapsedSec(now))}s`);
      const nextId = routeTourState.queuedTargetId;
      if (nextId) appendNextLegHint(lines, focusId, nextId);
    } else if (input.autoNavigating && input.navTargetId) {
      phase = "route-transit";
      focusId = input.navTargetId;
      lines.push(`Route leg · ${getNavTargetName(focusId)}`);
      appendTransitLines(
        lines,
        focusId,
        routeTourState.alignmentMs,
        false,
        now,
      );
    } else {
      focusId = input.navTargetId ?? input.routeWaypoints[input.routeLegIndex] ?? null;
      phase = focusId ? "idle" : "idle";
    }
  } else if (input.autoNavigating && input.navTargetId) {
    phase = "autopilot";
    focusId = input.navTargetId;
    lines.push(`Fly-to · ${getNavTargetName(focusId)}`);
    const distKm = distanceKmToTarget(focusId);
    if (distKm != null) {
      lines.push(`${formatCompactKm(distKm)} remaining`);
    }
    if (input.displayLightspeedMultiple > 0) {
      lines.push(`Cruise · ${formatSpeedMultiple(input.displayLightspeedMultiple)} c`);
    } else if (input.displaySpeedKmPerSec > 0) {
      lines.push(
        `Speed · ${input.displaySpeedKmPerSec.toLocaleString(undefined, { maximumFractionDigits: 0 })} km/s`,
      );
    }
  } else if (input.navigationActive) {
    phase = "flight";
    focusId = flightReticleState.targetId;
    if (focusId) {
      const distKm = distanceKmToTarget(focusId);
      if (distKm != null) {
        lines.push(`${formatCompactKm(distKm)} to ${getNavTargetName(focusId)}`);
      }
      if (input.displayLightspeedMultiple > 0) {
        lines.push(`Warp · ${formatSpeedMultiple(input.displayLightspeedMultiple)} c`);
      } else if (input.displaySpeedKmPerSec > 1) {
        lines.push(
          `Speed · ${input.displaySpeedKmPerSec.toLocaleString(undefined, { maximumFractionDigits: 0 })} km/s`,
        );
      }
    }
  } else {
    focusId = input.selectedId;
  }

  if (focusId && lines.length === 0) {
    const distKm = distanceKmToTarget(focusId);
    if (distKm != null) {
      const standoff = isPlanetTarget(focusId)
        ? getDiscoveryStandoffUnits(focusId, getPlanet(focusId))
        : getDiscoveryStandoffUnits(focusId);
      const standoffKm = standoff * KM_PER_UNIT;
      if (distKm > standoffKm * 1.5) {
        lines.push(`${formatCompactKm(distKm)} · light ${formatLightTime(lightTimeFromUnits(distKm / KM_PER_UNIT))}`);
      }
    }
  }

  return {
    focusId,
    focusName: resolveFocusName(focusId),
    phase,
    telemetryLines: lines.slice(0, 4),
  };
}
