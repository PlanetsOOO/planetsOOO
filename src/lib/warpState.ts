/** Lightspeed mode telemetry for visuals (FOV, particles). */
export const lightspeedState = {
  active: false,
  /** 0–1 spool for FOV and effects */
  intensity: 0,
  ludicrous: false,
};

export function resetLightspeedState() {
  lightspeedState.active = false;
  lightspeedState.intensity = 0;
  lightspeedState.ludicrous = false;
}
