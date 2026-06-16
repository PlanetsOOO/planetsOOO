"use client";

import { useMemo } from "react";
import { sampleMoonOrbitPath } from "@/lib/astronomy/moonEphemeris";
import * as THREE from "three";
import { StableOrbitLine } from "./StableOrbitLine";

export function MoonOrbitRing() {
  const absolutePoints = useMemo(() => {
    const flat = sampleMoonOrbitPath(128);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < flat.length; i += 3) {
      pts.push(new THREE.Vector3(flat[i], flat[i + 1], flat[i + 2]));
    }
    return pts;
  }, []);

  return (
    <StableOrbitLine
      absolutePoints={absolutePoints}
      color="#8aa0b8"
      transparent
      opacity={0.45}
      lineWidth={1.2}
    />
  );
}
