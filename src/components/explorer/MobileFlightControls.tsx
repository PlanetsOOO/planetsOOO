"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useExplorer } from "@/context/ExplorerContext";
import { useMobileLandscape } from "@/hooks/useMobileLandscape";
import { markIdleOrbitUserActivity } from "@/lib/idleOrbitState";
import {
  mobileTouchState,
  resetMobileTouchState,
  tapMobileSpeedTier,
  type MobileSpeedTier,
} from "@/lib/mobileTouchState";

const THUMB_MAX = 58;
const BRAKE_PULL = 0.72;
const THRUST_DEAD = 0.18;

const L1_OFFSET_Y = 148;
const L1_OFFSET_X = -112;
const L2_OFFSET_Y = 168;
const RING_RADIUS = 30;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

function tierFromThumb(
  thumbX: number,
  thumbY: number,
  baseX: number,
  baseY: number,
  current: MobileSpeedTier,
): MobileSpeedTier {
  if (dist(thumbX, thumbY, baseX, baseY - L2_OFFSET_Y) <= RING_RADIUS + 8) return 2;
  if (
    dist(thumbX, thumbY, baseX + L1_OFFSET_X, baseY - L1_OFFSET_Y) <=
    RING_RADIUS + 8
  ) {
    return 1;
  }
  return current;
}

