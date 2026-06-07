"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { NavTargetId } from "@/data/navigationTargets";
import { useExplorer } from "@/context/ExplorerContext";

const PERIMETER_MARGIN_PX = 24;
const PERIMETER_LABEL_INSET_PX = 18;
const LABEL_GAP_PX = 8;
const ONSCREEN_LABEL_GAP_PX = 26;
const MIN_CONNECTOR_PX = 10;
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

type PerimeterEdge = "left" | "right" | "top" | "bottom";

interface ScreenTarget {
  x: number;
  y: number;
  onScreen: boolean;
  edge: PerimeterEdge | null;
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface LabelRecord {
  id: string;
  navTargetId: NavTargetId;
  name: string;
  highlighted: boolean;
  root: HTMLDivElement | null;
  button: HTMLButtonElement | null;
  svg: SVGSVGElement | null;
  line: SVGLineElement | null;
  target: ScreenTarget | null;
  width: number;
  height: number;
  x: number;
  y: number;
}

interface EdgePoint {
  edge: PerimeterEdge;
  x: number;
  y: number;
}

const labelRecords = new Map<string, LabelRecord>();

function hashUnit(id: string): [number, number] {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (Math.imul(37, hash) + id.charCodeAt(i)) | 0;
  }
  const angle = ((Math.abs(hash) % 360) / 180) * Math.PI;
  return [Math.cos(angle), Math.sin(angle)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rectOverlapArea(a: Rect, b: Rect): number {
  const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return x * y;
}

function rectFromLabel(record: LabelRecord, x = record.x, y = record.y): Rect {
  return {
    left: x,
    top: y,
    right: x + record.width,
    bottom: y + record.height,
  };
}

function closestPointOnRect(x: number, y: number, rect: Rect): [number, number] {
  return [
    clamp(x, rect.left, rect.right),
    clamp(y, rect.top, rect.bottom),
  ];
}

function perimeterPoint(
  directionX: number,
  directionY: number,
  width: number,
  height: number,
): EdgePoint {
  const dx = directionX;
  let dy = directionY;
  if (Math.abs(dx) < DIRECTION_EPSILON && Math.abs(dy) < DIRECTION_EPSILON) {
    dy = 1;
  }

  const centerX = width / 2;
  const centerY = height / 2;
  const maxX = Math.max(1, centerX - PERIMETER_MARGIN_PX);
  const maxY = Math.max(1, centerY - PERIMETER_MARGIN_PX);
  const scaleX =
    Math.abs(dx) < DIRECTION_EPSILON ? Number.POSITIVE_INFINITY : maxX / Math.abs(dx);
  const scaleY =
    Math.abs(dy) < DIRECTION_EPSILON ? Number.POSITIVE_INFINITY : maxY / Math.abs(dy);
  const hitsVerticalEdge = scaleX <= scaleY;
  const scale = hitsVerticalEdge ? scaleX : scaleY;
  const x = clamp(centerX + dx * scale, PERIMETER_MARGIN_PX, width - PERIMETER_MARGIN_PX);
  const y = clamp(centerY + dy * scale, PERIMETER_MARGIN_PX, height - PERIMETER_MARGIN_PX);
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
  };
}

function projectBodyToScreen(
  id: string,
  body: THREE.Object3D,
  camera: THREE.Camera,
  width: number,
  height: number,
): ScreenTarget {
  camera.updateMatrixWorld(true);
  body.getWorldPosition(_bodyCenter);
  _bodyNdc.copy(_bodyCenter).project(camera);
  _cameraLocal.copy(_bodyCenter);
  camera.worldToLocal(_cameraLocal);

  const inFront = _cameraLocal.z < 0;
  const finite =
    Number.isFinite(_bodyNdc.x) &&
    Number.isFinite(_bodyNdc.y) &&
    Number.isFinite(_bodyNdc.z);
  const x = ((_bodyNdc.x + 1) / 2) * width;
  const y = ((1 - _bodyNdc.y) / 2) * height;
  const onScreen =
    finite &&
    inFront &&
    _bodyNdc.z >= -1 &&
    _bodyNdc.z <= 1 &&
    x >= PERIMETER_MARGIN_PX &&
    x <= width - PERIMETER_MARGIN_PX &&
    y >= PERIMETER_MARGIN_PX &&
    y <= height - PERIMETER_MARGIN_PX;

  if (onScreen) {
    return {
      x,
      y,
      onScreen: true,
      edge: null,
    };
  }

  let directionX = inFront && finite ? _bodyNdc.x : _cameraLocal.x;
  let directionY = inFront && finite ? -_bodyNdc.y : -_cameraLocal.y;
  if (
    Math.abs(directionX) < DIRECTION_EPSILON &&
    Math.abs(directionY) < DIRECTION_EPSILON
  ) {
    [directionX, directionY] = hashUnit(id);
  }

  const edgePoint = perimeterPoint(directionX, directionY, width, height);
  return {
    x: edgePoint.x,
    y: edgePoint.y,
    onScreen: false,
    edge: edgePoint.edge,
  };
}

function setLabelPosition(record: LabelRecord, x: number, y: number): void {
  record.x = x;
  record.y = y;

  if (!record.root) return;
  record.root.style.opacity = "1";
  record.root.style.pointerEvents = "auto";
  record.root.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
}

function hideRecord(record: LabelRecord): void {
  if (record.root) {
    record.root.style.opacity = "0";
    record.root.style.pointerEvents = "none";
  }
  if (record.line) {
    record.line.style.display = "none";
  }
}

function measureRecord(record: LabelRecord): void {
  const rect = record.button?.getBoundingClientRect();
  record.width = Math.max(42, rect?.width || record.name.length * 7);
  record.height = Math.max(14, rect?.height || 14);
}

function spreadEdgeRecords(
  records: LabelRecord[],
  edge: PerimeterEdge,
  width: number,
  height: number,
): Rect[] {
  const horizontal = edge === "top" || edge === "bottom";
  const min = PERIMETER_MARGIN_PX;
  const max =
    (horizontal ? width : height) - PERIMETER_MARGIN_PX;
  const ordered = [...records].sort((a, b) => {
    const aTarget = a.target;
    const bTarget = b.target;
    if (!aTarget || !bTarget) return 0;
    return horizontal ? aTarget.x - bTarget.x : aTarget.y - bTarget.y;
  });
  const centers = new Map<LabelRecord, number>();
  let cursor = min;

  for (const record of ordered) {
    const target = record.target;
    if (!target) continue;

    const size = horizontal ? record.width : record.height;
    const desired = horizontal ? target.x : target.y;
    const center = clamp(desired, cursor + size / 2, max - size / 2);
    centers.set(record, center);
    cursor = center + size / 2 + LABEL_GAP_PX;
  }

  const last = ordered[ordered.length - 1];
  if (last) {
    const lastCenter = centers.get(last) ?? min;
    const lastSize = horizontal ? last.width : last.height;
    const overflow = lastCenter + lastSize / 2 - max;
    if (overflow > 0) {
      for (const record of ordered) {
        centers.set(record, (centers.get(record) ?? min) - overflow);
      }
    }
  }

  const rects: Rect[] = [];
  for (const record of ordered) {
    const center = centers.get(record);
    if (center == null || !record.target) continue;

    let x = record.target.x - record.width / 2;
    let y = record.target.y - record.height / 2;
    if (edge === "left") {
      x = PERIMETER_MARGIN_PX + PERIMETER_LABEL_INSET_PX;
      y = center - record.height / 2;
    } else if (edge === "right") {
      x = width - PERIMETER_MARGIN_PX - PERIMETER_LABEL_INSET_PX - record.width;
      y = center - record.height / 2;
    } else if (edge === "top") {
      x = center - record.width / 2;
      y = PERIMETER_MARGIN_PX + PERIMETER_LABEL_INSET_PX;
    } else {
      x = center - record.width / 2;
      y = height - PERIMETER_MARGIN_PX - PERIMETER_LABEL_INSET_PX - record.height;
    }

    x = clamp(x, PERIMETER_MARGIN_PX, width - PERIMETER_MARGIN_PX - record.width);
    y = clamp(y, PERIMETER_MARGIN_PX, height - PERIMETER_MARGIN_PX - record.height);
    setLabelPosition(record, x, y);
    rects.push(rectFromLabel(record));
  }

  return rects;
}

function candidateRects(record: LabelRecord, width: number, height: number): Rect[] {
  const target = record.target;
  if (!target) return [];

  const [fallbackX, fallbackY] = hashUnit(record.id);
  const fromCenterX = target.x - width / 2;
  const fromCenterY = target.y - height / 2;
  const xSign =
    Math.abs(fromCenterX) > DIRECTION_EPSILON
      ? Math.sign(fromCenterX)
      : Math.sign(fallbackX) || 1;
  const ySign =
    Math.abs(fromCenterY) > DIRECTION_EPSILON
      ? Math.sign(fromCenterY)
      : Math.sign(fallbackY) || 1;
  const candidates = [
    [xSign, ySign],
    [xSign, -ySign],
    [-xSign, ySign],
    [-xSign, -ySign],
  ];

  return candidates.map(([sx, sy]) => {
    const x =
      sx > 0
        ? target.x + ONSCREEN_LABEL_GAP_PX
        : target.x - ONSCREEN_LABEL_GAP_PX - record.width;
    const y =
      sy > 0
        ? target.y + ONSCREEN_LABEL_GAP_PX * 0.55
        : target.y - ONSCREEN_LABEL_GAP_PX * 0.55 - record.height;

    return {
      left: clamp(x, PERIMETER_MARGIN_PX, width - PERIMETER_MARGIN_PX - record.width),
      top: clamp(y, PERIMETER_MARGIN_PX, height - PERIMETER_MARGIN_PX - record.height),
      right: clamp(x, PERIMETER_MARGIN_PX, width - PERIMETER_MARGIN_PX - record.width) + record.width,
      bottom: clamp(y, PERIMETER_MARGIN_PX, height - PERIMETER_MARGIN_PX - record.height) + record.height,
    };
  });
}

function placeOnscreenRecords(
  records: LabelRecord[],
  placed: Rect[],
  width: number,
  height: number,
): void {
  const ordered = [...records].sort((a, b) => {
    if (a.highlighted !== b.highlighted) return a.highlighted ? -1 : 1;
    return (a.target?.y ?? 0) - (b.target?.y ?? 0);
  });

  for (const record of ordered) {
    const candidates = candidateRects(record, width, height);
    let best = candidates[0];
    let bestScore = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
      const overlap = placed.reduce(
        (sum, rect) => sum + rectOverlapArea(candidate, rect),
        0,
      );
      const target = record.target;
      const centerX = (candidate.left + candidate.right) / 2;
      const centerY = (candidate.top + candidate.bottom) / 2;
      const distance = target
        ? Math.hypot(centerX - target.x, centerY - target.y)
        : 0;
      const score = overlap * 100 + distance;

      if (score < bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    if (!best) continue;
    setLabelPosition(record, best.left, best.top);
    placed.push(best);
  }
}

function updateConnector(record: LabelRecord): void {
  const line = record.line;
  const target = record.target;
  if (!line || !target) return;

  const rect = rectFromLabel(record);
  const [labelX, labelY] = closestPointOnRect(target.x, target.y, rect);
  const length = Math.hypot(labelX - target.x, labelY - target.y);
  if (length < MIN_CONNECTOR_PX) {
    line.style.display = "none";
    return;
  }

  line.style.display = "block";
  line.setAttribute("x1", target.x.toFixed(1));
  line.setAttribute("y1", target.y.toFixed(1));
  line.setAttribute("x2", labelX.toFixed(1));
  line.setAttribute("y2", labelY.toFixed(1));
  line.setAttribute(
    "stroke",
    record.highlighted ? "rgba(184, 204, 224, 0.52)" : "rgba(138, 155, 176, 0.28)",
  );
}

function layoutLabels(width: number, height: number): void {
  const active = Array.from(labelRecords.values()).filter(
    (record) => record.root && record.button && record.svg && record.line && record.target,
  );
  if (active.length === 0) return;

  for (const record of labelRecords.values()) {
    if (!active.includes(record)) hideRecord(record);
  }

  for (const record of active) measureRecord(record);

  const byEdge: Record<PerimeterEdge, LabelRecord[]> = {
    left: [],
    right: [],
    top: [],
    bottom: [],
  };
  const onscreen: LabelRecord[] = [];

  for (const record of active) {
    const target = record.target;
    if (!target) continue;
    if (target.onScreen || !target.edge) onscreen.push(record);
    else byEdge[target.edge].push(record);
  }

  const placed: Rect[] = [];
  for (const edge of Object.keys(byEdge) as PerimeterEdge[]) {
    placed.push(...spreadEdgeRecords(byEdge[edge], edge, width, height));
  }
  placeOnscreenRecords(onscreen, placed, width, height);

  for (const record of active) updateConnector(record);
}

export function BodyLabel({
  id,
  navTargetId,
  name,
  bodyCenterRef,
  highlighted = false,
}: BodyLabelProps) {
  const recordRef = useRef<LabelRecord | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const lineRef = useRef<SVGLineElement>(null);
  const { navigateToTarget } = useExplorer();

  if (recordRef.current === null) {
    recordRef.current = {
      id,
      navTargetId,
      name,
      highlighted,
      root: null,
      button: null,
      svg: null,
      line: null,
      target: null,
      width: 42,
      height: 14,
      x: 0,
      y: 0,
    };
  }

  const record = recordRef.current;
  const labelButtonClassName = `font-mono text-[9px] tracking-[0.2em] uppercase whitespace-nowrap border-0 bg-transparent p-0 cursor-pointer ${
    highlighted ? "text-[#b8cce0] opacity-65" : "text-[#8a9bb0] opacity-32"
  }`;

  useEffect(() => {
    labelRecords.set(id, record);
    return () => {
      labelRecords.delete(id);
    };
  }, [id, record]);

  useFrame(({ camera, size }) => {
    const body = bodyCenterRef.current;
    record.id = id;
    record.navTargetId = navTargetId;
    record.name = name;
    record.highlighted = highlighted;
    record.root = rootRef.current;
    record.button = buttonRef.current;
    record.svg = svgRef.current;
    record.line = lineRef.current;

    if (!body) {
      record.target = null;
      hideRecord(record);
      return;
    }

    record.target = projectBodyToScreen(
      id,
      body,
      camera,
      size.width,
      size.height,
    );
    layoutLabels(size.width, size.height);
  });

  return (
    <group>
      <Html
        fullscreen
        zIndexRange={[30, 0]}
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        <svg
          ref={svgRef}
          className="absolute inset-0 h-full w-full overflow-visible"
          aria-hidden
        >
          <line
            ref={lineRef}
            strokeWidth="1"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            style={{ display: "none" }}
          />
        </svg>
        <div
          ref={rootRef}
          className="absolute left-0 top-0 will-change-transform"
          style={{ opacity: 0, pointerEvents: "none" }}
        >
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
    </group>
  );
}
