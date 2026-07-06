import {
  beginDiscoveryOrbitAtTarget,
  discoveryAutopilotState,
  pickRandomNavTarget,
} from "@/lib/discoveryAutopilot";
import { idleOrbitState } from "@/lib/idleOrbitState";
import { isScreensaverMode } from "@/lib/screensaverConfig";

/** Start scenic autopilot from URL (extension preview / idle). Idempotent. */
export function activateScreensaverScenicTour(): boolean {
  if (typeof window === "undefined" || !isScreensaverMode()) return false;

  idleOrbitState.active = false;

  if (
    discoveryAutopilotState.active &&
    discoveryAutopilotState.currentTargetId &&
    (discoveryAutopilotState.phase === "orbit" ||
      discoveryAutopilotState.phase === "transit" ||
      discoveryAutopilotState.phase === "depart")
  ) {
    return true;
  }

  const target = pickRandomNavTarget();
  discoveryAutopilotState.active = true;
  beginDiscoveryOrbitAtTarget(target);
  return true;
}
