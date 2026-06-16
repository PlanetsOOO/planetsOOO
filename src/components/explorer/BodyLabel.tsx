"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { NavTargetId } from "@/data/navigationTargets";
import { useExplorer } from "@/context/ExplorerContext";
import { RENDER_FRAME_PRIORITY } from "@/lib/renderFramePriority";

const VIEW_MARGIN = 0.02;
const LABEL_OVERLAP_PADDING_PX = 3;
const LABEL_STAGGER_PX = 16;
const LABEL_STAGGER_STEPS = [0, -1, 1, -2, 2, -3, 3, -4, 4];
const LABEL_VIEWPORT_MARGIN_PX = 8;
const LABEL_LAYOUT_THROTTLE_MS = 120;

const _bodyCenter = new THREE.Vector3();
const _bodyNdc = new THREE.Vector3();

interface LabelRecord {
  id: string;
  element: HTMLDivElement;
  visible: boolean;
}

interface RectLike {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const labelRecords = new Map<string, LabelRecord>();
let labelLayoutQueued = false;
let lastLabelLayoutAt = 0;

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

function rectsOverlap(a: RectLike, b: RectLike): boolean {
  return (
    a.left < b.right + LABEL_OVERLAP_PADDING_PX &&
    a.right > b.left - LABEL_OVERLAP_PADDING_PX &&
    a.top < b.bottom + LABEL_OVERLAP_PADDING_PX &&
    a.bottom > b.top - LABEL_OVERLAP_PADDING_PX
  );
}

function shiftRect(rect: DOMRect, shiftY: number): RectLike {
  return {
    left: rect.left,
    right: rect.right,
    top: rect.top + shiftY,
    bottom: rect.bottom + shiftY,
  };
}

function overlapArea(a: RectLike, b: RectLike): number {
  const width = Math.max(
    0,
    Math.min(a.right, b.right + LABEL_OVERLAP_PADDING_PX) -
      Math.max(a.left, b.left - LABEL_OVERLAP_PADDING_PX),
  );
  const height = Math.max(
    0,
    Math.min(a.bottom, b.bottom + LABEL_OVERLAP_PADDING_PX) -
      Math.max(a.top, b.top - LABEL_OVERLAP_PADDING_PX),
  );
  return width * height;
}

function viewportPenalty(rect: RectLike): number {
  if (typeof window === "undefined") return 0;
  return (
    Math.max(0, LABEL_VIEWPORT_MARGIN_PX - rect.top) +
    Math.max(0, rect.bottom - (window.innerHeight - LABEL_VIEWPORT_MARGIN_PX)) +
    Math.max(0, LABEL_VIEWPORT_MARGIN_PX - rect.left) +
    Math.max(0, rect.right - (window.innerWidth - LABEL_VIEWPORT_MARGIN_PX))
  );
}

function layoutLabels(): void {
  labelLayoutQueued = false;
  lastLabelLayoutAt = performance.now();
  const visibleRecords = Array.from(labelRecords.values()).filter(
    (record) => record.visible && record.element.isConnected,
  );

  for (const record of visibleRecords) {
    record.element.style.transform = "";
  }

  const measured = visibleRecords
    .map((record) => ({
      record,
      rect: record.element.getBoundingClientRect(),
    }))
    .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);

  const placed: RectLike[] = [];
  for (const item of measured) {
    let bestShift = 0;
    let bestRect = shiftRect(item.rect, 0);
    let bestScore = Number.POSITIVE_INFINITY;

    for (const step of LABEL_STAGGER_STEPS) {
      const shiftY = step * LABEL_STAGGER_PX;
      const candidate = shiftRect(item.rect, shiftY);
      const overlapScore = placed.reduce(
        (total, rect) => total + overlapArea(candidate, rect),
        0,
      );
      const score =
        overlapScore * 1000 +
        viewportPenalty(candidate) * 100 +
        Math.abs(shiftY);

      if (score < bestScore) {
        bestScore = score;
        bestShift = shiftY;
        bestRect = candidate;
      }

      if (!placed.some((rect) => rectsOverlap(candidate, rect))) {
        break;
      }
    }

    placed.push(bestRect);
    if (bestShift !== 0) {
      item.record.element.style.transform = `translate3d(0, ${bestShift}px, 0)`;
    }
  }
}

function scheduleLabelLayout(): void {
  if (labelLayoutQueued || typeof window === "undefined") return;
  labelLayoutQueued = true;
  const waitMs = Math.max(
    0,
    LABEL_LAYOUT_THROTTLE_MS - (performance.now() - lastLabelLayoutAt),
  );
  window.setTimeout(() => {
    window.requestAnimationFrame(layoutLabels);
  }, waitMs);
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

  useEffect(() => {
    const element = htmlRootRef.current;
    if (!element) return;
    labelRecords.set(navTargetId, {
      id: navTargetId,
      element,
      visible: false,
    });
    scheduleLabelLayout();
    return () => {
      labelRecords.delete(navTargetId);
      scheduleLabelLayout();
    };
  }, [navTargetId]);

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
    const record = labelRecords.get(navTargetId);
    if (record) {
      record.visible = onScreen;
      scheduleLabelLayout();
    }
  }, RENDER_FRAME_PRIORITY.overlays);

  return (
    <group ref={labelRef} position={localOffset}>
      <Html
        center
        zIndexRange={[20, 0]}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <div
          ref={htmlRootRef}
          style={{ transition: "transform 120ms ease-out" }}
        >
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
