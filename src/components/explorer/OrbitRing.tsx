"use client";

import { useMemo, useRef } from "react";
import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { PlanetId } from "@/data/planets";
import { absoluteToRenderSpace } from "@/lib/coordinates/frame";
import { sampleOrbitPath } from "@/lib/astronomy/ephemeris";
import * as THREE from "three";

interface OrbitRingProps {
  planetId: Exclude<PlanetId, "sun">;
}

export function OrbitRing({ planetId }: OrbitRingProps) {
  const isEarth = planetId === "earth";
  const renderPointsRef = useRef<THREE.Vector3[]>([]);

  const absolutePoints = useMemo(() => {
    const flat = sampleOrbitPath(planetId, 256);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < flat.length; i += 3) {
      pts.push(new THREE.Vector3(flat[i], flat[i + 1], flat[i + 2]));
    }
    return pts;
  }, [planetId]);

  useFrame(() => {
    if (renderPointsRef.current.length !== absolutePoints.length) {
      renderPointsRef.current = absolutePoints.map(() => new THREE.Vector3());
    }
    for (let i = 0; i < absolutePoints.length; i += 1) {
      absoluteToRenderSpace(absolutePoints[i], renderPointsRef.current[i]);
    }
  });

  const linePoints =
    renderPointsRef.current.length >= 2
      ? renderPointsRef.current
      : absolutePoints;

  return (
    <Line
      points={linePoints}
      color={isEarth ? "#5a9fd4" : "#3d4f6f"}
      transparent
      opacity={isEarth ? 0.62 : 0.35}
      lineWidth={isEarth ? 1.6 : 1}
    />
  );
}
