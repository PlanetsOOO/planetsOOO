"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { ONLINE_FLIGHT_FEEL } from "@/lib/online/flightFeel";
import { isOnlineMode } from "@/lib/screensaverConfig";
import { BASE_FOV } from "@/lib/lightspeed";

/** Applies Online cockpit FOV when entering ?online=1. */
export function OnlineCockpitCamera() {
  const { camera } = useThree();

  useEffect(() => {
    if (!isOnlineMode()) return;
    if (!("isPerspectiveCamera" in camera) || !camera.isPerspectiveCamera) {
      return;
    }
    const prev = camera.fov;
    camera.fov = ONLINE_FLIGHT_FEEL.baseFov;
    camera.updateProjectionMatrix();
    return () => {
      camera.fov = prev || BASE_FOV;
      camera.updateProjectionMatrix();
    };
  }, [camera]);

  return null;
}
