"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { unitsPerSecToKmPerSec } from "@/data/astronomy";
import { useExplorer } from "@/context/ExplorerContext";
import {
  completeEarthLanding,
  computeEarthApproachDetail,
  earthApproachState,
  getEarthDescentSpeed,
  getEarthDescentTargetRatio,
  isEarthLandingPhase,
  resolveEarthBodyPosition,
} from "@/lib/earthApproach";
import { EARTH_LANDING_VIEW_RATIO, EARTH_SURFACE_RATIO } from "@/data/earthApproachStack";
import { getPlanet } from "@/data/planets";
import { applyCameraAngles } from "@/lib/navigation";
import { steerToward } from "@/lib/flightPhysics";
import { viewerPosition } from "@/lib/viewerState";

interface EarthApproachControllerProps {
  yawRef: React.MutableRefObject<number>;
  pitchRef: React.MutableRefObject<number>;
  rollRef: React.MutableRefObject<number>;
}

const toCenter = new THREE.Vector3();
const bodyPos = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const normal = new THREE.Vector3();
const tangent = new THREE.Vector3();
const east = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);

export function EarthApproachController({
  yawRef,
  pitchRef,
  rollRef,
}: EarthApproachControllerProps) {
  const { camera } = useThree();
  const {
    setDisplaySpeedKmPerSec,
    setDisplayLightspeedMultiple,
    endAutopilotTransit,
  } = useExplorer();
  const landedRef = useRef(false);

  useFrame((_, delta) => {
    if (!earthApproachState.active) {
      landedRef.current = false;
      return;
    }

    if (earthApproachState.phase === "landed") {
      setDisplaySpeedKmPerSec(0);
      setDisplayLightspeedMultiple(0);
      applyCameraAngles(
        camera,
        yawRef.current,
        pitchRef.current,
        rollRef.current,
      );
      return;
    }

    if (earthApproachState.phase === "cinematic") {
      applyCameraAngles(
        camera,
        yawRef.current,
        pitchRef.current,
        rollRef.current,
      );
      return;
    }

    const earth = resolveEarthBodyPosition(bodyPos);
    if (!earth) return;

    const radius = getPlanet("earth").radius;
    const dt = Math.min(delta, 0.05);
    const distanceRatio = viewerPosition.distanceTo(earth) / radius;
    const detail = computeEarthApproachDetail(distanceRatio);
    const targetRatio = getEarthDescentTargetRatio(detail);
    const targetDist = targetRatio * radius;

    toCenter.copy(earth).sub(viewerPosition);
    const dist = toCenter.length();

    if (isEarthLandingPhase(distanceRatio) && dist <= radius * 0.0025) {
      if (!landedRef.current) {
        completeEarthLanding(yawRef, pitchRef);
        endAutopilotTransit();
        landedRef.current = true;
      }
      applyCameraAngles(
        camera,
        yawRef.current,
        pitchRef.current,
        rollRef.current,
      );
      return;
    }

    if (dist > targetDist + 1e-6) {
      const speed = getEarthDescentSpeed(detail);
      const step = Math.min(speed * dt, dist - targetDist);
      toCenter.normalize();
      viewerPosition.addScaledVector(toCenter, step);
      setDisplaySpeedKmPerSec(unitsPerSecToKmPerSec(step / Math.max(dt, 1e-6)));
      setDisplayLightspeedMultiple(0);
    } else {
      setDisplaySpeedKmPerSec(0);
      setDisplayLightspeedMultiple(0);
    }

    const landingBlend = isEarthLandingPhase(distanceRatio)
      ? 1 -
        THREE.MathUtils.smoothstep(
          EARTH_SURFACE_RATIO,
          EARTH_LANDING_VIEW_RATIO,
          distanceRatio,
        )
      : 0;

    steerToward(yawRef, pitchRef, viewerPosition, earth, dt, 2.4);

    if (landingBlend > 0.01) {
      normal.copy(viewerPosition).sub(earth).normalize();
      east.crossVectors(worldUp, normal);
      if (east.lengthSq() < 1e-6) {
        east.set(0, 0, 1);
      } else {
        east.normalize();
      }
      tangent.crossVectors(normal, east).normalize();
      lookTarget.copy(viewerPosition).add(tangent);
      steerToward(yawRef, pitchRef, viewerPosition, lookTarget, dt, 1.8 * landingBlend);
      pitchRef.current = THREE.MathUtils.lerp(
        pitchRef.current,
        0,
        1 - Math.exp(-2.5 * dt * landingBlend),
      );
    }

    applyCameraAngles(
      camera,
      yawRef.current,
      pitchRef.current,
      rollRef.current,
    );
  });

  return null;
}
