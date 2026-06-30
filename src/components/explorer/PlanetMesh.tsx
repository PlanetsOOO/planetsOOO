"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { PlanetConfig } from "@/data/planets";
import { flightReticleState } from "@/lib/flightReticleState";
import { useExplorer } from "@/context/ExplorerContext";
import {
  getHeliocentricPosition,
  getRotationAngle,
} from "@/lib/astronomy/ephemeris";
import { createCircularSpriteMaterial } from "@/lib/materials/circularSprite";
import {
  applyEarthDayNightShader,
  updateEarthSunDirection,
} from "@/lib/materials/dayNightEarth";
import {
  computeApproachDetail,
} from "@/lib/approachLayers";
import {
  computeEarthApproachDetail,
  earthApproachState,
} from "@/lib/earthApproach";
import {
  loadApproachTextureByUrl,
  loadApproachTierTexture,
} from "@/lib/approachTextureLoader";
import { assetUrl } from "@/lib/assetUrl";
import {
  applyApproachPlanetShader,
  updateApproachPlanetUniforms,
} from "@/lib/materials/approachPlanet";
import {
  computeLodLevel,
  getAnisotropyForLod,
  shouldUseImpostor,
  type LodLevel,
} from "@/lib/planetLod";
import { shouldRunThrottled } from "@/lib/throttledTick";
import { RENDER_FRAME_PRIORITY } from "@/lib/renderFramePriority";
import { angularDiameterPixels } from "@/lib/astronomy/scale";
import { setTargetPosition } from "@/lib/targetPositions";
import { getSimulationDate } from "@/lib/simulationTime";
import { absoluteToRenderSpace, bodyRenderRadius } from "@/lib/coordinates/frame";
import { registerBodyOccluder, removeLabelOccluder } from "@/lib/labelOcclusion";
import { getSunWorldPosition, viewerPosition } from "@/lib/viewerState";
import { BodyLabel } from "./BodyLabel";

interface PlanetMeshProps {
  config: PlanetConfig;
}

const sunDir = new THREE.Vector3();
const sunPos = new THREE.Vector3();
const bodyPos = new THREE.Vector3();
const absolutePos = new THREE.Vector3();

