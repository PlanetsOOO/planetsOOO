"use client";

import { useMemo, useRef } from "react";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { PlanetId } from "@/data/planets";
import {
  AU_PER_LEGACY_UNIT,
  floatingOriginState,
} from "@/lib/coordinates/frame";
import { sampleOrbitPath } from "@/lib/astronomy/ephemeris";
import { RENDER_FRAME_PRIORITY } from "@/lib/renderFramePriority";
import * as THREE from "three";

interface OrbitRingProps {
  planetId: Exclude<PlanetId, "sun">;
}

export function OrbitRing({ planetId }: OrbitRingProps) {
  const isEarth = planetId === "earth";
  const groupRef = useRef<THREE.Group>(null);

  const linePoints = useMemo(() => {
    const flat = sampleOrbitPath(planetId, 256);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < flat.length; i += 3) {
      pts.push(
        new THREE.Vector3(flat[i], flat[i + 1], flat[i + 2]).multiplyScalar(
          AU_PER_LEGACY_UNIT,
        ),
      );
    }
    return pts;
  }, [planetId]);

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
        color={isEarth ? "#5a9fd4" : "#3d4f6f"}
        transparent
        opacity={isEarth ? 0.62 : 0.35}
        lineWidth={isEarth ? 1.6 : 1}
      />
    </group>
  );
}
