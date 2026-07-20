"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import type { NavTargetId } from "@/data/navigationTargets";
import { useExplorer } from "@/context/ExplorerContext";
import { resolveNavTargetHeliocentric } from "@/lib/navTargetBody";
import { RENDER_FRAME_PRIORITY } from "@/lib/renderFramePriority";
import { StableOrbitLine } from "./StableOrbitLine";

function resolveAbsolute(id: NavTargetId, target = new THREE.Vector3()): THREE.Vector3 {
  return resolveNavTargetHeliocentric(id, target) ?? target.set(0, 0, 0);
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