export function PlanetMesh({ config }: PlanetMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  const impostorRef = useRef<THREE.Points>(null);
  const bodyMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const { selectedId, infoOpen, showLabels, openPlanetInfo, autoNavigating, navTargetId, navigationActive } =
    useExplorer();
  const isNavTarget =
    autoNavigating && navTargetId === config.id;
  const isReticleTarget =
    navigationActive && flightReticleState.targetId === config.id;
  const isHighlighted =
    (infoOpen && selectedId === config.id) ||
    isNavTarget ||
    isReticleTarget;
  const isSun = config.id === "sun";
  const isEarth = config.id === "earth";
  const { gl, camera, size } = useThree();
  const earthShaderReady = useRef(false);
  const approachShaderReady = useRef(false);
  const approachTierMaps = useRef<THREE.Texture[]>([]);
  const approachTierRequests = useRef(new Set<number>());
  const earthTextureCache = useRef(new Map<string, THREE.Texture>());
  const cloudMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const showImpostorRef = useRef(false);
  const impostorSizeRef = useRef(2);

  const textureUrls = useMemo(() => {
    const urls: Record<string, string> = { map: assetUrl(config.texture) };
    if (config.clouds) urls.clouds = assetUrl(config.clouds);
    if (config.nightMap) urls.night = assetUrl(config.nightMap);
    if (config.ringTexture) urls.ring = assetUrl(config.ringTexture);
    return urls;
  }, [config]);

  const textures = useTexture(textureUrls);
  const impostorMat = useMemo(
    () => createCircularSpriteMaterial({ opacity: 0.72, depthWrite: false }),
    [],
  );
  const worldPos = useRef(new THREE.Vector3());
  const lodRef = useRef<LodLevel>(0);
  const segmentsRef = useRef(16);
  const ringGroupRef = useRef<THREE.Group>(null);
  const visualScaleRef = useRef<THREE.Group>(null);

  const applyLod = (segments: number, level: LodLevel) => {
    if (segmentsRef.current === segments) return;
    segmentsRef.current = segments;

    const makeGeo = () =>
      new THREE.SphereGeometry(config.radius, segments, segments);

    if (bodyRef.current) {
      bodyRef.current.geometry.dispose();
      bodyRef.current.geometry = makeGeo();
    }
    if (cloudRef.current) {
      cloudRef.current.geometry.dispose();
      cloudRef.current.geometry = makeGeo();
    }

    const aniso = getAnisotropyForLod(level);
    const maxAniso = gl.capabilities.getMaxAnisotropy();
    for (const tex of approachTierMaps.current) {
      if (tex) {
        tex.anisotropy = Math.min(aniso, maxAniso);
        tex.needsUpdate = true;
      }
    }
  };

  useEffect(() => {
    const base = textures.map;
    approachTierMaps.current = [base, base, base];
    approachTierRequests.current.clear();
  }, [textures.map]);

  const requestApproachTier = (tierIndex: number, base: THREE.Texture) => {
    if (tierIndex <= 0 || approachTierRequests.current.has(tierIndex)) return;
    approachTierRequests.current.add(tierIndex);
    void loadApproachTierTexture(
      config.id,
      tierIndex as 0 | 1 | 2,
      base,
    ).then((texture) => {
      if (!approachTierMaps.current.length) return;
      approachTierMaps.current[tierIndex] = texture;
    });
  };

  const requestEarthTexture = (url: string, base: THREE.Texture) => {
    if (earthTextureCache.current.has(url)) return;
    earthTextureCache.current.set(url, base);
    void loadApproachTextureByUrl(url, base).then((texture) => {
      earthTextureCache.current.set(url, texture);
    });
  };

  useFrame(() => {
    if (!groupRef.current || !bodyRef.current) return;
    const simDate = getSimulationDate();

    getHeliocentricPosition(
      config.id,
      config.orbitRadius,
      simDate,
      absolutePos,
    );
    setTargetPosition(config.id, absolutePos);
    absoluteToRenderSpace(absolutePos, groupRef.current.position);

    groupRef.current.getWorldPosition(worldPos.current);

    bodyRef.current.rotation.y = getRotationAngle(config.id, simDate);

    const renderRadius = bodyRenderRadius(config.id);
    const sizeScale = renderRadius / config.radius;
    const dist = worldPos.current.length();
    const legacyDist = absolutePos.distanceTo(viewerPosition);
    const distanceRatio = legacyDist / Math.max(config.radius, 1e-6);
    const earthDetail = isEarth
      ? computeEarthApproachDetail(distanceRatio)
      : null;
    const genericApproach = isEarth
      ? null
      : computeApproachDetail(distanceRatio);
    const approachVisualActive = isEarth
      ? Boolean(earthDetail?.active || earthApproachState.active)
      : Boolean(genericApproach?.active);
    const approachLayer = isEarth
      ? (earthDetail?.layer ?? 0)
      : (genericApproach?.layer ?? 0);
    const { level, segments: lodSegments } = computeLodLevel(dist, renderRadius);
    const segments = approachVisualActive
      ? Math.max(
          isEarth ? (earthDetail?.segments ?? 16) : (genericApproach?.segments ?? 16),
          lodSegments,
        )
      : lodSegments;
    lodRef.current = level;

    const cam = camera as THREE.PerspectiveCamera;
    const px = angularDiameterPixels(
      renderRadius,
      dist,
      cam.fov,
      size.height,
    );
    const subPixel = shouldUseImpostor(
      px,
      showImpostorRef.current,
      isNavTarget || isHighlighted,
    );
    showImpostorRef.current = subPixel;
    impostorSizeRef.current = Math.max(6, px);

    if (bodyRef.current) {
      bodyRef.current.visible = !subPixel || isHighlighted;
    }
    if (cloudRef.current) {
      cloudRef.current.visible = !subPixel;
    }
    if (impostorRef.current) {
      impostorRef.current.visible = subPixel;
      impostorMat.uniforms.uSize.value = impostorSizeRef.current;
      impostorMat.uniforms.uColor.value.set(config.color);
      impostorMat.uniforms.uOpacity.value = isSun ? 0.95 : 0.72;
    }

    if (
      shouldRunThrottled(`lod-${config.id}`, 90) &&
      segmentsRef.current !== segments
    ) {
      applyLod(segments, level);
    }

    if (visualScaleRef.current) {
      visualScaleRef.current.scale.setScalar(sizeScale);
    }

    if (bodyMatRef.current && approachTierMaps.current.length === 3) {
      const tiers = approachTierMaps.current;
      const baseMap = textures.map;

      if (isEarth) {
        const detail = earthDetail ?? computeEarthApproachDetail(distanceRatio);
        requestEarthTexture(detail.textureUrl, baseMap);
        if (detail.nextTextureUrl) {
          requestEarthTexture(detail.nextTextureUrl, baseMap);
        }

        if (!approachShaderReady.current) {
          applyApproachPlanetShader(bodyMatRef.current, baseMap);
          approachShaderReady.current = true;
        }

        const mapA =
          earthTextureCache.current.get(detail.textureUrl) ?? baseMap;
        const mapB = detail.nextTextureUrl
          ? earthTextureCache.current.get(detail.nextTextureUrl) ?? mapA
          : mapA;
        if (bodyMatRef.current.map !== mapA) {
          bodyMatRef.current.map = mapA;
          bodyMatRef.current.needsUpdate = true;
        }
        updateApproachPlanetUniforms(
          bodyMatRef.current,
          mapB,
          approachVisualActive ? detail.blend : 0,
        );
      } else if (genericApproach) {
        if (approachVisualActive || isNavTarget) {
          requestApproachTier(genericApproach.tierB, baseMap);
          if (genericApproach.tierA !== genericApproach.tierB) {
            requestApproachTier(genericApproach.tierA, baseMap);
          }
          requestApproachTier(2, baseMap);
        }

        if (!approachShaderReady.current) {
          applyApproachPlanetShader(bodyMatRef.current, tiers[1] ?? tiers[0]);
          approachShaderReady.current = true;
        }

        const mapA = tiers[genericApproach.tierA] ?? tiers[0];
        const mapB = tiers[genericApproach.tierB] ?? mapA;
        if (bodyMatRef.current.map !== mapA) {
          bodyMatRef.current.map = mapA;
          bodyMatRef.current.needsUpdate = true;
        }
        updateApproachPlanetUniforms(
          bodyMatRef.current,
          mapB,
          approachVisualActive ? genericApproach.blend : 0,
        );
      }
    }

    if (cloudMatRef.current) {
      const cloudOpacity = approachVisualActive
        ? THREE.MathUtils.lerp(0.22, 0.58, approachLayer / 4)
        : 0.42;
      cloudMatRef.current.opacity = cloudOpacity;
    }

    if (isEarth && bodyMatRef.current) {
      getSunWorldPosition(sunPos);
      groupRef.current.getWorldPosition(bodyPos);
      sunDir.copy(sunPos).sub(bodyPos).normalize();
      if (!earthShaderReady.current) {
        applyEarthDayNightShader(bodyMatRef.current, sunDir);
        earthShaderReady.current = true;
      } else {
        updateEarthSunDirection(bodyMatRef.current, sunDir);
      }
    }

    registerBodyOccluder(
      config.id,
      visualScaleRef.current,
      renderRadius,
    );
  }, RENDER_FRAME_PRIORITY.bodies);

  useEffect(() => {
    return () => {
      removeLabelOccluder(config.id);
    };
  }, [config.id]);

  useEffect(() => {
    const body = bodyRef.current;
    const cloud = cloudRef.current;
    return () => {
      body?.geometry.dispose();
      cloud?.geometry.dispose();
    };
  }, []);

  const handleDoubleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    openPlanetInfo(config.id);
  };

  return (
    <group ref={groupRef}>
      <points
        ref={impostorRef}
        visible={false}
        frustumCulled={false}
        onDoubleClick={handleDoubleClick}
      >
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array([0, 0, 0]), 3]} />
        </bufferGeometry>
        <primitive object={impostorMat} attach="material" />
      </points>

      <group ref={visualScaleRef} rotation={[config.tilt, 0, 0]}>
        <mesh
          ref={bodyRef}
          castShadow={!isSun}
          receiveShadow={!isSun}
          onDoubleClick={handleDoubleClick}
        >
        <sphereGeometry args={[config.radius, 16, 16]} />
        <meshStandardMaterial
          ref={bodyMatRef}
          map={textures.map}
          color={config.color}
          transparent={false}
          opacity={1}
          emissive={isEarth ? "#224466" : (config.emissive ?? "#000000")}
          emissiveIntensity={
            isSun ? (config.emissiveIntensity ?? 0) : isEarth ? 0.85 : 0
          }
          emissiveMap={isSun ? textures.map : isEarth ? textures.night : undefined}
          roughness={isSun ? 1 : 0.92}
          metalness={isSun ? 0 : 0.04}
        />
      </mesh>

      {textures.clouds && (
        <mesh ref={cloudRef} receiveShadow castShadow={false} scale={1.008}>
          <sphereGeometry args={[config.radius, 16, 16]} />
          <meshStandardMaterial
            ref={cloudMatRef}
            map={textures.clouds}
            transparent
            opacity={0.42}
            depthWrite={false}
            roughness={1}
            metalness={0}
          />
        </mesh>
      )}

      {textures.ring && (
        <group ref={ringGroupRef} rotation={[Math.PI / 2, 0, 0]}>
          <mesh receiveShadow>
            <ringGeometry
              args={[config.radius * 1.35, config.radius * 2.15, 96]}
            />
            <meshStandardMaterial
              map={textures.ring}
              transparent
              opacity={0.88}
              side={THREE.DoubleSide}
              depthWrite={false}
              roughness={0.95}
              metalness={0}
            />
          </mesh>
        </group>
      )}

      {showLabels && (
        <BodyLabel
          id={config.id}
          navTargetId={config.id}
          name={config.name}
          bodyRadius={config.radius}
          bodyCenterRef={visualScaleRef}
          highlighted={isHighlighted}
        />
      )}
      </group>
    </group>
  );
}
