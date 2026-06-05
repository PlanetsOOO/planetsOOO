"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { type CSSProperties, useMemo, useRef } from "react";
import * as THREE from "three";
import type { NavTargetId } from "@/data/navigationTargets";
import { useExplorer } from "@/context/ExplorerContext";

const VIEW_MARGIN = 0.02;
const LEADER_PX = 28;
const LEADER_GAP_PX = 6;
const OVERLAP_PADDING_PX = 3;
const PERIMETER_MARGIN_PX = 24;
const DIRECTION_EPSILON = 0.0001;

const _bodyCenter = new THREE.Vector3();
const _bodyNdc = new THREE.Vector3();
const _cameraLocal = new THREE.Vector3();

export interface BodyLabelProps {
  id: string;
  navTargetId: NavTargetId;
  name: string;
  /** Geometry-space radius (inside visualScale group). */
  bodyRadius: number;
  bodyCenterRef: React.RefObject<THREE.Object3D | null>;
  highlighted?: boolean;
}

interface LabelLayout {
  offset: [number, number, number];
  xSign: 1 | -1;
  ySign: 1 | -1;
}

type PerimeterEdge = "left" | "right" | "top" | "bottom";

interface PerimeterMarker {
  edge: PerimeterEdge;
  x: number;
  y: number;
  lineAngle: number;
  transform: string;
}

function labelLayout(id: string, radius: number): LabelLayout {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (Math.imul(37, hash) + id.charCodeAt(i)) | 0;
  }
  const quadrants: Array<[1 | -1, 1 | -1]> = [
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ];
  const [xSign, ySign] = quadrants[Math.abs(hash) % quadrants.length];
  const r = radius * 1.55;
  const diagonal = r / Math.sqrt(2);

  return {
    offset: [xSign * diagonal, ySign * diagonal, 0],
    xSign,
    ySign,
  };
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

function inflatedRectsOverlap(a: DOMRect, b: DOMRect): boolean {
  return (
    a.left - OVERLAP_PADDING_PX < b.right &&
    a.right + OVERLAP_PADDING_PX > b.left &&
    a.top - OVERLAP_PADDING_PX < b.bottom &&
    a.bottom + OVERLAP_PADDING_PX > b.top
  );
}

function labelTextIsCrammed(label: HTMLButtonElement): boolean {
  const rect = label.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;

  const labels = document.querySelectorAll<HTMLButtonElement>(
    "[data-body-label-text]",
  );

  for (const other of labels) {
    if (other === label) continue;

    const otherRect = other.getBoundingClientRect();
    if (otherRect.width === 0 || otherRect.height === 0) continue;
    if (inflatedRectsOverlap(rect, otherRect)) return true;
  }

  return false;
}

function offscreenDirection(
  ndc: THREE.Vector3,
  camera: THREE.Camera,
  worldPosition: THREE.Vector3,
): [number, number] {
  if (
    ndc.z >= -1 &&
    ndc.z <= 1 &&
    Number.isFinite(ndc.x) &&
    Number.isFinite(ndc.y)
  ) {
    return [ndc.x, -ndc.y];
  }

  _cameraLocal.copy(worldPosition);
  camera.worldToLocal(_cameraLocal);

  const x = _cameraLocal.x;
  const y = -_cameraLocal.y;
  if (Math.abs(x) > DIRECTION_EPSILON || Math.abs(y) > DIRECTION_EPSILON) {
    return [x, y];
  }

  return [0, 1];
}

function edgeTransform(edge: PerimeterEdge): string {
  switch (edge) {
    case "left":
      return "translate(0, -50%)";
    case "right":
      return "translate(-100%, -50%)";
    case "top":
      return "translate(-50%, 0)";
    case "bottom":
      return "translate(-50%, -100%)";
  }
}

