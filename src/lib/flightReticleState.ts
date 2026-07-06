import type { NavTargetId } from "@/data/navigationTargets";

/** Body under the flight-mode center reticle (updated each frame). */
export const flightReticleState = {
  targetId: null as NavTargetId | null,
  /** True when `targetId` came from a body label under the reticle (not mesh raycast). */
  viaLabel: false,
};
