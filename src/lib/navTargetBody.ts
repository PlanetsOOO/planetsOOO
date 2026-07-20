import { ISS } from "@/data/iss";
import { MOON } from "@/data/moon";
import type { PlanetConfig } from "@/data/planets";
import { getPlanet } from "@/data/planets";
import {
  isIssTarget,
  isMoonTarget,
  isPlanetTarget,
  type NavTargetId,
} from "@/data/navigationTargets";
import { getHeliocentricPosition } from "@/lib/astronomy/ephemeris";
import { getIssHeliocentricPosition } from "@/lib/astronomy/issEphemeris";
import { getMoonHeliocentricPosition } from "@/lib/astronomy/moonEphemeris";
import { getSimulationDate } from "@/lib/simulationTime";
import { getTargetPosition, setTargetPosition } from "@/lib/targetPositions";
import * as THREE from "three";

export function resolveNavTargetRadius(targetId: NavTargetId): number {
  if (isMoonTarget(targetId)) return MOON.radius;
  if (isIssTarget(targetId)) return ISS.boundingRadius;
  return getPlanet(targetId).radius;
}

export function resolveNavTargetPlanetConfig(targetId: NavTargetId): PlanetConfig {
  if (isMoonTarget(targetId)) {
    return { radius: MOON.radius } as PlanetConfig;
  }
  if (isIssTarget(targetId)) {
    return { radius: ISS.boundingRadius } as PlanetConfig;
  }
  return getPlanet(targetId);
}

export function resolveNavTargetHeliocentric(
  targetId: NavTargetId,
  target = new THREE.Vector3(),
  date = getSimulationDate(),
): THREE.Vector3 | null {
  const live = getTargetPosition(targetId);
  if (live) return target.copy(live);

  if (isMoonTarget(targetId)) {
    getMoonHeliocentricPosition(date, target);
    setTargetPosition(targetId, target);
    return target;
  }

  if (isIssTarget(targetId)) {
    getIssHeliocentricPosition(date, target);
    setTargetPosition(targetId, target);
    return target;
  }

  if (isPlanetTarget(targetId)) {
    const config = getPlanet(targetId);
    getHeliocentricPosition(targetId, config.orbitRadius, date, target);
    setTargetPosition(targetId, target);
    return target;
  }

  return null;
}
