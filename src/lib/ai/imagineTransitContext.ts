import type { NavTargetId } from "@/data/navigationTargets";
import { isMoonTarget } from "@/data/navigationTargets";
import { ASTRONOMY } from "@/data/astronomy";
import type { PlanetId } from "@/data/planets";
import {
  discoveryAutopilotState,
  discoveryTransitElapsedSec,
} from "@/lib/discoveryAutopilot";
import { routeTourState, routeTransitElapsedSec } from "@/lib/routeTour";
import { SCENIC_TRANSIT_ETA_SEC } from "@/lib/scenicTransit";

export type TransitPhase = "depart" | "cruise" | "approach";
export type TransitMode = "scenic" | "route";

/** True while autopilot or trip planner is flying between bodies. */
export function isInAutopilotTransit(
  routeActive: boolean,
  autoNavigating: boolean,
): boolean {
  if (!autoNavigating) return false;

  if (routeActive) {
    return routeTourState.alignmentMs > 0 && !routeTourState.observing;
  }

  if (!discoveryAutopilotState.active) return false;
  return (
    discoveryAutopilotState.phase === "transit" ||
    discoveryAutopilotState.phase === "depart"
  );
}

export function readTransitMode(routeActive: boolean): TransitMode {
  return routeActive ? "route" : "scenic";
}

export function readTransitElapsedSec(routeActive: boolean): number {
  if (routeActive) return routeTransitElapsedSec();
  return discoveryTransitElapsedSec();
}

export function readTransitProgress(
  routeActive: boolean,
  autoNavigating: boolean,
): number {
  if (!isInAutopilotTransit(routeActive, autoNavigating)) return 0;
  return Math.min(1, readTransitElapsedSec(routeActive) / SCENIC_TRANSIT_ETA_SEC);
}

export function transitPhaseFromProgress(progress: number): TransitPhase {
  if (progress < 0.28) return "depart";
  if (progress < 0.72) return "cruise";
  return "approach";
}

function regionForPlanet(id: PlanetId): string {
  const au = ASTRONOMY[id].semiMajorAxisKm / 149_597_870.7;
  if (id === "sun") return "solar corona and inner heliosphere";
  if (au < 1.5) return "inner solar system — bright zodiacal dust, strong sun glare off-axis";
  if (au < 5) return "main asteroid belt crossing — occasional distant rocky streaks";
  if (au < 12) return "middle solar system — sparse dust, Jupiter-family comet streaks";
  if (au < 25) return "outer solar system — cold, dim star field, faint icy particle glints";
  return "deep outer system — extremely sparse field, long-period comet tails as faint streaks";
}

/** Environment hints for prompts — never names a visible body disc. */
export function getTransitRegionHint(id: NavTargetId): string {
  if (isMoonTarget(id)) {
    return "cislunar space — Earthshine as soft blue forward glow, no lunar disc";
  }
  if (id in ASTRONOMY) return regionForPlanet(id as PlanetId);
  return "interplanetary space";
}

export function lightspeedBand(multiple: number): string {
  if (multiple >= 25) return "extreme";
  if (multiple >= 8) return "high";
  if (multiple >= 2) return "moderate";
  if (multiple >= 0.5) return "low";
  return "cruise";
}
