"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getRenderClipPlanes } from "@/lib/coordinates/frame";
import { getSunWorldPosition } from "@/lib/viewerState";

const sunWorld = new THREE.Vector3();

/** Sun-centered lighting with soft shadows in heliocentric space. */
export function SunLighting() {
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(() => {
    if (!lightRef.current) return;
    getSunWorldPosition(sunWorld);
    lightRef.current.position.copy(sunWorld);
    const { far } = getRenderClipPlanes();
    lightRef.current.shadow.camera.far = far;
  });

  return (
    <>
      <hemisphereLight
        args={["#1a2848", "#050508", 0.08]}
        position={[0, 1, 0]}
      />
      <ambientLight intensity={0.015} color="#0c1020" />
      <pointLight
        ref={lightRef}
        intensity={3.2}
        color="#fff4dc"
        distance={0}
        decay={0}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-bias={-0.00002}
        shadow-normalBias={0.015}
        shadow-camera-near={0.01}
        shadow-camera-far={400}
      />
    </>
  );
}
