"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getPlanet, type PlanetId } from "@/data/planets";
import { useExplorer } from "@/context/ExplorerContext";
import { getHeliocentricPosition } from "@/lib/astronomy/ephemeris";
import {
  captureOrbitFrame,
  circularOrbitAngularSpeed,
  defaultOrbitFrame,
  distanceToBodyCenter,
  GRAVITY_BODY_IDS,
  isWithinOrbitZone,
  orbitPositionAtPhase,
  ORBIT_VISUAL_TIME_SCALE,
  type OrbitFrame,
} from "@/lib/bodyOrbit";
import {
  activateIdleOrbit,
  idleOrbitState,
  isIdleOrbitInactiveLongEnough,
  resetIdleOrbitActivityClock,
} from "@/lib/idleOrbitState";
import { discoveryAutopilotState } from "@/lib/discoveryAutopilot";
import { inputKeys } from "@/lib/inputState";
import {
  applyCameraAngles,
  cameraAnglesFromPosition,
} from "@/lib/navigation";
import { getSimulationDate } from "@/lib/simulationTime";
import { applySpawnView, viewerPosition } from "@/lib/viewerState";

interface IdleOrbitControllerProps {
  yawRef: React.MutableRefObject<number>;
  pitchRef: React.MutableRefObject<number>;
}

const bodyHelio = new THREE.Vector3();
const workFrame: OrbitFrame = {
  radius: 0,
  phase: 0,
  u: new THREE.Vector3(),
  v: new THREE.Vector3(),
};

const FLIGHT_KEYS = new Set(["w", "a", "s", "d", " ", "shift"]);

function copyFrame(from: OrbitFrame, to: OrbitFrame) {
  to.radius = from.radius;
  to.phase = from.phase;
  to.u.copy(from.u);
  to.v.copy(from.v);
}

function hasFlightInput(): boolean {
  for (const key of FLIGHT_KEYS) {
    if (inputKeys.has(key)) return true;
  }
  return false;
}

function getBodyHelio(id: PlanetId, target = bodyHelio) {
  const config = getPlanet(id);
  return getHeliocentricPosition(
    id,
    config.orbitRadius,
    getSimulationDate(),
    target,
  );
}

function resolveOrbitAnchor(): PlanetId | null {
  const current = idleOrbitState.anchorId;
  if (current) {
    const config = getPlanet(current);
    const dist = distanceToBodyCenter(
      viewerPosition,
      getBodyHelio(current),
    );
    if (isWithinOrbitZone(dist, config.radius)) {
      return current;
    }
  }

  let bestId: PlanetId | null = null;
  let bestDist = Infinity;

  for (const id of GRAVITY_BODY_IDS) {
    const config = getPlanet(id);
    const dist = distanceToBodyCenter(viewerPosition, getBodyHelio(id));
    if (isWithinOrbitZone(dist, config.radius) && dist < bestDist) {
      bestDist = dist;
      bestId = id;
    }
  }

  return bestId;
}

/**
 * Idle showcase orbit around any nearby gravitating body.
 * Stops on user movement; resumes after 20s idle within that body's orbit zone.
 */
export function IdleOrbitController({
  yawRef,
  pitchRef,
}: IdleOrbitControllerProps) {
  const { autoNavigating, discoveryAutopilotActive } = useExplorer();
  const { camera } = useThree();
  const spawned = useRef(false);

  useLayoutEffect(() => {
    applySpawnView();
    const earth = getPlanet("earth");
    defaultOrbitFrame(idleOrbitState.frame, earth.radius);
    copyFrame(idleOrbitState.frame, workFrame);
    idleOrbitState.anchorId = "earth";
    idleOrbitState.phase = 0;
    idleOrbitState.active = true;
    resetIdleOrbitActivityClock();

    const earthPos = getBodyHelio("earth");
    const { yaw, pitch } = cameraAnglesFromPosition(viewerPosition, earthPos);
    yawRef.current = yaw;
    pitchRef.current = pitch;
    applyCameraAngles(camera, yaw, pitch);
    spawned.current = true;
  }, [camera, yawRef, pitchRef]);

  useFrame((_, delta) => {
    if (!spawned.current || autoNavigating) return;
    if (
      discoveryAutopilotActive &&
      (discoveryAutopilotState.phase === "orbit" ||
        discoveryAutopilotState.phase === "depart")
    ) {
      return;
    }

    const dt = Math.min(delta, 0.05);

    if (!idleOrbitState.active) {
      if (discoveryAutopilotActive) return;

      const anchor = resolveOrbitAnchor();
      if (anchor && isIdleOrbitInactiveLongEnough() && !hasFlightInput()) {
        const config = getPlanet(anchor);
        captureOrbitFrame(
          viewerPosition,
          getBodyHelio(anchor),
          config.radius,
          workFrame,
        );
        copyFrame(workFrame, idleOrbitState.frame);
        idleOrbitState.phase = 0;
        activateIdleOrbit(anchor);
      }
      return;
    }

    const config = getPlanet(idleOrbitState.anchorId);
    const anchorPos = getBodyHelio(idleOrbitState.anchorId);
    const dist = distanceToBodyCenter(viewerPosition, anchorPos);

    if (!isWithinOrbitZone(dist, config.radius)) {
      idleOrbitState.active = false;
      return;
    }

    copyFrame(idleOrbitState.frame, workFrame);

    const omega =
      circularOrbitAngularSpeed(
        workFrame.radius,
        idleOrbitState.anchorId,
        config.radius,
      ) * ORBIT_VISUAL_TIME_SCALE;
    idleOrbitState.phase += omega * dt;

    orbitPositionAtPhase(
      anchorPos,
      workFrame,
      idleOrbitState.phase,
      viewerPosition,
    );

    const { yaw, pitch } = cameraAnglesFromPosition(
      viewerPosition,
      anchorPos,
    );
    yawRef.current = yaw;
    pitchRef.current = pitch;
    applyCameraAngles(camera, yaw, pitch);
  });

  return null;
}
