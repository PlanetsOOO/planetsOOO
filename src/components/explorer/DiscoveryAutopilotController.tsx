"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getPlanet } from "@/data/planets";
import { unitsPerSecToKmPerSec } from "@/data/astronomy";
import { isMoonTarget, type NavTargetId } from "@/data/navigationTargets";
import { getMoonHeliocentricPosition } from "@/lib/astronomy/moonEphemeris";
import { useExplorer } from "@/context/ExplorerContext";
import { getHeliocentricPosition } from "@/lib/astronomy/ephemeris";
import { orbitPositionAtPhase, type OrbitFrame } from "@/lib/bodyOrbit";
import {
  beginDiscoveryDeparture,
  canDiscoveryBeginTransit,
  canDiscoveryDepartOrbit,
  discoveryAutopilotState,
  discoveryCameraBlendRate,
  discoveryDepartCameraBlendRate,
  discoveryPassProgressFactor,
  discoveryPassSpeed,
  discoveryOrbitCameraBlendRate,
  ensureDiscoveryQueuedTarget,
  getDiscoveryOrbitFov,
  getDiscoveryPassDirection,
  hasDiscoveryCompletedFullOrbit,
  isDiscoveryOrbitLookAheadActive,
  markDiscoveryLegAdvancePending,
  shouldDiscoveryAutopilotControlPov,
  syncDiscoveryFocusFromPov,
  updateDiscoveryDepartLookBlend,
  updateDiscoveryOrbitLookBlend,
} from "@/lib/discoveryAutopilot";
import {
  canRouteDepartOrbit,
  endRouteObserve,
  markRouteDeparture,
  markRouteLegAdvancePending,
  routeCameraBlendRate,
  routeTourState,
} from "@/lib/routeTour";
import { SCENIC_ORBIT_OMEGA } from "@/lib/scenicTransit";
import {
  applyCameraAngles,
  cameraAnglesFromPosition,
} from "@/lib/navigation";
import { getSimulationDate } from "@/lib/simulationTime";
import { earthApproachState } from "@/lib/earthApproach";
import { getTargetPosition, setTargetPosition } from "@/lib/targetPositions";
import { viewerPosition } from "@/lib/viewerState";

interface DiscoveryAutopilotControllerProps {
  yawRef: React.MutableRefObject<number>;
  pitchRef: React.MutableRefObject<number>;
}

const planetWorkFrame: OrbitFrame = {
  radius: 0,
  phase: 0,
  u: new THREE.Vector3(),
  v: new THREE.Vector3(),
};

const fallbackPos = new THREE.Vector3();
const lookBlendPos = new THREE.Vector3();
const passDir = new THREE.Vector3();

function resolveBodyPosition(id: NavTargetId): THREE.Vector3 | null {
  const live = getTargetPosition(id);
  if (live) return live;
  if (isMoonTarget(id)) {
    getMoonHeliocentricPosition(getSimulationDate(), fallbackPos);
    setTargetPosition(id, fallbackPos);
    return fallbackPos;
  }
  const config = getPlanet(id);
  getHeliocentricPosition(
    id,
    config.orbitRadius,
    getSimulationDate(),
    fallbackPos,
  );
  setTargetPosition(id, fallbackPos);
  return fallbackPos;
}

