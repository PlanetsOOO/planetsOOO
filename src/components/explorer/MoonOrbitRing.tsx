"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getHeliocentricPosition } from "@/lib/astronomy/ephemeris";
import { sampleMoonGeocentricOrbitPath } from "@/lib/astronomy/moonEphemeris";
import { getSimulationDate } from "@/lib/simulationTime";
import { shouldRunThrottled } from "@/lib/throttledTick";
import { RENDER_FRAME_PRIORITY } from "@/lib/renderFramePriority";
import { StableOrbitLine } from "./StableOrbitLine";

const SEGMENTS = 128;

export function MoonOrbitRing() {
  const geocentricPoints = useMemo(
    () =>
      Array.from({ length: SEGMENTS + 1 }, () => new THREE.Vector3()),
    [],
  );
  const absolutePoints = useMemo(
    () =>
      Array.from({ length: SEGMENTS + 1 }, () => new THREE.Vector3()),
    [],
  );
  const earthHelio = useRef(new THREE.Vector3());

  const refreshGeocentricPath = (date = getSimulationDate()) => {
    const flat = sampleMoonGeocentricOrbitPath(SEGMENTS, date);
    for (let i = 0; i <= SEGMENTS; i += 1) {
      geocentricPoints[i].set(
        flat[i * 3],
        flat[i * 3 + 1],
        flat[i * 3 + 2],
      );
    }
  };

  useEffect(() => {
    refreshGeocentricPath();
  }, [geocentricPoints]);

  useFrame(() => {
    if (shouldRunThrottled("moon-orbit-path", 1500)) {
      refreshGeocentricPath();
    }

    const earth = earthHelio.current;
    getHeliocentricPosition("earth", 0, getSimulationDate(), earth);
    for (let i = 0; i <= SEGMENTS; i += 1) {
      absolutePoints[i].copy(geocentricPoints[i]).add(earth);
    }
    absolutePoints[SEGMENTS].copy(absolutePoints[0]);
  }, RENDER_FRAME_PRIORITY.bodies);

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
