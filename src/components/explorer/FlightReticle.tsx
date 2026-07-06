"use client";

import { useExplorer } from "@/context/ExplorerContext";
import { isExtensionPackaged, isExtensionScreensaverFlight } from "@/lib/screensaverConfig";

export function FlightReticle() {
  const {
    navigationActive,
    autoNavigating,
    discoveryAutopilotActive,
    flightReticleVisible,
  } = useExplorer();

  const extensionFlight = isExtensionScreensaverFlight(navigationActive);
  const active =
    navigationActive &&
    (extensionFlight || (!autoNavigating && !discoveryAutopilotActive));
  if (!active) return null;

  if (isExtensionPackaged()) {
    return (
      <div
        className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none select-none"
        aria-hidden
      >
        <span className="block h-1 w-1 rounded-full bg-zinc-400/30 shadow-[0_0_4px_rgba(200,220,255,0.15)]" />
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center pointer-events-none select-none transition-opacity duration-700 ${
        flightReticleVisible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden
    >
      <div className="flex flex-col items-center opacity-35">
        <span className="block w-px h-4 bg-zinc-300/80" />
        <span className="block w-1.5 h-1.5 rounded-full bg-zinc-200/90 my-0.5 shadow-[0_0_6px_rgba(200,220,255,0.35)]" />
        <span className="block w-px h-4 bg-zinc-300/80" />
      </div>
    </div>
  );
}
