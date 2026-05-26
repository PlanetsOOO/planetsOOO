"use client";

import { useEffect, useRef } from "react";
import { useExplorer } from "@/context/ExplorerContext";
import { discoveryAutopilotState } from "@/lib/discoveryAutopilot";
import { PlanetSearch } from "./PlanetSearch";
import { RoutePathPlanner } from "./RoutePathPlanner";

export function OptionsMenu() {
  const {
    menuOpen,
    setMenuOpen,
    showOrbits,
    setShowOrbits,
    showLabels,
    setShowLabels,
    showConstellations,
    setShowConstellations,
    paused,
    setPaused,
    speed,
    setSpeed,
    travelSpeed,
    setTravelSpeed,
    speedUnit,
    setSpeedUnit,
    discoveryAutopilotActive,
    setDiscoveryAutopilotActive,
    scenicChromeVisible,
    routeActive,
  } = useExplorer();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpen, setMenuOpen]);

  const scenicTourActive =
    discoveryAutopilotActive || discoveryAutopilotState.active;
  const hideChrome = scenicTourActive && !scenicChromeVisible;

  return (
    <div
      ref={panelRef}
      className={`fixed top-5 right-5 z-50 transition-opacity duration-700 ${
        hideChrome ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <button
        type="button"
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex flex-col gap-1.5 p-2 rounded-md transition-opacity hover:opacity-70 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
        style={{ opacity: menuOpen ? 0.55 : 0.28 }}
        aria-label="Options"
        aria-expanded={menuOpen}
      >
        <span className="block h-px w-5 bg-zinc-300" />
        <span className="block h-px w-5 bg-zinc-300" />
        <span className="block h-px w-5 bg-zinc-300" />
      </button>

      {menuOpen && (
        <div
          data-explorer-menu
          className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-white/8 bg-black/70 backdrop-blur-md p-3 shadow-xl max-h-[85vh] overflow-y-auto"
        >
          <PlanetSearch />
          <RoutePathPlanner />
          <Toggle
            label="Scenic tour"
            checked={discoveryAutopilotActive}
            onChange={setDiscoveryAutopilotActive}
            disabled={routeActive}
          />
          <Toggle
            label="Orbit paths"
            checked={showOrbits}
            onChange={setShowOrbits}
          />
          <Toggle
            label="Labels"
            checked={showLabels}
            onChange={setShowLabels}
          />
          <Toggle
            label="Constellations"
            checked={showConstellations}
            onChange={setShowConstellations}
          />
          <Toggle
            label="Pause motion"
            checked={paused}
            onChange={setPaused}
          />
          <label className="mt-3 flex flex-col gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wider">
            Travel speed
            <input
              type="range"
              min={1}
              max={5000}
              step={1}
              value={travelSpeed}
              onChange={(e) => setTravelSpeed(parseInt(e.target.value, 10))}
              className="w-full accent-sky-500 h-0.5"
            />
            <span className="font-mono text-zinc-400 normal-case">
              {travelSpeed}× cruise
            </span>
          </label>
          <div className="flex gap-1 mt-1">
            <button
              type="button"
              onClick={() => setSpeedUnit("kph")}
              className={`flex-1 rounded py-1 text-[10px] uppercase tracking-wider transition-colors ${
                speedUnit === "kph"
                  ? "bg-white/10 text-zinc-200"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              km/h
            </button>
            <button
              type="button"
              onClick={() => setSpeedUnit("mph")}
              className={`flex-1 rounded py-1 text-[10px] uppercase tracking-wider transition-colors ${
                speedUnit === "mph"
                  ? "bg-white/10 text-zinc-200"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              mph
            </button>
          </div>
          <label className="mt-3 flex flex-col gap-1.5 text-[10px] text-zinc-500 uppercase tracking-wider">
            Orbit time scale
            <input
              type="range"
              min={0.1}
              max={4}
              step={0.1}
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-full accent-zinc-400 h-0.5"
            />
            <span className="font-mono text-zinc-400 normal-case">
              {speed.toFixed(1)}×
            </span>
          </label>
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-2 py-1.5 text-xs cursor-pointer ${
        disabled
          ? "text-zinc-600 cursor-not-allowed"
          : "text-zinc-400 hover:text-zinc-300"
      }`}
    >
      {label}
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-zinc-400 disabled:opacity-40"
      />
    </label>
  );
}
