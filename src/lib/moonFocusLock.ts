import type { NavTargetId } from "@/data/navigationTargets";
import { isMoonTarget } from "@/data/navigationTargets";
import {
  isMoonOrbitLocked,
  lockMoonOrbit,
  unlockMoonOrbit,
} from "@/lib/astronomy/moonEphemeris";
import { discoveryAutopilotState } from "@/lib/discoveryAutopilot";
import { routeTourState } from "@/lib/routeTour";
import { getSimulationDate } from "@/lib/simulationTime";

export type MoonFocusSignals = {
  navTargetId: NavTargetId | null;
  autoNavigating: boolean;
  routeActive: boolean;
};

/** Freeze or resume lunar motion around Earth for showcase legs. */
export function syncMoonFocusLock(active: boolean, sim = getSimulationDate()): void {
  if (active) {
    if (!isMoonOrbitLocked()) lockMoonOrbit(sim);
    return;
  }
  if (isMoonOrbitLocked()) unlockMoonOrbit();
}

/** Search, scenic discovery, or route planner has the Moon as the active leg. */
export function resolveMoonFocusActive(signals: MoonFocusSignals): boolean {
  const discoveryTarget = discoveryAutopilotState.currentTargetId;
  if (discoveryAutopilotState.active && discoveryTarget && isMoonTarget(discoveryTarget)) {
    return true;
  }
  const routeObserveTarget = routeTourState.observeTargetId;
  if (
    routeTourState.observing &&
    routeObserveTarget &&
    isMoonTarget(routeObserveTarget)
  ) {
    return true;
  }
  if (
    signals.routeActive &&
    signals.autoNavigating &&
    signals.navTargetId &&
    isMoonTarget(signals.navTargetId)
  ) {
    return true;
  }
  return false;
}