function applyOrbitLookAt(
  lookPos: THREE.Vector3,
  yawRef: React.MutableRefObject<number>,
  pitchRef: React.MutableRefObject<number>,
  camera: THREE.Camera,
  dt: number,
  blendRate: number,
  lookBlend = 0,
) {
  const { yaw: targetYaw, pitch: targetPitch } = cameraAnglesFromPosition(
    viewerPosition,
    lookPos,
  );

  let dyaw = targetYaw - yawRef.current;
  while (dyaw > Math.PI) dyaw -= Math.PI * 2;
  while (dyaw < -Math.PI) dyaw += Math.PI * 2;

  const blend = 1 - Math.exp(-blendRate * dt);

  if (lookBlend <= 0.001) {
    yawRef.current += dyaw * blend;
    pitchRef.current = THREE.MathUtils.lerp(
      pitchRef.current,
      targetPitch,
      blend,
    );
  } else {
    const angularEase = THREE.MathUtils.lerp(1, 0.45, lookBlend);
    const maxYawStep = (0.36 + blendRate * 0.24) * dt * angularEase;
    if (Math.abs(dyaw) > maxYawStep) {
      dyaw = Math.sign(dyaw) * maxYawStep;
    }

    const dpitch = targetPitch - pitchRef.current;
    const maxPitchStep = (0.28 + blendRate * 0.18) * dt * angularEase;
    const clampedDpitch =
      Math.abs(dpitch) > maxPitchStep
        ? Math.sign(dpitch) * maxPitchStep
        : dpitch;

    yawRef.current += dyaw * blend;
    pitchRef.current += clampedDpitch * blend;
  }

  applyCameraAngles(camera, yawRef.current, pitchRef.current);
}

