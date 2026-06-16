"use client";

import { useMemo, useRef } from "react";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  AU_PER_LEGACY_UNIT,
  floatingOriginState,
} from "@/lib/coordinates/frame";
import { sampleMoonOrbitPath } from "@/lib/astronomy/moonEphemeris";
import { RENDER_FRAME_PRIORITY } from "@/lib/renderFramePriority";

export function MoonOrbitRing() {
  const groupRef = useRef<THREE.Group>(null);

  const linePoints = useMemo(() => {
    const flat = sampleMoonOrbitPath(128);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < flat.length; i += 3) {
      pts.push(
        new THREE.Vector3(flat[i], flat[i + 1], flat[i + 2]).multiplyScalar(
          AU_PER_LEGACY_UNIT,
        ),
      );
    }
    return pts;
  }, []);

  useFrame(() => {
    if (!groupRef.current) {
      return;
    }
    groupRef.current.position
      .copy(floatingOriginState.anchor)
      .multiplyScalar(-AU_PER_LEGACY_UNIT);
  }, RENDER_FRAME_PRIORITY.bodies);

  return (
    <group ref={groupRef}>
      <Line
        points={linePoints}
        color="#8aa0b8"
        transparent
        opacity={0.45}
        lineWidth={1.2}
      />
    </group>
  );
}
