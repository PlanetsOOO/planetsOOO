"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { ISS } from "@/data/iss";
import { getPlanet } from "@/data/planets";
import { useExplorer } from "@/context/ExplorerContext";
import { angularDiameterPixels } from "@/lib/astronomy/scale";
import { getHeliocentricPosition } from "@/lib/astronomy/ephemeris";
import {
  getIssHeliocentricPosition,
  getIssState,
} from "@/lib/astronomy/issEphemeris";
import { flightReticleState } from "@/lib/flightReticleState";
import {
  absoluteToRenderSpace,
  issRenderRadius,
} from "@/lib/coordinates/frame";
import { createCircularSpriteMaterial } from "@/lib/materials/circularSprite";
import {
  computeLodLevel,
  shouldUseImpostor,
  type LodLevel,
} from "@/lib/planetLod";
import {
  resolveIssFocusActive,
  resolveIssShowcaseActive,
  syncIssFocusLock,
} from "@/lib/issFocusLock";
import { registerBodyOccluder, removeLabelOccluder } from "@/lib/labelOcclusion";
import {
  buildIssModelGroup,
  createIssMaterials,
  getIssMeshDisplayScale,
  issModelToSceneScale,
  updateIssMaterialsForFocus,
} from "@/lib/models/issModel";
import {
  getTrackableFocusImpostorPx,
  isTrackableInEarthShadow,
} from "@/lib/trackableDisplay";
import { RENDER_FRAME_PRIORITY } from "@/lib/renderFramePriority";
import { setTargetPosition } from "@/lib/targetPositions";
import { getSimulationDate } from "@/lib/simulationTime";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { BodyLabel } from "./BodyLabel";

const absolutePos = new THREE.Vector3();
const worldPos = new THREE.Vector3();
const velocity = new THREE.Vector3();
const look = new THREE.Vector3(0, 0, 1);
const orient = new THREE.Quaternion();
const scratch = new THREE.Vector3();
const earthHelio = new THREE.Vector3();
const sunHelio = new THREE.Vector3();

export function IssMesh() {
  const groupRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group>(null);
  const visualScaleRef = useRef<THREE.Group>(null);
  const impostorRef = useRef<THREE.Points>(null);
  const {
    showLabels,
    autoNavigating,
    navTargetId,
    navigationActive,
    routeActive,
  } = useExplorer();
  const isNavTarget = autoNavigating && navTargetId === "iss";
  const isReticleTarget =
    navigationActive && flightReticleState.targetId === "iss";
  const isHighlighted = isNavTarget || isReticleTarget;
  const { camera, size } = useThree();

  const materials = useMemo(() => createIssMaterials(), []);
  const issModel = useMemo(
    () => buildIssModelGroup(materials),
    [materials],
  );
  const modelSceneScale = useMemo(() => issModelToSceneScale(), []);

  const impostorMat = useMemo(
    () =>
      createCircularSpriteMaterial({
        opacity: 0.95,
        depthWrite: false,
        additive: true,
      }),
    [],
  );

  const lodRef = useRef<LodLevel>(0);
  const showImpostorRef = useRef(false);

  useFrame(() => {
    if (!groupRef.current || !modelRef.current) return;

    const issInFocus = resolveIssFocusActive({
      navTargetId,
      autoNavigating,
      routeActive,
    });
    const issShowcase = resolveIssShowcaseActive({
      navTargetId,
      autoNavigating,
      routeActive,
    });

    syncIssFocusLock(issInFocus, getSimulationDate());

    getIssHeliocentricPosition(getSimulationDate(), absolutePos);
    setTargetPosition("iss", absolutePos);
    absoluteToRenderSpace(absolutePos, groupRef.current.position);
    groupRef.current.getWorldPosition(worldPos);

    const earth = getPlanet("earth");
    getHeliocentricPosition("earth", earth.orbitRadius, getSimulationDate(), earthHelio);
    getHeliocentricPosition("sun", 0, getSimulationDate(), sunHelio);
    const inEarthShadow = isTrackableInEarthShadow(
      absolutePos,
      earthHelio,
      sunHelio,
      earth.radius,
    );
    updateIssMaterialsForFocus(materials, issInFocus, inEarthShadow);

    const state = getIssState(getSimulationDate());
    velocity.copy(state.velocityKmS);
    if (velocity.lengthSq() > 1e-6) {
      look.copy(velocity).normalize();
      orient.setFromUnitVectors(scratch.set(1, 0, 0), look);
      modelRef.current.quaternion.copy(orient);
    }

    const renderRadius = issRenderRadius();
    const dist = worldPos.length();

    const { level } = computeLodLevel(dist, renderRadius);
    lodRef.current = level;

    const cam = camera as THREE.PerspectiveCamera;
    const truePx = angularDiameterPixels(
      renderRadius,
      dist,
      cam.fov,
      size.height,
    );

    const displayScale = getIssMeshDisplayScale(
      renderRadius,
      ISS.boundingRadius,
      truePx,
      issInFocus,
    );
    const effectivePx = angularDiameterPixels(
      renderRadius * displayScale * modelSceneScale,
      dist,
      cam.fov,
      size.height,
    );

    const subPixel = shouldUseImpostor(
      effectivePx,
      showImpostorRef.current,
      issInFocus || issShowcase,
    );
    showImpostorRef.current = subPixel;

    const showMesh = issInFocus && (issShowcase || !subPixel);
    modelRef.current.visible = showMesh;
    if (impostorRef.current) {
      impostorRef.current.visible = issInFocus && !showMesh;
      impostorMat.uniforms.uSize.value = getTrackableFocusImpostorPx(
        truePx,
        issInFocus,
      );
      impostorMat.uniforms.uColor.value.set(
        inEarthShadow ? "#ffffff" : ISS.impostorColor,
      );
      impostorMat.uniforms.uOpacity.value = inEarthShadow ? 1 : 0.94;
    }

    if (visualScaleRef.current) {
      visualScaleRef.current.scale.setScalar(displayScale * modelSceneScale);
    }

    registerBodyOccluder("iss", visualScaleRef.current, renderRadius);
  }, RENDER_FRAME_PRIORITY.bodies);

  useEffect(() => {
    return () => {
      removeLabelOccluder("iss");
      Object.values(materials).forEach((mat) => mat.dispose());
      issModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      });
    };
  }, [materials, issModel]);

  return (
    <group ref={groupRef}>
      <group ref={visualScaleRef}>
        <group ref={modelRef}>
          <primitive object={issModel} />
        </group>

        {showLabels && (
          <BodyLabel
            id="iss"
            navTargetId="iss"
            name="ISS"
            bodyRadius={ISS.boundingRadius}
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
