export type EarthLandCinematicPhase =
  | "idle"
  | "offer"
  | "generating"
  | "playing"
  | "complete"
  | "error";

export type EarthLandTarget = {
  lat: number;
  lon: number;
  altitudeKm: number;
  distanceRatio: number;
  regionHint: string;
};

export type EarthLandCameraHandlers = {
  yawRef: { current: number };
  pitchRef: { current: number };
};

export const earthLandCinematicState = {
  phase: "idle" as EarthLandCinematicPhase,
  target: null as EarthLandTarget | null,
  videoUrl: null as string | null,
  error: null as string | null,
  cameraHandlers: null as EarthLandCameraHandlers | null,
};

export function registerEarthLandCameraHandlers(
  handlers: EarthLandCameraHandlers | null,
): void {
  earthLandCinematicState.cameraHandlers = handlers;
}

export function resetEarthLandCinematic(): void {
  earthLandCinematicState.phase = "idle";
  earthLandCinematicState.target = null;
  earthLandCinematicState.videoUrl = null;
  earthLandCinematicState.error = null;
}

export function lockEarthLandTarget(target: EarthLandTarget): void {
  earthLandCinematicState.target = target;
  if (
    earthLandCinematicState.phase === "idle" ||
    earthLandCinematicState.phase === "offer"
  ) {
    earthLandCinematicState.phase = "offer";
  }
}

export function clearEarthLandOffer(): void {
  if (
    earthLandCinematicState.phase === "offer" ||
    earthLandCinematicState.phase === "idle"
  ) {
    resetEarthLandCinematic();
  }
}
