import * as THREE from "three";
import { getPlanet } from "@/data/planets";
import { getHeliocentricPosition } from "@/lib/astronomy/ephemeris";
import {
  defaultOrbitFrame,
  orbitPositionAtPhase,
  type OrbitFrame,
} from "@/lib/bodyOrbit";
import {
  absoluteToCameraSpace,
  initializeFloatingOriginAt,
  updateCoordinateScaleMode,
} from "@/lib/coordinates/frame";
import {
  cameraAnglesFromPosition,
  cameraAnglesTowardWorldPoint,
} from "@/lib/navigation";
import { getSimulationDate } from "@/lib/simulationTime";

export { cameraAnglesTowardWorldPoint };

/** Absolute heliocentric viewer position (1 unit = 1,000 km). Camera stays at origin. */
export const viewerPosition = new THREE.Vector3();

const earthHelio = new THREE.Vector3();
const sunHelio = new THREE.Vector3();

const spawnFrame: OrbitFrame = {
  radius: 0,
  phase: 0,
  u: new THREE.Vector3(),
  v: new THREE.Vector3(),
};

/** Spawn on a low-inclination Earth orbit, facing Earth. */
export function computeSpawnView(date = getSimulationDate()) {
  getHeliocentricPosition("earth", 0, date, earthHelio);
  defaultOrbitFrame(spawnFrame, getPlanet("earth").radius);
  const position = orbitPositionAtPhase(
    earthHelio,
    spawnFrame,
    0,
    new THREE.Vector3(),
  );
  const { yaw, pitch } = cameraAnglesFromPosition(position, earthHelio);
  return { position, yaw, pitch, earthHelio: earthHelio.clone() };
}

/** Apply spawn near Earth (call once on client mount). */
export function applySpawnView(date = getSimulationDate()) {
  const spawn = computeSpawnView(date);
  viewerPosition.copy(spawn.position);
  initializeFloatingOriginAt(spawn.position);
  updateCoordinateScaleMode(date);
  return spawn;
}

export const initialSpawnAngles = { yaw: 0, pitch: -0.05 };

/** Sun position in camera/world space (heliocentric origin). */
export function getSunWorldPosition(target = new THREE.Vector3()): THREE.Vector3 {
  sunHelio.set(0, 0, 0);
  return absoluteToCameraSpace(sunHelio, target);
}

/** Earth heliocentric position for the current simulation time. */
export function getEarthHeliocentricPosition(
  target = new THREE.Vector3(),
  date = getSimulationDate(),
): THREE.Vector3 {
  getHeliocentricPosition("earth", 0, date, target);
  return target;
}

/** Earth position in camera/world space (floating origin). */
export function getEarthWorldPosition(
  target = new THREE.Vector3(),
  date = getSimulationDate(),
): THREE.Vector3 {
  getEarthHeliocentricPosition(target, date);
  return absoluteToCameraSpace(target, target);
}
