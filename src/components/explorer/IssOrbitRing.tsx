"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getHeliocentricPosition } from "@/lib/astronomy/ephemeris";
import { isIssOrbitLocked, sampleIssGeocentricOrbitPath } from "@/lib/astronomy/issEphemeris";
import { getSimulationDate } from "@/lib/simulationTime";
import { shouldRunThrottled } from "@/lib/throttledTick";
import { RENDER_FRAME_PRIORITY } from "@/lib/renderFramePriority";
import { StableOrbitLine } from "./StableOrbitLine";

/** One LEO revolution — enough segments for a smooth ~400 km ring. */
const SEGMENTS = 256;

export function IssOrbitRing() {
  const geocentricPoints = useMemo(
    () => Array.from({ length: SEGMENTS + 1 }, () => new THREE.Vector3()),
    [],
  );
  const absolutePoints = useMemo(
    () => Array.from({ length: SEGMENTS + 1 }, () => new THREE.Vector3()),
    [],
  );
  const earthHelio = useRef(new THREE.Vector3());
  const lockedRef = useRef(false);

  const refreshGeocentricPath = (date = getSimulationDate()) => {
    const flat = sampleIssGeocentricOrbitPath(SEGMENTS, date);
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
    const locked = isIssOrbitLocked();
    if (locked && !lockedRef.current) {
      refreshGeocentricPath();
    }
    lockedRef.current = locked;

    if (!locked && shouldRunThrottled("iss-orbit-path", 4000)) {
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
      color="#7ec8ff"
      transparent
      opacity={0.72}
      lineWidth={1.4}
    />
  );
}
