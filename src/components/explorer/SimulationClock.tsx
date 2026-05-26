"use client";

import { useFrame } from "@react-three/fiber";
import { useExplorer } from "@/context/ExplorerContext";
import { tickSimulation } from "@/lib/simulationTime";

/** Advances the shared UTC simulation clock each frame. */
export function SimulationClock() {
  const { paused, speed } = useExplorer();

  useFrame(() => {
    tickSimulation(paused, speed);
  });

  return null;
}
