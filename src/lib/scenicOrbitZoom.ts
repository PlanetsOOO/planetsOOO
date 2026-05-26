import { BASE_FOV } from "@/lib/lightspeed";

export const SCENIC_ORBIT_FOV_MIN = 28;
export const SCENIC_ORBIT_FOV_MAX = 72;
export const SCENIC_ORBIT_FOV_STEP = 1.8;

export function clampScenicOrbitFov(fov: number): number {
  return Math.max(SCENIC_ORBIT_FOV_MIN, Math.min(SCENIC_ORBIT_FOV_MAX, fov));
}

export function defaultScenicOrbitFov(): number {
  return BASE_FOV;
}
