import { getRotationAngle } from "@/lib/astronomy/ephemeris";
import { getPlanet } from "@/data/planets";
import { getSimulationDate } from "@/lib/simulationTime";
import * as THREE from "three";

const DEG = Math.PI / 180;

const _rel = new THREE.Vector3();
const _invSpin = new THREE.Quaternion();
const _invTilt = new THREE.Quaternion();

/** Earth-fixed unit direction from heliocentric viewer position. */
export function earthFixedDirection(
  viewer: THREE.Vector3,
  earthCenter: THREE.Vector3,
  date = getSimulationDate(),
  target = _rel,
): THREE.Vector3 {
  target.copy(viewer).sub(earthCenter);
  if (target.lengthSq() < 1e-12) return target.set(0, 1, 0);
  target.normalize();

  const spin = getRotationAngle("earth", date);
  _invSpin.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -spin);
  target.applyQuaternion(_invSpin);

  const tilt = getPlanet("earth").tilt;
  if (Math.abs(tilt) > 1e-6) {
    _invTilt.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -tilt);
    target.applyQuaternion(_invTilt);
  }

  return target;
}

export function directionToLatLon(dir: THREE.Vector3): { lat: number; lon: number } {
  return {
    lat: THREE.MathUtils.RAD2DEG * Math.asin(THREE.MathUtils.clamp(dir.y, -1, 1)),
    lon: THREE.MathUtils.RAD2DEG * Math.atan2(dir.x, dir.z),
  };
}

export function latLonToUnitDirection(
  latDeg: number,
  lonDeg: number,
  target = new THREE.Vector3(),
): THREE.Vector3 {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const cosLat = Math.cos(lat);
  return target.set(cosLat * Math.sin(lon), Math.sin(lat), cosLat * Math.cos(lon));
}

export function earthAltitudeKm(
  viewer: THREE.Vector3,
  earthCenter: THREE.Vector3,
  radiusUnits = getPlanet("earth").radius,
): number {
  return Math.max(0, (viewer.distanceTo(earthCenter) - radiusUnits) * 1_000);
}

/** Earth-fixed lat/lon → heliocentric unit vector (inverse of earthFixedDirection). */
export function earthFixedDirectionToHeliocentric(
  latDeg: number,
  lonDeg: number,
  date = getSimulationDate(),
  target = new THREE.Vector3(),
): THREE.Vector3 {
  target.copy(latLonToUnitDirection(latDeg, lonDeg));

  const tilt = getPlanet("earth").tilt;
  if (Math.abs(tilt) > 1e-6) {
    _invTilt.setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt);
    target.applyQuaternion(_invTilt);
  }

  const spin = getRotationAngle("earth", date);
  _invSpin.setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin);
  target.applyQuaternion(_invSpin);

  return target;
}
