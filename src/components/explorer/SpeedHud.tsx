"use client";

import { useExplorer } from "@/context/ExplorerContext";
import { LUDICROUS_SPEED_MULTIPLIER } from "@/lib/lightspeed";
import { formatScenicLightspeedMultiple } from "@/lib/scenicTransit";
import { isExtensionPackaged } from "@/lib/screensaverConfig";
import { lightspeedState } from "@/lib/warpState";

export function SpeedHud() {
  const {
    displaySpeedKmPerSec,
    displayLightspeedMultiple,
    speedUnit,
    navigationActive,
    autoNavigating,
    discoveryAutopilotActive,
    lightspeedActive,
  } = useExplorer();

  const active = navigationActive || autoNavigating || discoveryAutopilotActive;
  const showCMultiple =
    displayLightspeedMultiple >= 0.95 && (autoNavigating || lightspeedActive);
  const ludicrous =
    navigationActive &&
    !autoNavigating &&
    lightspeedState.ludicrous &&
    displayLightspeedMultiple >= LUDICROUS_SPEED_MULTIPLIER * 0.95;

  if (isExtensionPackaged() && !navigationActive) return null;

  if (displaySpeedKmPerSec < 0.01 && !active && !showCMultiple) return null;

  const value =
    speedUnit === "kph"
      ? displaySpeedKmPerSec * 3600
      : displaySpeedKmPerSec * 2236.9362920544;

  const label = speedUnit === "kph" ? "km/h" : "mph";

  return (
    <div
      className={`fixed top-5 z-40 pointer-events-none select-none font-mono text-[10px] text-zinc-600/80 tabular-nums text-right ${
        isExtensionPackaged() ? "right-5" : "right-14"
      }`}
      aria-live="polite"
    >
      {showCMultiple ? (
        <>
          <p
            className={`mb-0.5 tracking-wider ${
              ludicrous ? "text-fuchsia-400/95" : "text-sky-400/90"
            }`}
          >
            {ludicrous ? "LUDICROUS" : "LIGHTSPEED"}
          </p>
          <p className={ludicrous ? "text-fuchsia-300/80" : "text-sky-300/75"}>
            {formatScenicLightspeedMultiple(displayLightspeedMultiple)} c
          </p>
        </>
      ) : (
        <>
          {lightspeedActive && (
            <p className="mb-0.5 tracking-wider text-sky-400/90">LIGHTSPEED</p>
          )}
          <p className={lightspeedActive ? "text-sky-300/75" : ""}>
            {value.toLocaleString(undefined, { maximumFractionDigits: 0 })}{" "}
            {label}
          </p>
        </>
      )}
    </div>
  );
}
