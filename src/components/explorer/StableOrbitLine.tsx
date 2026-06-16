"use client";

import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ComponentProps } from "react";
import * as THREE from "three";
import type { Line2 } from "three-stdlib";
import { absoluteToRenderSpace } from "@/lib/coordinates/frame";
import { RENDER_FRAME_PRIORITY } from "@/lib/renderFramePriority";

type StableOrbitLineProps = {
  absolutePoints: readonly THREE.Vector3[];
} & Omit<ComponentProps<typeof Line>, "points" | "ref">;

export function StableOrbitLine({
  absolutePoints,
  ...lineProps
}: StableOrbitLineProps) {
  const lineRef = useRef<Line2>(null);
  const scratch = useRef<THREE.Vector3[]>([]);
  const positionBuffer = useRef<Float32Array | null>(null);

  useEffect(() => {
    scratch.current = absolutePoints.map(() => new THREE.Vector3());
    positionBuffer.current = new Float32Array(absolutePoints.length * 3);
  }, [absolutePoints]);

  const initialPoints = useMemo(
    () =>
      absolutePoints.map((point) =>
        absoluteToRenderSpace(point, new THREE.Vector3()),
      ),
    [absolutePoints],
  );

  useFrame(() => {
    const line = lineRef.current;
    const buffer = positionBuffer.current;
    const renderPoints = scratch.current;
    if (
      !line?.geometry ||
      !buffer ||
      renderPoints.length !== absolutePoints.length
    ) {
      return;
    }

    for (let i = 0; i < absolutePoints.length; i += 1) {
      absoluteToRenderSpace(absolutePoints[i], renderPoints[i]);
      const offset = i * 3;
      buffer[offset] = renderPoints[i].x;
      buffer[offset + 1] = renderPoints[i].y;
      buffer[offset + 2] = renderPoints[i].z;
    }

    line.geometry.setPositions(buffer);
    line.computeLineDistances();
  }, RENDER_FRAME_PRIORITY.bodies);

  if (absolutePoints.length < 2) {
    return null;
  }

  return <Line ref={lineRef} points={initialPoints} {...lineProps} />;
}
