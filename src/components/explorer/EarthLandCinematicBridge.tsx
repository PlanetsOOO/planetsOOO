"use client";

import { useEffect } from "react";
import { registerEarthLandCameraHandlers } from "@/lib/earthLandCinematic";

type EarthLandCinematicBridgeProps = {
  yawRef: React.MutableRefObject<number>;
  pitchRef: React.MutableRefObject<number>;
};

/** Registers camera refs so cinematic landing can snap to surface orientation. */
export function EarthLandCinematicBridge({
  yawRef,
  pitchRef,
}: EarthLandCinematicBridgeProps) {
  useEffect(() => {
    registerEarthLandCameraHandlers({ yawRef, pitchRef });
    return () => registerEarthLandCameraHandlers(null);
  }, [yawRef, pitchRef]);

  return null;
}
