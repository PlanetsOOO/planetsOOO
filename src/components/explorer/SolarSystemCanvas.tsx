"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useLayoutEffect, useState } from "react";
import * as THREE from "three";
import { useExplorer } from "@/context/ExplorerContext";
import { useCoarsePointer } from "@/hooks/useCoarsePointer";
import { useDocumentVisible } from "@/hooks/useDocumentVisible";
import { getRenderClipPlanes } from "@/lib/coordinates/frame";
import { TextureWarmup } from "@/lib/preloadTextures";
import { isScreensaverMode } from "@/lib/screensaverConfig";
import { activateScreensaverScenicTour } from "@/lib/screensaverScenic";
import { hasWebGLSupport } from "@/lib/webglSupport";
import { SolarSystemScene } from "./SolarSystemScene";

const INITIAL_CLIP = getRenderClipPlanes();

function WebGLFallback() {
  return (
    <div className="absolute inset-0 z-0 flex items-center justify-center bg-[#030508] px-8 text-center">
      <div className="max-w-sm space-y-3">
        <p className="text-sm text-zinc-300">3D view unavailable</p>
        <p className="text-xs leading-relaxed text-zinc-500">
          WebGL could not start on this device. Try Safari or Chrome, disable
          content blockers, and reload. On local dev use your Mac IP, not
          localhost.
        </p>
      </div>
    </div>
  );
}

export default function SolarSystemCanvas() {
  const { dismissInfo } = useExplorer();
  const isMobile = useCoarsePointer();
  const documentVisible = useDocumentVisible();
  const screensaver = isScreensaverMode();
  const [clientReady, setClientReady] = useState(screensaver);
  const [webglOk, setWebglOk] = useState(true);
  const [canvasError, setCanvasError] = useState(false);

  useLayoutEffect(() => {
    if (screensaver) activateScreensaverScenicTour();
  }, [screensaver]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setWebglOk(hasWebGLSupport());
      setClientReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (/webgl|three|texture/i.test(String(e.message))) {
        setCanvasError(true);
      }
    };
    window.addEventListener("error", onError);
    return () => window.removeEventListener("error", onError);
  }, []);

  if (!clientReady) {
    return (
      <div
        className="absolute inset-0 z-0 bg-[#030508]"
        aria-busy="true"
        aria-label="Loading 3D view"
      />
    );
  }

  if (!webglOk || canvasError) {
    return <WebGLFallback />;
  }

  return (
    <div className="absolute inset-0 z-0">
      <Canvas
        frameloop={documentVisible ? "always" : "never"}
        shadows={!isMobile ? "percentage" : false}
        camera={{
          position: [0, 0, 0],
          fov: 55,
          near: INITIAL_CLIP.near,
          far: INITIAL_CLIP.far,
        }}
        gl={{
          antialias: !isMobile,
          alpha: false,
          logarithmicDepthBuffer: !isMobile,
          powerPreference: isMobile ? "low-power" : "high-performance",
          failIfMajorPerformanceCaveat: false,
        }}
        dpr={isMobile ? [1, 1.25] : [1, 2]}
        onCreated={({ gl }) => {
          if (!isMobile) {
            gl.shadowMap.enabled = true;
          }
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
        onPointerMissed={() => dismissInfo()}
      >
        <Suspense
          fallback={
            <mesh visible={false}>
              <boxGeometry args={[0.001, 0.001, 0.001]} />
            </mesh>
          }
        >
          <TextureWarmup />
          <SolarSystemScene />
        </Suspense>
      </Canvas>
    </div>
  );
}
