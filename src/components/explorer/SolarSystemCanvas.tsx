"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import * as THREE from "three";
import { useExplorer } from "@/context/ExplorerContext";
import { getRenderClipPlanes } from "@/lib/coordinates/frame";
import { TextureWarmup } from "@/lib/preloadTextures";
import { SolarSystemScene } from "./SolarSystemScene";

const INITIAL_CLIP = getRenderClipPlanes();

export default function SolarSystemCanvas() {
  const { dismissInfo } = useExplorer();

  return (
    <div className="absolute inset-0">
      <Canvas
        shadows
        camera={{
          position: [0, 0, 0],
          fov: 55,
          near: INITIAL_CLIP.near,
          far: INITIAL_CLIP.far,
        }}
        gl={{
          antialias: true,
          alpha: false,
          logarithmicDepthBuffer: true,
        }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
        dpr={[1, 2]}
        onPointerMissed={() => dismissInfo()}
      >
        <Suspense fallback={null}>
          <TextureWarmup />
          <SolarSystemScene />
        </Suspense>
      </Canvas>
    </div>
  );
}
