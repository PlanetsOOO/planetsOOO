"use client";

import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PLANETS } from "@/data/planets";
import type { NavTargetId } from "@/data/navigationTargets";
import { useExplorer } from "@/context/ExplorerContext";
import { directionFromAngles } from "@/lib/navigation";
import { flightReticleState } from "@/lib/flightReticleState";
import {
  absoluteToCameraSpace,
  navTargetRenderRadius,
} from "@/lib/coordinates/frame";
import { getTargetPosition } from "@/lib/targetPositions";

const rayOrigin = new THREE.Vector3();
const rayDir = new THREE.Vector3();
const bodyCenter = new THREE.Vector3();
const oc = new THREE.Vector3();

function raySphereDistance(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  center: THREE.Vector3,
  radius: number,
): number | null {
  oc.copy(origin).sub(center);
  const b = oc.dot(direction);
  const c = oc.lengthSq() - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : null;
}

interface Hit {
  id: NavTargetId;
  distance: number;
}

export function FlightTargetSelector({
  yawRef,
  pitchRef,
  rollRef,
}: {
  yawRef: React.MutableRefObject<number>;
  pitchRef: React.MutableRefObject<number>;
  rollRef: React.MutableRefObject<number>;
}) {
  const { navigationActive, autoNavigating } = useExplorer();

  useFrame(() => {
    if (!navigationActive || autoNavigating) {
      flightReticleState.targetId = null;
      return;
    }

    directionFromAngles(
      yawRef.current,
      pitchRef.current,
      rayDir,
      rollRef.current,
    );
    rayOrigin.set(0, 0, 0);

    const hits: Hit[] = [];

    for (const planet of PLANETS) {
      const absolute = getTargetPosition(planet.id);
      if (!absolute) continue;
      absoluteToCameraSpace(absolute, bodyCenter);
      const t = raySphereDistance(
        rayOrigin,
        rayDir,
        bodyCenter,
        navTargetRenderRadius(planet.id),
      );
      if (t !== null) hits.push({ id: planet.id, distance: t });
    }

    for (const targetId of ["moon"] as const) {
      const absolute = getTargetPosition(targetId);
      if (!absolute) continue;
      absoluteToCameraSpace(absolute, bodyCenter);
      const t = raySphereDistance(
        rayOrigin,
        rayDir,
        bodyCenter,
        navTargetRenderRadius(targetId),
      );
      if (t !== null) hits.push({ id: targetId, distance: t });
    }

    hits.sort((a, b) => a.distance - b.distance);
    flightReticleState.targetId = hits[0]?.id ?? null;
  });

  return null;
}