export function DiscoveryAutopilotController({
  yawRef,
  pitchRef,
}: DiscoveryAutopilotControllerProps) {
  const {
    discoveryAutopilotActive,
    advanceDiscoveryLeg,
    advanceRouteLeg,
    autoNavigating,
    resumeDiscoveryTransit,
    setDisplaySpeedKmPerSec,
    setDisplayLightspeedMultiple,
  } = useExplorer();
  const { camera } = useThree();
  const activeRef = useRef(discoveryAutopilotActive);

  useEffect(() => {
    activeRef.current = discoveryAutopilotActive;
  }, [discoveryAutopilotActive]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    if (routeTourState.observing && routeTourState.observeTargetId) {
      const orbitId = routeTourState.observeTargetId;
      const currentPos = resolveBodyPosition(orbitId);
      const queuedId = routeTourState.queuedTargetId;
      const queuedPos = queuedId ? resolveBodyPosition(queuedId) : null;

      applyOrbitMotion(orbitId, dt);
      applyOrbitLookAt(
        currentPos ?? viewerPosition,
        yawRef,
        pitchRef,
        camera,
        dt,
        routeCameraBlendRate(),
      );

      if (
        currentPos &&
        canRouteDepartOrbit(viewerPosition, currentPos, queuedPos) &&
        markRouteLegAdvancePending()
      ) {
        endRouteObserve();
        markRouteDeparture();
        advanceRouteLeg();
      }
      return;
    }

    if (!activeRef.current) return;

    if (earthApproachState.active) return;

    if (
      discoveryAutopilotState.phase === "transit" &&
      !autoNavigating &&
      discoveryAutopilotState.currentTargetId
    ) {
      resumeDiscoveryTransit();
      return;
    }

    const orbitId = discoveryAutopilotState.currentTargetId;
    if (!orbitId) return;

    if (discoveryAutopilotState.phase === "depart") {
      ensureDiscoveryQueuedTarget();

      const currentPos = resolveBodyPosition(orbitId);
      const queuedId = discoveryAutopilotState.queuedTargetId;
      const queuedPos = queuedId ? resolveBodyPosition(queuedId) : null;
      if (!currentPos) return;

      const passFactor = discoveryPassProgressFactor();
      getDiscoveryPassDirection(
        viewerPosition,
        currentPos,
        orbitId,
        passDir,
      );
      const passSpeed = discoveryPassSpeed(orbitId) * passFactor;
      if (passFactor > 0.001) {
        viewerPosition.addScaledVector(passDir, passSpeed * dt);
      }

      if (queuedPos) {
        const focusBlend = updateDiscoveryDepartLookBlend(dt);
        lookBlendPos.lerpVectors(currentPos, queuedPos, focusBlend);
        applyOrbitLookAt(
          lookBlendPos,
          yawRef,
          pitchRef,
          camera,
          dt,
          discoveryDepartCameraBlendRate(focusBlend),
          focusBlend,
        );
        setDisplaySpeedKmPerSec(unitsPerSecToKmPerSec(passSpeed));
        setDisplayLightspeedMultiple(0);
      } else {
        applyOrbitLookAt(
          currentPos,
          yawRef,
          pitchRef,
          camera,
          dt,
          discoveryCameraBlendRate(),
        );
        setDisplaySpeedKmPerSec(unitsPerSecToKmPerSec(passSpeed));
        setDisplayLightspeedMultiple(0);
      }

      if (
        canDiscoveryBeginTransit(
          yawRef.current,
          pitchRef.current,
          queuedPos,
          currentPos,
          orbitId,
        ) &&
        markDiscoveryLegAdvancePending()
      ) {
        advanceDiscoveryLeg();
      }
      return;
    }

    if (discoveryAutopilotState.phase !== "orbit") {
      return;
    }

    ensureDiscoveryQueuedTarget();

    const currentPos = resolveBodyPosition(orbitId);
    const queuedId = discoveryAutopilotState.queuedTargetId;
    const queuedPos = queuedId ? resolveBodyPosition(queuedId) : null;

    applyOrbitMotion(orbitId, dt);

    setDisplaySpeedKmPerSec(0);
    setDisplayLightspeedMultiple(0);

    const autopilotPov = shouldDiscoveryAutopilotControlPov();

    if (autopilotPov) {
      const fullOrbitDone = hasDiscoveryCompletedFullOrbit(orbitId);
      const lookAheadActive =
        fullOrbitDone &&
        Boolean(currentPos && queuedPos) &&
        isDiscoveryOrbitLookAheadActive();

      if (lookAheadActive && currentPos && queuedPos) {
        const lookBlend = updateDiscoveryOrbitLookBlend(
          viewerPosition,
          currentPos,
          queuedPos,
          dt,
        );
        lookBlendPos.lerpVectors(currentPos, queuedPos, lookBlend);
        applyOrbitLookAt(
          lookBlendPos,
          yawRef,
          pitchRef,
          camera,
          dt,
          discoveryOrbitCameraBlendRate(lookBlend),
          lookBlend,
        );
      } else {
        if (currentPos && queuedPos) {
          updateDiscoveryOrbitLookBlend(
            viewerPosition,
            currentPos,
            queuedPos,
            dt,
          );
        }
        applyOrbitLookAt(
          currentPos ?? viewerPosition,
          yawRef,
          pitchRef,
          camera,
          dt,
          discoveryCameraBlendRate(),
        );
      }
    } else if (currentPos && queuedPos) {
      updateDiscoveryOrbitLookBlend(
        viewerPosition,
        currentPos,
        queuedPos,
        dt,
      );
      syncDiscoveryFocusFromPov(
        yawRef.current,
        pitchRef.current,
        currentPos,
        queuedPos,
      );
    }

    if (
      currentPos &&
      queuedPos &&
      canDiscoveryDepartOrbit(
        viewerPosition,
        currentPos,
        queuedPos,
        yawRef.current,
        pitchRef.current,
      )
    ) {
      beginDiscoveryDeparture();
    }

    const cam = camera as THREE.PerspectiveCamera;
    if ("fov" in cam) {
      const targetFov = getDiscoveryOrbitFov();
      cam.fov = THREE.MathUtils.lerp(
        cam.fov,
        targetFov,
        1 - Math.exp(-7 * dt),
      );
      cam.updateProjectionMatrix();
    }
  });

  return null;
}

function applyOrbitMotion(orbitTargetId: NavTargetId, dt: number) {
  const currentPos = resolveBodyPosition(orbitTargetId);
  if (!currentPos) return;

  const stored = discoveryAutopilotState.planetOrbitFrame;
  planetWorkFrame.radius = stored.radius;
  planetWorkFrame.u.copy(stored.u);
  planetWorkFrame.v.copy(stored.v);

  discoveryAutopilotState.planetOrbitPhase += SCENIC_ORBIT_OMEGA * dt;
  orbitPositionAtPhase(
    currentPos,
    planetWorkFrame,
    discoveryAutopilotState.planetOrbitPhase,
    viewerPosition,
  );
}
