"use client";

import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PLANETS } from "@/data/planets";
import type { NavTargetId } from "@/data/navigationTargets";
import { useExplorer } from "@/context/ExplorerContext";
import { directionFromAngles } from "@/lib/navigation";
import { flightReticleState } from "@/lib/flightReticleState";
import { pickBodyLabelAt } from "@/lib/bodyLabelPick";
import {
  absoluteToCameraSpace,
  navTargetRenderRadius,
} from "@/lib/coordinates/frame";
import { RENDER_FRAME_PRIORITY } from "@/lib/renderFramePriority";
import { isExtensionScreensaverFlight } from "@/lib/screensaverConfig";
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
  const { navigationActive, autoNavigating, showLabels } = useExplorer();

  useFrame((state) => {
    const extensionFlight = isExtensionScreensaverFlight(navigationActive);
    if (!navigationActive || (autoNavigating && !extensionFlight)) {
      flightReticleState.targetId = null;
      flightReticleState.viaLabel = false;
      return;
    }

    if (showLabels) {
      const labelId = pickBodyLabelAt(
        state.size.width * 0.5,
        state.size.height * 0.5,
      );
      if (labelId) {
        flightReticleState.targetId = labelId;
        flightReticleState.viaLabel = true;
        return;
      }
    }

    flightReticleState.viaLabel = false;

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
  }, RENDER_FRAME_PRIORITY.overlays);

  return null;
}
