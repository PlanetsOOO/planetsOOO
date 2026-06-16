"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { FlightState } from "@/hooks/useFlightState";
import { createCircularSpriteMaterial } from "@/lib/materials/circularSprite";
import { RENDER_FRAME_PRIORITY } from "@/lib/renderFramePriority";
import { lightspeedState } from "@/lib/warpState";

const PARTICLE_COUNT = 160;

interface ThrustEffectProps {
  flightRef: React.MutableRefObject<FlightState>;
}

export function ThrustEffect({ flightRef }: ThrustEffectProps) {
  const { camera } = useThree();
  const pointsRef = useRef<THREE.Points>(null);
  const positionArray = useMemo(
    () => new Float32Array(PARTICLE_COUNT * 3),
    [],
  );
  const velocities = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => new THREE.Vector3()),
  );
  const life = useRef(new Float32Array(PARTICLE_COUNT));

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(positionArray, 3),
    );
    return geo;
  }, [positionArray]);

  const material = useMemo(
    () =>
      createCircularSpriteMaterial({
        opacity: 0,
        additive: true,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    [],
  );

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const { throttle, speed, lightspeedActive, lightspeedIntensity } =
      flightRef.current;
    const posAttr = pointsRef.current.geometry.attributes
      .position as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const intensity = lightspeedIntensity;
    const ludicrous = lightspeedState.ludicrous;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      camera.quaternion,
    );
    const exhaustDir = forward.clone().negate();

    const spawnRate = lightspeedActive
      ? (ludicrous ? 36 : 8) + intensity * (ludicrous ? 56 : 24)
      : throttle * (2.5 + speed * 0.25);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (life.current[i] > 0) {
        life.current[i] -= delta * (lightspeedActive ? 0.6 + intensity * 2 : 1 + speed * 0.04);
        arr[i * 3] += velocities.current[i].x * delta;
        arr[i * 3 + 1] += velocities.current[i].y * delta;
        arr[i * 3 + 2] += velocities.current[i].z * delta;
        velocities.current[i].multiplyScalar(lightspeedActive ? 0.985 : 0.94);
        continue;
      }

      if (
        (lightspeedActive && intensity > 0.02) ||
        (throttle > 0.08 && Math.random() < spawnRate * delta)
      ) {
        const spread = lightspeedActive ? 0.08 + intensity * 0.05 : 0.35;
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * spread,
          (Math.random() - 0.5) * (lightspeedActive ? 0.04 : 0.15),
        );
        const spawn = camera.position
          .clone()
          .add(exhaustDir.clone().multiplyScalar(lightspeedActive ? 0.2 : 0.55))
          .add(offset);

        arr[i * 3] = spawn.x;
        arr[i * 3 + 1] = spawn.y;
        arr[i * 3 + 2] = spawn.z;

        const streak = lightspeedActive
          ? 18 + intensity * 120
          : 1.2 + throttle * 2 + speed * 0.1;

        velocities.current[i]
          .copy(exhaustDir)
          .multiplyScalar(streak)
          .add(
            new THREE.Vector3(
              (Math.random() - 0.5) * (lightspeedActive ? 0.15 : 0.5),
              (Math.random() - 0.5) * (lightspeedActive ? 0.15 : 0.5),
              (Math.random() - 0.5) * (lightspeedActive ? 0.15 : 0.5),
            ),
          );

        life.current[i] = lightspeedActive
          ? 0.5 + intensity * 0.8
          : 0.25 + Math.random() * 0.2 * throttle;
      }
    }

    posAttr.needsUpdate = true;
    const targetOpacity = lightspeedActive
      ? 0.35 + intensity * 0.65
      : throttle * 0.7;
    const targetSize = lightspeedActive
      ? 0.15 + intensity * 0.55
      : 0.06 + throttle * 0.18 + speed * 0.015;
    material.uniforms.uOpacity.value = THREE.MathUtils.lerp(
      material.uniforms.uOpacity.value,
      targetOpacity,
      0.12,
    );
    material.uniforms.uSize.value = THREE.MathUtils.lerp(
      material.uniforms.uSize.value,
      targetSize * 100,
      0.12,
    );
    const color = material.uniforms.uColor.value as THREE.Color;
    if (lightspeedActive && intensity > 0.1) {
      color.lerp(new THREE.Color("#d8f0ff"), 0.08);
    } else {
      color.lerp(new THREE.Color("#7eb8ff"), 0.08);
    }
  }, RENDER_FRAME_PRIORITY.effects);

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled={false}>
      <primitive object={material} attach="material" />
    </points>
  );
}
