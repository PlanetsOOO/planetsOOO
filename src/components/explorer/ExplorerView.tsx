"use client";

import { useEffect } from "react";
import { ExplorerProvider, useExplorer } from "@/context/ExplorerContext";
import { useMobileLandscape } from "@/hooks/useMobileLandscape";
import { useScreensaverMode } from "@/hooks/useScreensaverMode";
import SolarSystemCanvas from "@/components/explorer/SolarSystemCanvas";
import { MobileFlightControls } from "./MobileFlightControls";
import { OptionsMenu } from "./OptionsMenu";
import { PlanetPanel } from "./PlanetPanel";
import { SpeedHud } from "./SpeedHud";
import { FlightReticle } from "./FlightReticle";
import { ScenicChromeController } from "./ScenicChromeController";
import { ScreensaverBootstrap } from "./ScreensaverBootstrap";
import { ScreensaverBootOverlay } from "./ScreensaverBootOverlay";
import { ScreensaverBootGate } from "./ScreensaverErrorBoundary";
import { GuideLog } from "./GuideLog";
import { UtcClock } from "./UtcClock";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function GlobalShortcuts() {
  const { dismissInfo, setMenuOpen, exitAutopilot, showLabels, setShowLabels } =
    useExplorer();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === "l" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isEditableTarget(e.target)
      ) {
        e.preventDefault();
        setShowLabels(!showLabels);
        return;
      }

      if (e.key === "Tab") {
        const menuPanel = document.querySelector("[data-explorer-menu]");
        if (menuPanel?.contains(document.activeElement)) return;
        e.preventDefault();
        exitAutopilot();
        return;
      }

      if (e.key !== "Escape") return;
      dismissInfo();
      setMenuOpen(false);
      exitAutopilot();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismissInfo, setMenuOpen, exitAutopilot, showLabels, setShowLabels]);

  return null;
}

function NavigationHint() {
  const { navigationActive, discoveryAutopilotActive, scenicChromeVisible } =
    useExplorer();
  const mobileLandscape = useMobileLandscape();

  if (navigationActive) return null;
  if (discoveryAutopilotActive && !scenicChromeVisible) return null;

  if (mobileLandscape) {
    return (
      <p
        className="fixed bottom-4 left-1/2 z-30 max-w-[90vw] -translate-x-1/2 text-center text-[9px] tracking-widest uppercase text-zinc-600 pointer-events-none select-none"
        aria-live="polite"
      >
        Left: thrust · drag up to L¹ / L² · Right: steer · Menu to exit
      </p>
    );
  }

  return (
    <p
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 text-[10px] tracking-widest uppercase text-zinc-600 pointer-events-none select-none"
      aria-live="polite"
    >
      Click view to fly · Center dot selects · Tab exits flight · Space brake
    </p>
  );
}

function ExplorerShell() {
  const { navigationActive } = useExplorer();
  const mobileLandscape = useMobileLandscape();
  const screensaver = useScreensaverMode();

  return (
    <main
      className={`relative h-screen w-full overflow-hidden bg-[#030508] ${
        navigationActive && !mobileLandscape && !screensaver
          ? "cursor-none"
          : "cursor-default"
      }`}
    >
      <SolarSystemCanvas />
      {!screensaver && <MobileFlightControls />}
      {!screensaver && <FlightReticle />}
      {!screensaver && <UtcClock />}
      {!screensaver && <SpeedHud />}
      {!screensaver && <OptionsMenu />}
      {!screensaver && <PlanetPanel />}
      {!screensaver && <GuideLog />}
      {!screensaver && <NavigationHint />}
    </main>
  );
}

function ExplorerChrome() {
  const screensaver = useScreensaverMode();

  return (
    <>
      <ScreensaverBootstrap />
      {!screensaver && <GlobalShortcuts />}
      {!screensaver && <ScenicChromeController />}
      <ExplorerShell />
      <ScreensaverBootOverlay />
    </>
  );
}

export function ExplorerView() {
  return (
    <ScreensaverBootGate>
      <ExplorerProvider>
        <ExplorerChrome />
      </ExplorerProvider>
    </ScreensaverBootGate>
  );
}
