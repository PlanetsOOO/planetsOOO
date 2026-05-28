"use client";

import { useEffect } from "react";
import { ExplorerProvider, useExplorer } from "@/context/ExplorerContext";
import { useMobileLandscape } from "@/hooks/useMobileLandscape";
import SolarSystemCanvas from "@/components/explorer/SolarSystemCanvas";
import { EarthLandCinematic } from "./EarthLandCinematic";
import { MobileFlightControls } from "./MobileFlightControls";
import { OptionsMenu } from "./OptionsMenu";
import { PlanetPanel } from "./PlanetPanel";
import { SpeedHud } from "./SpeedHud";
import { FlightReticle } from "./FlightReticle";
import { ScenicChromeController } from "./ScenicChromeController";
import { UtcClock } from "./UtcClock";

function GlobalShortcuts() {
  const { dismissInfo, setMenuOpen, exitAutopilot } = useExplorer();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
  }, [dismissInfo, setMenuOpen, exitAutopilot]);

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

  return (
    <main
      className={`relative h-screen w-full overflow-hidden bg-[#030508] ${
        navigationActive && !mobileLandscape ? "cursor-none" : "cursor-default"
      }`}
    >
      <SolarSystemCanvas />
      <MobileFlightControls />
      <EarthLandCinematic />
      <FlightReticle />
      <UtcClock />
      <SpeedHud />
      <OptionsMenu />
      <PlanetPanel />
      <NavigationHint />
    </main>
  );
}

export function ExplorerView() {
  return (
    <ExplorerProvider>
      <GlobalShortcuts />
      <ScenicChromeController />
      <ExplorerShell />
    </ExplorerProvider>
  );
}
