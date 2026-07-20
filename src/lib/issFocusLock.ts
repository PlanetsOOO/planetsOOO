import type { NavTargetId } from "@/data/navigationTargets";
import { isIssTarget } from "@/data/navigationTargets";
import {
  isIssOrbitLocked,
  lockIssOrbit,
  unlockIssOrbit,
} from "@/lib/astronomy/issEphemeris";
import { discoveryAutopilotState } from "@/lib/discoveryAutopilot";
import { routeTourState } from "@/lib/routeTour";
import { getSimulationDate } from "@/lib/simulationTime";
import { isTrackableFocusOrbitActive } from "@/lib/trackableFocusState";

export type IssFocusSignals = {
  navTargetId: NavTargetId | null;
  autoNavigating: boolean;
  routeActive: boolean;
};

/** Freeze or resume ISS motion around Earth for showcase legs. */
export function syncIssFocusLock(active: boolean, sim = getSimulationDate()): void {
  if (active) {
    if (!isIssOrbitLocked()) lockIssOrbit(sim);
    return;
  }
  if (isIssOrbitLocked()) unlockIssOrbit();
}

/** Search, scenic discovery, route planner, or autopilot fly-to on the ISS. */
export function resolveIssFocusActive(signals: IssFocusSignals): boolean {
  if (
    signals.autoNavigating &&
    signals.navTargetId &&
    isIssTarget(signals.navTargetId)
  ) {
    return true;
  }
  const discoveryTarget = discoveryAutopilotState.currentTargetId;
  if (discoveryAutopilotState.active && discoveryTarget && isIssTarget(discoveryTarget)) {
    return true;
  }
  const routeObserveTarget = routeTourState.observeTargetId;
  if (
    routeTourState.observing &&
    routeObserveTarget &&
    isIssTarget(routeObserveTarget)
  ) {
    return true;
  }
  return false;
}

/** Close-range scenic orbit — detail boost allowed; transit uses true scale like planets. */
export function resolveIssShowcaseActive(signals: IssFocusSignals): boolean {
  if (isTrackableFocusOrbitActive()) return true;
  const discoveryTarget = discoveryAutopilotState.currentTargetId;
  if (
    discoveryAutopilotState.active &&
    discoveryTarget &&
    isIssTarget(discoveryTarget) &&
    discoveryAutopilotState.phase === "orbit"
  ) {
    return true;
  }
  const routeObserveTarget = routeTourState.observeTargetId;
  if (
    routeTourState.observing &&
    routeObserveTarget &&
    isIssTarget(routeObserveTarget)
  ) {
    return true;
  }
  return false;
}
