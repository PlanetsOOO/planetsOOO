"use client";

import { useMemo, useRef } from "react";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { absoluteToRenderSpace } from "@/lib/coordinates/frame";
import { sampleMoonOrbitPath } from "@/lib/astronomy/moonEphemeris";
import { RENDER_FRAME_PRIORITY } from "@/lib/renderFramePriority";

export function MoonOrbitRing() {
  const renderPointsRef = useRef<THREE.Vector3[]>([]);

  const absolutePoints = useMemo(() => {
    const flat = sampleMoonOrbitPath(128);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < flat.length; i += 3) {
      pts.push(new THREE.Vector3(flat[i], flat[i + 1], flat[i + 2]));
    }
    return pts;
  }, []);

  useFrame(() => {
    if (renderPointsRef.current.length !== absolutePoints.length) {
      renderPointsRef.current = absolutePoints.map(() => new THREE.Vector3());
    }
    for (let i = 0; i < absolutePoints.length; i += 1) {
      absoluteToRenderSpace(absolutePoints[i], renderPointsRef.current[i]);
    }
  }, RENDER_FRAME_PRIORITY.bodies);

  const linePoints =
    renderPointsRef.current.length >= 2
      ? renderPointsRef.current
      : absolutePoints;

  return (
    <Line
      points={linePoints}
      color="#8aa0b8"
      transparent
      opacity={0.45}
      lineWidth={1.2}
    />
  );
}
