"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { ExplorerProvider, useExplorer } from "@/context/ExplorerContext";
import { EarthLandCinematic } from "./EarthLandCinematic";
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
  if (navigationActive) return null;
  if (discoveryAutopilotActive && !scenicChromeVisible) return null;

  return (
    <p
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 text-[10px] tracking-widest uppercase text-zinc-600 pointer-events-none select-none"
      aria-live="polite"
    >
      Click view to fly · Center dot selects · Tab exits flight · Space brake
    </p>
  );
}

const SolarSystemCanvas = dynamic(
  () => import("@/components/explorer/SolarSystemCanvas"),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-[#030508]">
        <p className="text-xs tracking-[0.3em] uppercase text-zinc-600 animate-pulse">
          Initializing…
        </p>
      </div>
    ),
  },
);

function ExplorerShell() {
  const { navigationActive } = useExplorer();

  return (
    <main
      className={`relative h-screen w-full overflow-hidden bg-[#030508] ${
        navigationActive ? "cursor-none" : "cursor-default"
      }`}
    >
      <SolarSystemCanvas />
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
