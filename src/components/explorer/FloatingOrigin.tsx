"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import {
  absoluteToCameraSpace,
  getRenderClipPlanes,
  getFloatingOriginOffset,
  syncFloatingOrigin,
} from "@/lib/coordinates/frame";
import { RENDER_NEAR_AU } from "@/lib/trackableDisplay";
import { getTargetPosition } from "@/lib/targetPositions";
import { RENDER_FRAME_PRIORITY } from "@/lib/renderFramePriority";

const issCamDist = new THREE.Vector3();

export function FloatingOrigin({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ camera }) => {
    syncFloatingOrigin();

    if (groupRef.current) {
      getFloatingOriginOffset(groupRef.current.position);
    }

    let closestDistAu: number | undefined;
    const issPos = getTargetPosition("iss");
    if (issPos) {
      const distAu = absoluteToCameraSpace(issPos, issCamDist).length();
      if (distAu < RENDER_NEAR_AU * 3) {
        closestDistAu = distAu;
      }
    }

    const cam = camera as THREE.PerspectiveCamera;
    if ("fov" in cam) {
      const { near, far } = getRenderClipPlanes(closestDistAu);
      if (cam.near !== near || cam.far !== far) {
        cam.near = near;
        cam.far = far;
        cam.updateProjectionMatrix();
      }
    }
  }, RENDER_FRAME_PRIORITY.origin);

  return <group ref={groupRef}>{children}</group>;
}
