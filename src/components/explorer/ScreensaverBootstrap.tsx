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
  const canvas = document.querySelector("canvas");
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
      setDiscoveryAutopilotActive(false);
      setNavigationActive(true);
      requestCanvasPointerLock();
    };

    const exitScreensaver = () => {
      window.close();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== config.enterFlightKey) return;
      if (e.repeat) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      enterFlight();
    };

    const onContextMenu = (e: MouseEvent) => {
      if (config.exitGesture !== "contextmenu") return;
      e.preventDefault();
      exitScreensaver();
    };

    const onMouseDown = (e: MouseEvent) => {
      if (config.exitGesture !== "middleclick") return;
      if (e.button !== 1) return;
      e.preventDefault();
      exitScreensaver();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("mousedown", onMouseDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, [
    screensaver,
    config.enterFlightKey,
    config.exitGesture,
    setDiscoveryAutopilotActive,
    setNavigationActive,
  ]);

  return null;
}
