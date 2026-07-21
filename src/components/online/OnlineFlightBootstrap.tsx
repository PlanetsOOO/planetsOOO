"use client";

import { useEffect, useRef } from "react";
import { useExplorer } from "@/context/ExplorerContext";
import { useOnline } from "@/context/OnlineContext";
import { isOnlineMode } from "@/lib/screensaverConfig";

/**
 * After faction pick: disable scenic autopilot and prepare spacecraft flight.
 * Pointer lock still requires a click (browser gesture) — HUD prompts the pilot.
 */
export function OnlineFlightBootstrap() {
  const { enabled, access } = useOnline();
  const {
    setDiscoveryAutopilotActive,
    setNavigationActive,
    setShowOrbits,
    setShowLabels,
    dismissInfo,
    setMenuOpen,
  } = useExplorer();
  const bootedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !isOnlineMode()) return;
    if (!access?.online || access.needsFaction) {
      bootedRef.current = false;
      return;
    }
    if (bootedRef.current) return;
    bootedRef.current = true;

    setDiscoveryAutopilotActive(false);
    setShowOrbits(false);
    setShowLabels(true);
    dismissInfo();
    setMenuOpen(false);
    // Ready for click-to-lock; do not force pointer lock without a gesture.
    setNavigationActive(false);
  }, [
    access?.needsFaction,
    access?.online,
    dismissInfo,
    enabled,
    setDiscoveryAutopilotActive,
    setMenuOpen,
    setNavigationActive,
    setShowLabels,
    setShowOrbits,
  ]);

  return null;
}
