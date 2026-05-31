"use client";

import { useMemo, useRef } from "react";
import { PLANETS } from "@/data/planets";
import { useExplorer } from "@/context/ExplorerContext";
import { useFlightStateRef } from "@/hooks/useFlightState";
import { FloatingOrigin } from "./FloatingOrigin";
import { FlightControls } from "./FlightControls";
import { NavigationController } from "./NavigationController";
import { OrbitRing } from "./OrbitRing";
import { PlanetMesh } from "./PlanetMesh";
import { RoutePathLine } from "./RoutePathLine";
import { CelestialSky } from "./CelestialSky";
import { SimulationClock } from "./SimulationClock";
import { SunLighting } from "./SunLighting";
import { ThrustEffect } from "./ThrustEffect";
import { MoonMesh } from "./MoonMesh";
import { MoonOrbitRing } from "./MoonOrbitRing";
import { IdleOrbitController } from "./IdleOrbitController";
import { DiscoveryAutopilotController } from "./DiscoveryAutopilotController";
import { EarthApproachController } from "./EarthApproachController";
import { FlightTargetSelector } from "./FlightTargetSelector";
import { initialSpawnAngles } from "@/lib/viewerState";

export function SolarSystemScene() {
  const { showOrbits } = useExplorer();
  const flightRef = useFlightStateRef();
  const yawRef = useRef(initialSpawnAngles.yaw);
  const pitchRef = useRef(initialSpawnAngles.pitch);
  const rollRef = useRef(0);

  const bodies = useMemo(() => PLANETS.filter((p) => p.id !== "sun"), []);

  return (
    <>
      <color attach="background" args={["#030508"]} />

      <SimulationClock />
      <SunLighting />
      <FloatingOrigin>
        <CelestialSky />

        {showOrbits &&
          bodies.map((p) => (
            <OrbitRing
              key={p.id}
              planetId={p.id as Exclude<typeof p.id, "sun">}
            />
          ))}

        <RoutePathLine />

        {showOrbits && <MoonOrbitRing />}

        {PLANETS.map((planet) => (
          <PlanetMesh key={planet.id} config={planet} />
        ))}

        <MoonMesh />
      </FloatingOrigin>

      <FlightControls
        flightRef={flightRef}
        yawRef={yawRef}
        pitchRef={pitchRef}
        rollRef={rollRef}
      />
      <IdleOrbitController yawRef={yawRef} pitchRef={pitchRef} rollRef={rollRef} />
      <DiscoveryAutopilotController
        yawRef={yawRef}
        pitchRef={pitchRef}
        rollRef={rollRef}
      />
      <EarthApproachController
        yawRef={yawRef}
        pitchRef={pitchRef}
        rollRef={rollRef}
      />
      <FlightTargetSelector
        yawRef={yawRef}
        pitchRef={pitchRef}
        rollRef={rollRef}
      />
      <NavigationController
        flightRef={flightRef}
        yawRef={yawRef}
        pitchRef={pitchRef}
        rollRef={rollRef}
      />
      <ThrustEffect flightRef={flightRef} />
    </>
  );
}
