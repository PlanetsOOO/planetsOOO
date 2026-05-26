"use client";

import { useEffect, useRef } from "react";
import { useExplorer } from "@/context/ExplorerContext";
import {
  discoveryAutopilotState,
  nudgeScenicOrbitFov,
} from "@/lib/discoveryAutopilot";

const ARROW_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

export function ScenicChromeController() {
  const {
    discoveryAutopilotActive,
    markScenicChromeActivity,
    markFlightReticleActivity,
  } = useExplorer();
  const activeRef = useRef(discoveryAutopilotActive);
  const markScenicRef = useRef(markScenicChromeActivity);
  const markReticleRef = useRef(markFlightReticleActivity);

  useEffect(() => {
    activeRef.current = discoveryAutopilotActive;
    markScenicRef.current = markScenicChromeActivity;
    markReticleRef.current = markFlightReticleActivity;
  }, [
    discoveryAutopilotActive,
    markScenicChromeActivity,
    markFlightReticleActivity,
  ]);

  useEffect(() => {
    if (!discoveryAutopilotActive) return;

    markScenicChromeActivity();
    markFlightReticleActivity();

    const onKeyDown = (e: KeyboardEvent) => {
      if (!activeRef.current) return;

      if (discoveryAutopilotState.phase === "orbit") {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          nudgeScenicOrbitFov("in");
          return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          nudgeScenicOrbitFov("out");
          return;
        }
      }

      if (!ARROW_KEYS.has(e.key)) {
        markScenicRef.current();
        markReticleRef.current();
      }
    };

    const onPointer = () => {
      if (activeRef.current) {
        markScenicRef.current();
        markReticleRef.current();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("wheel", onPointer, { passive: true });

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("wheel", onPointer);
    };
  }, [
    discoveryAutopilotActive,
    markFlightReticleActivity,
    markScenicChromeActivity,
  ]);

  return null;
}
