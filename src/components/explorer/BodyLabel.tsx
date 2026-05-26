"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { NavTargetId } from "@/data/navigationTargets";
import { useExplorer } from "@/context/ExplorerContext";

const VIEW_MARGIN = 0.02;

const _bodyCenter = new THREE.Vector3();
const _bodyNdc = new THREE.Vector3();

export interface BodyLabelProps {
  id: string;
  navTargetId: NavTargetId;
  name: string;
  /** Geometry-space radius (inside visualScale group). */
  bodyRadius: number;
  bodyCenterRef: React.RefObject<THREE.Object3D | null>;
  highlighted?: boolean;
}

function sideOffset(id: string, radius: number): [number, number, number] {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (Math.imul(37, hash) + id.charCodeAt(i)) | 0;
  }
  const angle = ((Math.abs(hash) % 360) / 180) * Math.PI;
  const r = radius * 1.15;
  return [Math.cos(angle) * r, Math.sin(angle) * r, 0];
}

function bodyInView(ndc: THREE.Vector3): boolean {
  return (
    ndc.z >= -1 &&
    ndc.z <= 1 &&
    ndc.x >= -1 + VIEW_MARGIN &&
    ndc.x <= 1 - VIEW_MARGIN &&
    ndc.y >= -1 + VIEW_MARGIN &&
    ndc.y <= 1 - VIEW_MARGIN
  );
}

export function BodyLabel({
  navTargetId,
  name,
  bodyRadius,
  bodyCenterRef,
  highlighted = false,
}: BodyLabelProps) {
  const labelRef = useRef<THREE.Group>(null);
  const htmlRootRef = useRef<HTMLDivElement>(null);
  const { navigateToTarget } = useExplorer();
  const localOffset = useMemo(
    () => sideOffset(navTargetId, bodyRadius),
    [navTargetId, bodyRadius],
  );

  useFrame(({ camera }) => {
    const body = bodyCenterRef.current;
    const htmlRoot = htmlRootRef.current;
    if (!body || !htmlRoot) return;

    camera.updateMatrixWorld(true);
    body.getWorldPosition(_bodyCenter);
    _bodyNdc.copy(_bodyCenter).project(camera);

    const onScreen = bodyInView(_bodyNdc);
    htmlRoot.style.display = onScreen ? "block" : "none";
    htmlRoot.style.pointerEvents = onScreen ? "auto" : "none";
  });

  return (
    <group ref={labelRef} position={localOffset}>
      <Html
        center
        zIndexRange={[20, 0]}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div ref={htmlRootRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigateToTarget(navTargetId);
            }}
            className={`font-mono text-[9px] tracking-[0.2em] uppercase whitespace-nowrap border-0 bg-transparent p-0 cursor-pointer ${
              highlighted
                ? "text-[#b8cce0] opacity-65"
                : "text-[#8a9bb0] opacity-32"
            }`}
            style={{ textShadow: "0 0 5px rgba(0,0,0,0.5)" }}
          >
            {name}
          </button>
        </div>
      </Html>
    </group>
  );
}
