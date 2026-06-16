"use client";

import { useMemo } from "react";
import type { PlanetId } from "@/data/planets";
import { sampleOrbitPath } from "@/lib/astronomy/ephemeris";
import * as THREE from "three";
import { StableOrbitLine } from "./StableOrbitLine";

interface OrbitRingProps {
  planetId: Exclude<PlanetId, "sun">;
}

export function OrbitRing({ planetId }: OrbitRingProps) {
  const isEarth = planetId === "earth";

  const absolutePoints = useMemo(() => {
    const flat = sampleOrbitPath(planetId, 256);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < flat.length; i += 3) {
      pts.push(new THREE.Vector3(flat[i], flat[i + 1], flat[i + 2]));
    }
    return pts;
  }, [planetId]);

  return (
    <StableOrbitLine
      absolutePoints={absolutePoints}
      color={isEarth ? "#5a9fd4" : "#3d4f6f"}
      transparent
      opacity={isEarth ? 0.62 : 0.35}
      lineWidth={isEarth ? 1.6 : 1}
    />
  );
}
