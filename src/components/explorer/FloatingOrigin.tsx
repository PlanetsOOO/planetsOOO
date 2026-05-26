"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import {
  getFloatingOriginOffset,
  getRenderClipPlanes,
  syncFloatingOrigin,
} from "@/lib/coordinates/frame";

export function FloatingOrigin({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ camera }) => {
    syncFloatingOrigin();

    if (groupRef.current) {
      getFloatingOriginOffset(groupRef.current.position);
    }

    const cam = camera as THREE.PerspectiveCamera;
    if ("fov" in cam) {
      const { near, far } = getRenderClipPlanes();
      if (cam.near !== near || cam.far !== far) {
        cam.near = near;
        cam.far = far;
        cam.updateProjectionMatrix();
      }
    }
  });

  return <group ref={groupRef}>{children}</group>;
}
