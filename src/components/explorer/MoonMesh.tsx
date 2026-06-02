"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { MOON } from "@/data/moon";
import { flightReticleState } from "@/lib/flightReticleState";
import { useExplorer } from "@/context/ExplorerContext";
import {
  getMoonHeliocentricPosition,
  getMoonRotationAngle,
} from "@/lib/astronomy/moonEphemeris";
import {
  resolveMoonFocusActive,
  syncMoonFocusLock,
} from "@/lib/moonFocusLock";
import { angularDiameterPixels } from "@/lib/astronomy/scale";
import { createCircularSpriteMaterial } from "@/lib/materials/circularSprite";
import {
  computeLodLevel,
  getAnisotropyForLod,
  type LodLevel,
} from "@/lib/planetLod";
import { shouldRunThrottled } from "@/lib/throttledTick";
import { setTargetPosition } from "@/lib/targetPositions";
import { getSimulationDate } from "@/lib/simulationTime";
import {
  absoluteToRenderSpace,
  moonRenderRadius,
} from "@/lib/coordinates/frame";
import { BodyLabel } from "./BodyLabel";

const absolutePos = new THREE.Vector3();
const worldPos = new THREE.Vector3();

export function MoonMesh() {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const impostorRef = useRef<THREE.Points>(null);
  const visualScaleRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const {
    showLabels,
    autoNavigating,
    navTargetId,
    navigationActive,
    routeActive,
  } = useExplorer();
  const isNavTarget = autoNavigating && navTargetId === "moon";
  const isReticleTarget =
    navigationActive && flightReticleState.targetId === "moon";
  const isHighlighted = hovered || isNavTarget || isReticleTarget;
  const { gl, camera, size } = useThree();

  const texture = useTexture(MOON.texture);
  const impostorMat = useMemo(
    () => createCircularSpriteMaterial({ opacity: 0.78, depthWrite: false }),
    [],
  );

  const bodyMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: texture,
        color: MOON.color,
        roughness: 0.92,
        metalness: 0.04,
      }),
    [texture],
  );

  const lodRef = useRef<LodLevel>(0);
  const segmentsRef = useRef(16);
  const applyLod = (segments: number, level: LodLevel) => {
    if (segmentsRef.current === segments || !bodyRef.current) return;
    segmentsRef.current = segments;
    bodyRef.current.geometry.dispose();
    bodyRef.current.geometry = new THREE.SphereGeometry(
      MOON.radius,
      segments,
      segments,
    );
    const aniso = getAnisotropyForLod(level);
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    if (texture) {
      texture.anisotropy = Math.min(aniso, maxAniso);
      texture.needsUpdate = true;
    }
  };

  useFrame(() => {
    if (!groupRef.current || !bodyRef.current) return;

    syncMoonFocusLock(
      resolveMoonFocusActive({ navTargetId, autoNavigating, routeActive }),
      getSimulationDate(),
    );

    getMoonHeliocentricPosition(getSimulationDate(), absolutePos);
    setTargetPosition("moon", absolutePos);
    absoluteToRenderSpace(absolutePos, groupRef.current.position);
    groupRef.current.getWorldPosition(worldPos);

    bodyRef.current.rotation.y = getMoonRotationAngle();

    const renderRadius = moonRenderRadius();
    const sizeScale = renderRadius / MOON.radius;
    const dist = worldPos.length();
    const { level, segments } = computeLodLevel(dist, renderRadius);
    lodRef.current = level;

    const cam = camera as THREE.PerspectiveCamera;
    const px = angularDiameterPixels(
      renderRadius,
      dist,
      cam.fov,
      size.height,
    );
    const subPixel = px < 2.5 && !isNavTarget && !isHighlighted;

    bodyRef.current.visible = !subPixel || isHighlighted;
    if (impostorRef.current) {
      impostorRef.current.visible = subPixel;
      impostorMat.uniforms.uSize.value = Math.max(5, px);
      impostorMat.uniforms.uColor.value.set(MOON.color);
      impostorMat.uniforms.uOpacity.value = 0.78;
    }

    if (shouldRunThrottled("lod-moon", 90) && segmentsRef.current !== segments) {
      applyLod(segments, level);
    }

    if (visualScaleRef.current) {
      visualScaleRef.current.scale.setScalar(sizeScale);
    }

  });

  useEffect(() => {
    const body = bodyRef.current;
    return () => {
      body?.geometry.dispose();
      bodyMat.dispose();
    };
  }, [bodyMat]);

  return (
    <group ref={groupRef}>
      <group ref={visualScaleRef}>
        <mesh
          ref={bodyRef}
          material={bodyMat}
          castShadow
          receiveShadow
          onPointerOver={(e) => {
            if (navigationActive) return;
            e.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={() => setHovered(false)}
        >
          <sphereGeometry args={[MOON.radius, 16, 16]} />
        </mesh>

        {showLabels && (
          <BodyLabel
            id="moon"
            navTargetId="moon"
            name="Moon"
            bodyRadius={MOON.radius}
            bodyCenterRef={visualScaleRef}
            highlighted={isHighlighted}
          />
        )}
      </group>

      <points ref={impostorRef} visible={false} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, 0, 0]), 3]}
          />
        </bufferGeometry>
        <primitive object={impostorMat} attach="material" />
      </points>
    </group>
  );
}