export function MobileFlightControls() {
  const mobileLandscape = useMobileLandscape();
  const {
    navigationActive,
    autoNavigating,
    discoveryAutopilotActive,
    setNavigationActive,
    markFlightReticleActivity,
  } = useExplorer();

  const clusterRef = useRef<HTMLDivElement>(null);
  const joyPointerId = useRef<number | null>(null);
  const lookPointerId = useRef<number | null>(null);
  const joyBase = useRef({ x: 0, y: 0 });
  const [thumb, setThumb] = useState({ x: 0, y: 0, active: false });
  const [speedTier, setSpeedTier] = useState<MobileSpeedTier>(0);

  useEffect(() => {
    mobileTouchState.enabled = mobileLandscape;
    if (!mobileLandscape) resetMobileTouchState();
  }, [mobileLandscape]);

  useEffect(() => {
    if (!navigationActive && mobileLandscape) {
      resetMobileTouchState();
    }
  }, [navigationActive, mobileLandscape]);

  const displayTier: MobileSpeedTier = navigationActive ? speedTier : 0;

  const syncThrust = useCallback((dx: number, dy: number) => {
    const nx = clamp(dx / THUMB_MAX, -1, 1);
    const ny = clamp(-dy / THUMB_MAX, -1, 1);
    mobileTouchState.thrustX = Math.abs(nx) > THRUST_DEAD ? nx : 0;
    mobileTouchState.thrustY = Math.abs(ny) > THRUST_DEAD ? ny : 0;
    mobileTouchState.braking = ny < -BRAKE_PULL;
  }, []);

  const beginFlight = useCallback(() => {
    if (autoNavigating && !discoveryAutopilotActive) return;
    markIdleOrbitUserActivity();
    if (!mobileTouchState.flightActive) {
      mobileTouchState.flightActive = true;
      setNavigationActive(true);
    }
  }, [autoNavigating, discoveryAutopilotActive, setNavigationActive]);

  const readJoyBase = () => {
    const el = clusterRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    joyBase.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  };

  const onJoyPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    e.preventDefault();
    e.stopPropagation();
    beginFlight();
    readJoyBase();
    joyPointerId.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setThumb({ x: 0, y: 0, active: true });
    syncThrust(0, 0);
  };

  const onJoyPointerMove = (e: React.PointerEvent) => {
    if (e.pointerId !== joyPointerId.current) return;
    e.preventDefault();
    const dx = clamp(e.clientX - joyBase.current.x, -THUMB_MAX, THUMB_MAX);
    const dy = clamp(e.clientY - joyBase.current.y, -THUMB_MAX, THUMB_MAX);
    setThumb({ x: dx, y: dy, active: true });
    syncThrust(dx, dy);
    setSpeedTier((prev) => {
      const next = tierFromThumb(
        e.clientX,
        e.clientY,
        joyBase.current.x,
        joyBase.current.y,
        prev,
      );
      mobileTouchState.speedTier = next;
      return next;
    });
  };

  const onJoyPointerUp = (e: React.PointerEvent) => {
    if (e.pointerId !== joyPointerId.current) return;
    joyPointerId.current = null;
    setThumb({ x: 0, y: 0, active: false });
    mobileTouchState.thrustX = 0;
    mobileTouchState.thrustY = 0;
    mobileTouchState.braking = false;
  };

  const onLookPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    e.preventDefault();
    beginFlight();
    lookPointerId.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onLookPointerMove = (e: React.PointerEvent) => {
    if (e.pointerId !== lookPointerId.current) return;
    e.preventDefault();
    if (e.movementX !== 0 || e.movementY !== 0) {
      mobileTouchState.lookDx += e.movementX;
      mobileTouchState.lookDy += e.movementY;
      markFlightReticleActivity();
    }
  };

  const onLookPointerUp = (e: React.PointerEvent) => {
    if (e.pointerId !== lookPointerId.current) return;
    lookPointerId.current = null;
  };

  const onRingTap = (tier: 1 | 2) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    beginFlight();
    tapMobileSpeedTier(tier);
    setSpeedTier(mobileTouchState.speedTier);
  };

  if (!mobileLandscape) return null;
  if (autoNavigating && !discoveryAutopilotActive) return null;

  const showRings = thumb.active || displayTier > 0;

  return (
    <div className="fixed inset-0 z-[45] pointer-events-none touch-none select-none md:hidden" aria-hidden>
      <div
        className="pointer-events-auto absolute bottom-0 right-0 top-14 w-[52%]"
        onPointerDown={onLookPointerDown}
        onPointerMove={onLookPointerMove}
        onPointerUp={onLookPointerUp}
        onPointerCancel={onLookPointerUp}
      />

      <div className="pointer-events-none absolute bottom-[12%] left-[14%]">
        <div ref={clusterRef} className="relative h-14 w-14">
          {showRings && (
            <>
              <SpeedRing
                label="L²"
              latched={displayTier === 2}
              highlighted={displayTier >= 2}
                offsetY={-L2_OFFSET_Y}
                onTap={onRingTap(2)}
              />
              <SpeedRing
                label="L¹"
                latched={displayTier === 1}
                highlighted={displayTier >= 1}
                offsetX={L1_OFFSET_X}
                offsetY={-L1_OFFSET_Y}
                onTap={onRingTap(1)}
              />
            </>
          )}

          <div
            className="pointer-events-auto absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2"
            onPointerDown={onJoyPointerDown}
            onPointerMove={onJoyPointerMove}
            onPointerUp={onJoyPointerUp}
            onPointerCancel={onJoyPointerUp}
          >
            <div
              className={`absolute left-1/2 top-1/2 h-[104px] w-[104px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-500/20 bg-zinc-950/25 ${
                displayTier > 0 ? "border-sky-400/25" : ""
              }`}
            />
            <div
              className={`absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-300/35 bg-zinc-800/45 shadow-lg backdrop-blur-sm ${
                thumb.active ? "border-zinc-100/50 bg-zinc-700/55" : ""
              } ${displayTier === 2 ? "border-fuchsia-300/50 shadow-fuchsia-500/20" : displayTier === 1 ? "border-sky-300/45 shadow-sky-500/15" : ""}`}
              style={{
                transform: `translate(calc(-50% + ${thumb.x}px), calc(-50% + ${thumb.y}px))`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function SpeedRing({
  label,
  latched,
  highlighted,
  offsetX = 0,
  offsetY,
  onTap,
}: {
  label: string;
  latched: boolean;
  highlighted: boolean;
  offsetX?: number;
  offsetY: number;
  onTap: (e: React.PointerEvent) => void;
}) {
  const ludicrous = label === "L²";
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={onTap}
      className={`pointer-events-auto absolute flex h-[60px] w-[60px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[11px] font-medium tracking-widest backdrop-blur-sm transition-opacity ${
        latched
          ? ludicrous
            ? "border-fuchsia-300/45 bg-fuchsia-950/35 text-fuchsia-100/90 opacity-90"
            : "border-sky-300/40 bg-sky-950/30 text-sky-100/90 opacity-90"
          : highlighted
            ? "border-zinc-400/30 bg-zinc-900/30 text-zinc-300/70 opacity-55"
            : "border-zinc-500/20 bg-zinc-950/20 text-zinc-500/60 opacity-35"
      }`}
      style={{ left: `calc(50% + ${offsetX}px)`, top: offsetY }}
    >
      {label}
    </button>
  );
}
