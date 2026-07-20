import { BASE_FOV } from "@/lib/lightspeed";

export const SCENIC_ORBIT_FOV_MIN = 28;
export const SCENIC_ORBIT_FOV_MAX = 72;
export const SCENIC_ORBIT_FOV_STEP = 1.8;

/** Tighter zoom range for km-scale trackables (ISS, future satellites). */
export const TRACKABLE_ORBIT_FOV_MIN = 16;
export const TRACKABLE_ORBIT_FOV_MAX = 56;
export const TRACKABLE_ORBIT_FOV_STEP = 1.5;

export function clampScenicOrbitFov(fov: number): number {
  return Math.max(SCENIC_ORBIT_FOV_MIN, Math.min(SCENIC_ORBIT_FOV_MAX, fov));
}

export function clampTrackableOrbitFov(fov: number): number {
  return Math.max(
    TRACKABLE_ORBIT_FOV_MIN,
    Math.min(TRACKABLE_ORBIT_FOV_MAX, fov),
  );
}

export function defaultScenicOrbitFov(): number {
  return BASE_FOV;
}
