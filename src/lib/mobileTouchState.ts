/** Shared mobile landscape touch input (updated by MobileFlightControls). */

export type MobileSpeedTier = 0 | 1 | 2;

export const mobileTouchState = {
  enabled: false,
  flightActive: false,
  thrustX: 0,
  thrustY: 0,
  braking: false,
  speedTier: 0 as MobileSpeedTier,
  lookDx: 0,
  lookDy: 0,
};

export function resetMobileTouchState(): void {
  mobileTouchState.flightActive = false;
  mobileTouchState.thrustX = 0;
  mobileTouchState.thrustY = 0;
  mobileTouchState.braking = false;
  mobileTouchState.speedTier = 0;
  mobileTouchState.lookDx = 0;
  mobileTouchState.lookDy = 0;
}

/** Tap L² → L¹, tap L¹ → normal (reverse sequence). */
export function tapMobileSpeedTier(tier: 1 | 2): void {
  if (tier === 2 && mobileTouchState.speedTier === 2) {
    mobileTouchState.speedTier = 1;
  } else if (tier === 1 && mobileTouchState.speedTier === 1) {
    mobileTouchState.speedTier = 0;
  }
}

export function isMobileFlightActive(): boolean {
  return mobileTouchState.enabled && mobileTouchState.flightActive;
}

/** Radians per pixel for right-side look drag. */
export const MOBILE_LOOK_SENSITIVITY = 0.0048;