function perimeterMarker(
  directionX: number,
  directionY: number,
  width: number,
  height: number,
): PerimeterMarker {
  const centerX = width / 2;
  const centerY = height / 2;
  const maxX = Math.max(1, centerX - PERIMETER_MARGIN_PX);
  const maxY = Math.max(1, centerY - PERIMETER_MARGIN_PX);
  const dx =
    Math.abs(directionX) > DIRECTION_EPSILON ? directionX : DIRECTION_EPSILON;
  const dy =
    Math.abs(directionY) > DIRECTION_EPSILON ? directionY : DIRECTION_EPSILON;
  const scaleX = maxX / Math.abs(dx);
  const scaleY = maxY / Math.abs(dy);
  const hitsVerticalEdge = scaleX <= scaleY;
  const scale = hitsVerticalEdge ? scaleX : scaleY;
  const x = centerX + dx * scale;
  const y = centerY + dy * scale;
  const edge: PerimeterEdge = hitsVerticalEdge
    ? dx > 0
      ? "right"
      : "left"
    : dy > 0
      ? "bottom"
      : "top";

  return {
    edge,
    x,
    y,
    lineAngle: edge === "right" || edge === "top" ? 135 : 45,
    transform: edgeTransform(edge),
  };
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
  const leaderRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const perimeterRootRef = useRef<HTMLDivElement>(null);
  const perimeterLeaderRef = useRef<HTMLSpanElement>(null);
  const { navigateToTarget } = useExplorer();
  const layout = useMemo(
    () => labelLayout(navTargetId, bodyRadius),
    [navTargetId, bodyRadius],
  );
  const textFirst = layout.xSign < 0;
  const leaderAngle = layout.xSign === layout.ySign ? 135 : -135;
  const leaderStyle: CSSProperties = {
    width: LEADER_PX,
    display: "none",
    transform: `rotate(${leaderAngle}deg)`,
    transformOrigin: textFirst ? "right center" : "left center",
    top: "50%",
    ...(textFirst
      ? { right: -LEADER_PX - LEADER_GAP_PX }
      : { left: -LEADER_PX - LEADER_GAP_PX }),
  };
  const perimeterLeaderStyle: CSSProperties = {
    width: LEADER_PX,
    transform: "rotate(135deg)",
    transformOrigin: "center",
  };
  const labelButtonClassName = `font-mono text-[9px] tracking-[0.2em] uppercase whitespace-nowrap border-0 bg-transparent p-0 cursor-pointer ${
    highlighted ? "text-[#b8cce0] opacity-65" : "text-[#8a9bb0] opacity-32"
  }`;

  useFrame(({ camera, size }) => {
    const body = bodyCenterRef.current;
    const htmlRoot = htmlRootRef.current;
    if (!body || !htmlRoot) return;

    camera.updateMatrixWorld(true);
    body.getWorldPosition(_bodyCenter);
    _bodyNdc.copy(_bodyCenter).project(camera);

    const onScreen = bodyInView(_bodyNdc);
    htmlRoot.style.display = onScreen ? "block" : "none";
    htmlRoot.style.pointerEvents = onScreen ? "auto" : "none";

    const leader = leaderRef.current;
    const button = buttonRef.current;
    if (leader && button) {
      leader.style.display =
        onScreen && labelTextIsCrammed(button) ? "block" : "none";
    }

    const perimeterRoot = perimeterRootRef.current;
    const perimeterLeader = perimeterLeaderRef.current;
    if (!perimeterRoot || !perimeterLeader) return;

    if (onScreen) {
      perimeterRoot.style.display = "none";
      perimeterRoot.style.pointerEvents = "none";
      return;
    }

    const [directionX, directionY] = offscreenDirection(
      _bodyNdc,
      camera,
      _bodyCenter,
    );
    const marker = perimeterMarker(
      directionX,
      directionY,
      size.width,
      size.height,
    );

    perimeterRoot.style.display = "inline-flex";
    perimeterRoot.style.pointerEvents = "auto";
    perimeterRoot.style.left = `${marker.x}px`;
    perimeterRoot.style.top = `${marker.y}px`;
    perimeterRoot.style.transform = marker.transform;
    perimeterRoot.style.flexDirection =
      marker.edge === "left" ? "row-reverse" : "row";
    perimeterLeader.style.transform = `rotate(${marker.lineAngle}deg)`;
  });

  return (
    <group ref={labelRef} position={layout.offset}>
      <Html
        center
        zIndexRange={[20, 0]}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div
          ref={htmlRootRef}
          className="relative inline-flex items-center"
        >
          <span
            ref={leaderRef}
            className={`absolute h-px shrink-0 ${
              highlighted ? "bg-[#b8cce0]/45" : "bg-[#8a9bb0]/25"
            }`}
            style={leaderStyle}
            aria-hidden
          />
          <button
            ref={buttonRef}
            type="button"
            data-body-label-text={navTargetId}
            onClick={(e) => {
              e.stopPropagation();
              navigateToTarget(navTargetId);
            }}
            className={labelButtonClassName}
            style={{ textShadow: "0 0 5px rgba(0,0,0,0.5)" }}
          >
            {name}
          </button>
        </div>
      </Html>
      <Html
        fullscreen
        zIndexRange={[20, 0]}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div
          ref={perimeterRootRef}
          className="absolute hidden items-center gap-1.5"
        >
          <span
            ref={perimeterLeaderRef}
            className={`block h-px shrink-0 ${
              highlighted ? "bg-[#b8cce0]/45" : "bg-[#8a9bb0]/25"
            }`}
            style={perimeterLeaderStyle}
            aria-hidden
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigateToTarget(navTargetId);
            }}
            className={labelButtonClassName}
            style={{ textShadow: "0 0 5px rgba(0,0,0,0.5)" }}
          >
            {name}
          </button>
        </div>
      </Html>
    </group>
  );
}
