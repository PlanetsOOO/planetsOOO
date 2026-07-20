"use client";

import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { isIssTarget, type NavTargetId } from "@/data/navigationTargets";
import { useExplorer } from "@/context/ExplorerContext";
import { resolveNavTargetHeliocentric } from "@/lib/navTargetBody";
import { discoveryAutopilotState } from "@/lib/discoveryAutopilot";
import {
  applyIssShowcaseOrbit,
  advanceIssShowcasePhase,
} from "@/lib/issFocusView";
import {
  applyCameraAngles,
  cameraAnglesFromPosition,
} from "@/lib/navigation";
import { RENDER_FRAME_PRIORITY } from "@/lib/renderFramePriority";
import { getTrackableFocusOrbitFov, trackableFocusState } from "@/lib/trackableFocusState";
import { viewerPosition } from "@/lib/viewerState";

interface TrackableFocusControllerProps {
  yawRef: React.MutableRefObject<number>;
  pitchRef: React.MutableRefObject<number>;
  rollRef: React.MutableRefObject<number>;
}

const fallbackPos = new THREE.Vector3();

function resolveBodyPosition(id: NavTargetId): THREE.Vector3 | null {
  return resolveNavTargetHeliocentric(id, fallbackPos);
}

/**
 * Scenic orbit showcase when a small trackable (ISS) is focused outside discovery autopilot.
 */
export function TrackableFocusController({
  yawRef,
  pitchRef,
  rollRef,
}: TrackableFocusControllerProps) {
  const { autoNavigating, discoveryAutopilotActive } = useExplorer();
  const { camera } = useThree();

  useFrame((_, delta) => {
    if (!trackableFocusState.active || !trackableFocusState.targetId) return;
    if (autoNavigating || discoveryAutopilotActive) return;
    if (
      discoveryAutopilotState.active &&
      (discoveryAutopilotState.phase === "orbit" ||
        discoveryAutopilotState.phase === "depart" ||
        discoveryAutopilotState.phase === "transit")
    ) {
      return;
    }

    const targetId = trackableFocusState.targetId;
    if (!isIssTarget(targetId)) return;

    const bodyPos = resolveBodyPosition(targetId);
    if (!bodyPos) return;

    const dt = Math.min(delta, 0.05);
    trackableFocusState.phase += advanceIssShowcasePhase(dt);
    applyIssShowcaseOrbit(
      bodyPos,
      trackableFocusState.frame,
      trackableFocusState.phase,
      getTrackableFocusOrbitFov(),
      viewerPosition,
    );

    const { yaw, pitch } = cameraAnglesFromPosition(viewerPosition, bodyPos);
    const blend = 1 - Math.exp(-5.5 * dt);
    yawRef.current += (yaw - yawRef.current) * blend;
    pitchRef.current = THREE.MathUtils.lerp(pitchRef.current, pitch, blend);
    applyCameraAngles(camera, yawRef.current, pitchRef.current, rollRef.current);

    const cam = camera as THREE.PerspectiveCamera;
    if ("fov" in cam) {
      const targetFov = getTrackableFocusOrbitFov();
      cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, 1 - Math.exp(-7 * dt));
      cam.updateProjectionMatrix();
    }
  }, RENDER_FRAME_PRIORITY.controls);

  return null;
}
