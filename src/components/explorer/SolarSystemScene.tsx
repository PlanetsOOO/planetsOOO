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
import { IssMesh } from "./IssMesh";
import { IssOrbitRing } from "./IssOrbitRing";
import { IdleOrbitController } from "./IdleOrbitController";
import { TrackableFocusController } from "./TrackableFocusController";
import { DiscoveryAutopilotController } from "./DiscoveryAutopilotController";
import { EarthApproachController } from "./EarthApproachController";
import { FlightTargetSelector } from "./FlightTargetSelector";
import { MultiplayerController } from "./MultiplayerController";
import { RemotePlayerMarkers } from "./RemotePlayerMarkers";
import { OnlineCockpitCamera } from "@/components/online/OnlineCockpitCamera";
import { isMultiplayerMode, isOnlineMode } from "@/lib/screensaverConfig";
import { initialSpawnAngles } from "@/lib/viewerState";

export function SolarSystemScene() {
  const { showOrbits } = useExplorer();
  const flightRef = useFlightStateRef();
  const yawRef = useRef(initialSpawnAngles.yaw);
  const pitchRef = useRef(initialSpawnAngles.pitch);
  const rollRef = useRef(0);

  const bodies = useMemo(() => PLANETS.filter((p) => p.id !== "sun"), []);
  const multiplayerEnabled = isMultiplayerMode() || isOnlineMode();
  const onlineEnabled = isOnlineMode();

  return (
    <>
      <color attach="background" args={["#030508"]} />

      <SimulationClock />
      <SunLighting />
      {onlineEnabled ? <OnlineCockpitCamera /> : null}
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
        {showOrbits && <IssOrbitRing />}

        {PLANETS.map((planet) => (
          <PlanetMesh key={planet.id} config={planet} />
        ))}

        <MoonMesh />
        <IssMesh />
        {multiplayerEnabled ? <RemotePlayerMarkers /> : null}
      </FloatingOrigin>

      <FlightControls
        flightRef={flightRef}
        yawRef={yawRef}
        pitchRef={pitchRef}
        rollRef={rollRef}
      />
      {!onlineEnabled ? (
        <IdleOrbitController yawRef={yawRef} pitchRef={pitchRef} rollRef={rollRef} />
      ) : null}
      <TrackableFocusController
        yawRef={yawRef}
        pitchRef={pitchRef}
        rollRef={rollRef}
      />
      {!onlineEnabled ? (
        <DiscoveryAutopilotController
          yawRef={yawRef}
          pitchRef={pitchRef}
          rollRef={rollRef}
        />
      ) : null}
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
      {multiplayerEnabled ? (
        <MultiplayerController yawRef={yawRef} pitchRef={pitchRef} />
      ) : null}
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
