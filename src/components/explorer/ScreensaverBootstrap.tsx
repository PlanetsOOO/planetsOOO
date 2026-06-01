"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { NavTargetId } from "@/data/navigationTargets";
import { useExplorer } from "@/context/ExplorerContext";
import { discoveryAutopilotState } from "@/lib/discoveryAutopilot";
import { idleOrbitState } from "@/lib/idleOrbitState";
import { readScreensaverConfig } from "@/lib/screensaverConfig";
import { activateScreensaverPresentation } from "@/lib/screensaverPresentation";
import { activateScreensaverScenicTour } from "@/lib/screensaverScenic";
import { useScreensaverMode } from "@/hooks/useScreensaverMode";

const FLIGHT_IDLE_RETURN_MS = 15_000;
const FLIGHT_IDLE_MOUSE_EPSILON = 2;

function requestCanvasPointerLock(): void {
  const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;
  canvas?.focus?.({ preventScroll: true });
  canvas?.requestPointerLock?.();
}

/** Auto-start scenic tour, maximize view, secret flight key, discreet exit. */
export function ScreensaverBootstrap() {
  const screensaver = useScreensaverMode();
  const config = readScreensaverConfig();
  const {
    setDiscoveryAutopilotActive,
    setMenuOpen,
    dismissInfo,
    setNavigationActive,
    discoveryAutopilotActive,
    returnToDiscoveryScenic,
    showLabels,
    setShowLabels,
  } = useExplorer();
  const flightEnteredRef = useRef(false);
  const flightActiveRef = useRef(false);
  const returnTargetRef = useRef<NavTargetId | null>(null);
  const showLabelsRef = useRef(showLabels);
  const flightIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    showLabelsRef.current = showLabels;
  }, [showLabels]);

  const startScenicTour = useCallback((force = false) => {
    if (flightEnteredRef.current && !force) return;
    idleOrbitState.active = false;
    dismissInfo();
    setMenuOpen(false);
    if (activateScreensaverScenicTour()) {
      setDiscoveryAutopilotActive(true);
    }
    if (!force) {
      flightEnteredRef.current = false;
    }
  }, [dismissInfo, setMenuOpen, setDiscoveryAutopilotActive]);

  useLayoutEffect(() => {
    if (!screensaver) return;
    startScenicTour();
  }, [screensaver, startScenicTour]);

  useEffect(() => {
    if (!screensaver) return;

    const retry = window.setInterval(() => {
      if (flightEnteredRef.current) return;
      if (discoveryAutopilotState.active && discoveryAutopilotActive) return;
      startScenicTour();
    }, 800);

    return () => window.clearInterval(retry);
  }, [screensaver, discoveryAutopilotActive, startScenicTour]);

  useEffect(() => {
    if (!screensaver) return;
    return activateScreensaverPresentation();
  }, [screensaver]);

  useEffect(() => {
    if (!screensaver) return;

    const clearFlightIdleTimer = () => {
      if (flightIdleTimerRef.current) {
        window.clearTimeout(flightIdleTimerRef.current);
        flightIdleTimerRef.current = null;
      }
    };

    const returnToScenicTour = () => {
      flightActiveRef.current = false;
      clearFlightIdleTimer();
      setNavigationActive(false);
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }

      const returnTarget = returnTargetRef.current;
      returnToDiscoveryScenic(returnTarget);
    };

    const markFlightActivity = () => {
      if (!flightActiveRef.current) return;
      clearFlightIdleTimer();
      flightIdleTimerRef.current = window.setTimeout(
        returnToScenicTour,
        FLIGHT_IDLE_RETURN_MS,
      );
    };

    const toggleLabels = () => {
      const next = !showLabelsRef.current;
      showLabelsRef.current = next;
      setShowLabels(next);
    };

    const enterFlight = () => {
      if (flightActiveRef.current) return;
      returnTargetRef.current = discoveryAutopilotState.currentTargetId;
      flightEnteredRef.current = true;
      flightActiveRef.current = true;
      idleOrbitState.active = false;
      setDiscoveryAutopilotActive(false);
      setNavigationActive(true);
      requestCanvasPointerLock();
      markFlightActivity();
    };

    const exitScreensaver = () => {
      clearFlightIdleTimer();
      if (document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => {});
      }
      window.close();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const modified = e.metaKey || e.ctrlKey || e.altKey;

      if (!flightEnteredRef.current) {
        if (e.key.toLowerCase() === "l" && !modified) {
          e.preventDefault();
          e.stopImmediatePropagation();
          toggleLabels();
          return;
        }

        if (e.code === config.enterFlightKey && !modified) {
          if (e.repeat) return;
          e.preventDefault();
          e.stopImmediatePropagation();
          enterFlight();
          return;
        }

        e.preventDefault();
        e.stopImmediatePropagation();
        exitScreensaver();
        return;
      }

      if (e.code === config.exitKey && !modified) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.repeat) return;
        exitScreensaver();
        return;
      }

      if (e.code === config.enterFlightKey && !modified) {
        if (e.repeat) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        enterFlight();
        return;
      }

      if (e.key.toLowerCase() === "l" && !modified) {
        e.preventDefault();
        e.stopImmediatePropagation();
        toggleLabels();
        markFlightActivity();
        return;
      }

      markFlightActivity();
    };

    const onPointerExit = (e: MouseEvent | PointerEvent) => {
      if (flightEnteredRef.current) {
        markFlightActivity();
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
      exitScreensaver();
    };

    const onFlightActivity = () => {
      markFlightActivity();
    };

    const onFlightMouseMove = (e: MouseEvent) => {
      const movement =
        Math.abs(e.movementX ?? 0) + Math.abs(e.movementY ?? 0);
      if (movement < FLIGHT_IDLE_MOUSE_EPSILON) return;
      markFlightActivity();
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onFlightActivity, true);
    window.addEventListener("pointerdown", onPointerExit, true);
    window.addEventListener("mousedown", onPointerExit, true);
    window.addEventListener("click", onPointerExit, true);
    window.addEventListener("contextmenu", onPointerExit, true);
    window.addEventListener("mousemove", onFlightMouseMove, true);
    window.addEventListener("wheel", onFlightActivity, true);

    return () => {
      clearFlightIdleTimer();
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onFlightActivity, true);
      window.removeEventListener("pointerdown", onPointerExit, true);
      window.removeEventListener("mousedown", onPointerExit, true);
      window.removeEventListener("click", onPointerExit, true);
      window.removeEventListener("contextmenu", onPointerExit, true);
      window.removeEventListener("mousemove", onFlightMouseMove, true);
      window.removeEventListener("wheel", onFlightActivity, true);
    };
  }, [
    screensaver,
    config.enterFlightKey,
    config.exitKey,
    setDiscoveryAutopilotActive,
    setNavigationActive,
    setShowLabels,
    returnToDiscoveryScenic,
    startScenicTour,
  ]);

  return null;
}
