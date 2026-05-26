"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";
import { isMoonTarget, type NavTargetId } from "@/data/navigationTargets";
import { getPlanet } from "@/data/planets";
import { getMoonHeliocentricPosition } from "@/lib/astronomy/moonEphemeris";
import { getSimulationDate } from "@/lib/simulationTime";
import { useExplorer } from "@/context/ExplorerContext";
import { getTargetPosition } from "@/lib/targetPositions";
import { absoluteToRenderSpace } from "@/lib/coordinates/frame";

function resolveAbsolute(id: NavTargetId): THREE.Vector3 {
  const live = getTargetPosition(id);
  if (live) return live.clone();
  if (isMoonTarget(id)) {
    return getMoonHeliocentricPosition(getSimulationDate(), new THREE.Vector3());
  }
  const config = getPlanet(id);
  if (config.orbitRadius === 0) return new THREE.Vector3(0, 0, 0);
  return new THREE.Vector3(config.orbitRadius, 0, 0);
}

export function RoutePathLine() {
  const { routeWaypoints, routeActive } = useExplorer();
  const points = useRef<THREE.Vector3[]>([]);
  const { invalidate } = useThree();

  useFrame(() => {
    if (!routeActive || routeWaypoints.length < 2) {
      points.current = [];
      return;
    }
    points.current = routeWaypoints.map((id) => {
      const absolute = resolveAbsolute(id);
      return absoluteToRenderSpace(absolute, new THREE.Vector3());
    });
    invalidate();
  });

  if (!routeActive || routeWaypoints.length < 2) return null;

  const linePoints =
    points.current.length >= 2
      ? points.current
      : routeWaypoints.map((id) => resolveAbsolute(id));

  return (
    <Line
      points={linePoints}
      color="#5b9fff"
      lineWidth={1}
      transparent
      opacity={0.45}
      dashed
      dashSize={2000}
      gapSize={1200}
    />
  );
}
