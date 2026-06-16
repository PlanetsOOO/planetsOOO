"use client";

import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { isMoonTarget, type NavTargetId } from "@/data/navigationTargets";
import { getPlanet } from "@/data/planets";
import { getMoonHeliocentricPosition } from "@/lib/astronomy/moonEphemeris";
import { getSimulationDate } from "@/lib/simulationTime";
import { useExplorer } from "@/context/ExplorerContext";
import { getTargetPosition } from "@/lib/targetPositions";
import {
  AU_PER_LEGACY_UNIT,
  floatingOriginState,
} from "@/lib/coordinates/frame";
import { RENDER_FRAME_PRIORITY } from "@/lib/renderFramePriority";

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
  const groupRef = useRef<THREE.Group>(null);

  const linePoints = useMemo(() => {
    if (!routeActive || routeWaypoints.length < 2) return [];
    return routeWaypoints.map((id) =>
      resolveAbsolute(id).multiplyScalar(AU_PER_LEGACY_UNIT),
    );
  }, [routeActive, routeWaypoints]);

  useFrame(() => {
    if (!groupRef.current) {
      return;
    }
    groupRef.current.position
      .copy(floatingOriginState.anchor)
      .multiplyScalar(-AU_PER_LEGACY_UNIT);
  }, RENDER_FRAME_PRIORITY.bodies);

  if (!routeActive || linePoints.length < 2) return null;

  return (
    <group ref={groupRef}>
      <Line
        points={linePoints}
        color="#5b9fff"
        lineWidth={1}
        transparent
        opacity={0.45}
        dashed
        dashSize={0.015}
        gapSize={0.009}
      />
    </group>
  );
}
