"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { isMoonTarget, type NavTargetId } from "@/data/navigationTargets";
import { getPlanet } from "@/data/planets";
import { getMoonHeliocentricPosition } from "@/lib/astronomy/moonEphemeris";
import { getSimulationDate } from "@/lib/simulationTime";
import { useExplorer } from "@/context/ExplorerContext";
import { getTargetPosition } from "@/lib/targetPositions";
import { RENDER_FRAME_PRIORITY } from "@/lib/renderFramePriority";
import { StableOrbitLine } from "./StableOrbitLine";

function resolveAbsolute(id: NavTargetId, target = new THREE.Vector3()): THREE.Vector3 {
  const live = getTargetPosition(id);
  if (live) return target.copy(live);
  if (isMoonTarget(id)) {
    return getMoonHeliocentricPosition(getSimulationDate(), target);
  }
  const config = getPlanet(id);
  if (config.orbitRadius === 0) return target.set(0, 0, 0);
  return target.set(config.orbitRadius, 0, 0);
}

export function RoutePathLine() {
  const { routeWaypoints, routeActive } = useExplorer();

  const absolutePoints = useMemo(
    () => routeWaypoints.map(() => new THREE.Vector3()),
    [routeWaypoints],
  );

  useFrame(() => {
    if (!routeActive || routeWaypoints.length < 2) return;
    for (let i = 0; i < routeWaypoints.length; i += 1) {
      resolveAbsolute(routeWaypoints[i], absolutePoints[i]);
    }
  }, RENDER_FRAME_PRIORITY.controls);

  if (!routeActive || routeWaypoints.length < 2) return null;

  return (
    <StableOrbitLine
      absolutePoints={absolutePoints}
      color="#5b9fff"
      lineWidth={1}
      transparent
      opacity={0.45}
      dashed
      dashSize={0.015}
      gapSize={0.009}
    />
  );
}
