"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useExplorer } from "@/context/ExplorerContext";
import { discoveryAutopilotState } from "@/lib/discoveryAutopilot";
import { idleOrbitState } from "@/lib/idleOrbitState";
import { readScreensaverConfig } from "@/lib/screensaverConfig";
import { activateScreensaverPresentation } from "@/lib/screensaverPresentation";
import { activateScreensaverScenicTour } from "@/lib/screensaverScenic";
import { useScreensaverMode } from "@/hooks/useScreensaverMode";

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
  } = useExplorer();
  const flightEnteredRef = useRef(false);

  const startScenicTour = useCallback(() => {
    if (flightEnteredRef.current) return;
    idleOrbitState.active = false;
    dismissInfo();
    setMenuOpen(false);
    if (activateScreensaverScenicTour()) {
      setDiscoveryAutopilotActive(true);
    }
    flightEnteredRef.current = false;
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

    const enterFlight = () => {
      if (flightEnteredRef.current) return;
      flightEnteredRef.current = true;
      idleOrbitState.active = false;
      setDiscoveryAutopilotActive(false);
      setNavigationActive(true);
      requestCanvasPointerLock();
    };

    const exitScreensaver = () => {
      if (document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => {});
      }
      window.close();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const modified = e.metaKey || e.ctrlKey || e.altKey;

      if (!flightEnteredRef.current) {
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
      }
    };

    const onPointerExit = (e: MouseEvent | PointerEvent) => {
      if (flightEnteredRef.current) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      exitScreensaver();
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerExit, true);
    window.addEventListener("mousedown", onPointerExit, true);
    window.addEventListener("click", onPointerExit, true);
    window.addEventListener("contextmenu", onPointerExit, true);

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerExit, true);
      window.removeEventListener("mousedown", onPointerExit, true);
      window.removeEventListener("click", onPointerExit, true);
      window.removeEventListener("contextmenu", onPointerExit, true);
    };
  }, [
    screensaver,
    config.enterFlightKey,
    config.exitKey,
    setDiscoveryAutopilotActive,
    setNavigationActive,
  ]);

  return null;
}
