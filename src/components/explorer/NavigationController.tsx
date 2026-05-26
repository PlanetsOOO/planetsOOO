"use client";

import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { unitsPerSecToKmPerSec } from "@/data/astronomy";
import { isMoonTarget, type NavTargetId } from "@/data/navigationTargets";
import { MOON } from "@/data/moon";
import { getMoonHeliocentricPosition } from "@/lib/astronomy/moonEphemeris";
import { getPlanet } from "@/data/planets";
import { useExplorer } from "@/context/ExplorerContext";
import {
  applyAutopilotThrust,
  BASE_MAX_SPEED,
  steerToward,
  STOP_THRESHOLD,
} from "@/lib/flightPhysics";
import type { FlightState } from "@/hooks/useFlightState";
import { inputKeys } from "@/lib/inputState";
import {
  BASE_FOV,
  LIGHTSPEED_MAX,
  lightspeedIntensity,
  lightspeedTargetFov,
} from "@/lib/lightspeed";
import { getHeliocentricPosition } from "@/lib/astronomy/ephemeris";
import { captureOrbitFrame } from "@/lib/bodyOrbit";
import {
  activateIdleOrbit,
  idleOrbitState,
} from "@/lib/idleOrbitState";
import {
  applyCameraAngles,
  AUTO_NAV_WARP_DISTANCE,
  getApproachPositionForTarget,
  getPlanetArrivalDistance,
} from "@/lib/navigation";
import {
  resolveMoonFocusActive,
  syncMoonFocusLock,
} from "@/lib/moonFocusLock";
import { getSimulationDate } from "@/lib/simulationTime";
import { getTargetPosition, setTargetPosition } from "@/lib/targetPositions";
import { lightspeedState, resetLightspeedState } from "@/lib/warpState";
import { viewerPosition } from "@/lib/viewerState";
import {
  beginDiscoveryOrbitPhase,
  beginDiscoveryTransitLock,
  captureDiscoveryPlanetOrbit,
  discoveryAutopilotState,
  getDiscoveryDesiredPosition,
  getDiscoveryStandoffUnits,
  markDiscoveryDeparture,
} from "@/lib/discoveryAutopilot";
import {
  beginRouteObserve,
  beginRouteTransitLock,
  getRouteDesiredPosition,
  markRouteDeparture,
  routeTourState,
} from "@/lib/routeTour";
import {
  SCENIC_APPROACH_MIN_SPEED,
  SCENIC_APPROACH_ZONE_SCALE,
  SCENIC_MAX_LIGHTSPEED_MULTIPLIER,
  scenicLightspeedMultiple,
  scenicTransitEtaSec,
  scenicTransitSpeed,
  scenicTransitSpeedEnvelope,
} from "@/lib/scenicTransit";

const ARRIVAL_SPEED = BASE_MAX_SPEED * 4;

const fallbackPos = new THREE.Vector3();

function resolveTargetPosition(navTargetId: NavTargetId) {
  const live = getTargetPosition(navTargetId);
  if (live) return live;
  if (isMoonTarget(navTargetId)) {
    getMoonHeliocentricPosition(getSimulationDate(), fallbackPos);
    setTargetPosition(navTargetId, fallbackPos);
    return fallbackPos;
  }
  const config = getPlanet(navTargetId);
  getHeliocentricPosition(
    navTargetId,
    config.orbitRadius,
    getSimulationDate(),
    fallbackPos,
  );
  setTargetPosition(navTargetId, fallbackPos);
  return fallbackPos;
}

interface NavigationControllerProps {
  flightRef: React.MutableRefObject<FlightState>;
  yawRef: React.MutableRefObject<number>;
  pitchRef: React.MutableRefObject<number>;
}

export function NavigationController({
  flightRef,
  yawRef,
  pitchRef,
}: NavigationControllerProps) {
  const { camera } = useThree();
  const {
    autoNavigating,
    navTargetId,
    routeActive,
    routeLegIndex,
    routeWaypoints,
    travelSpeed,
    clearAutoNavigation,
    endAutopilotTransit,
    advanceRouteLeg,
    setDisplaySpeedKmPerSec,
    setDisplayLightspeedMultiple,
    setLightspeedIntensity,
    setLightspeedActive,
  } = useExplorer();

  const velocity = useRef(new THREE.Vector3());
  const acceleration = useRef(new THREE.Vector3());
  const desiredPos = useRef(new THREE.Vector3());
  const thrustDir = useRef(new THREE.Vector3());
  const travelSpeedRef = useRef(travelSpeed);
  const legKey = useRef("");

  useEffect(() => {
    travelSpeedRef.current = travelSpeed;
  }, [travelSpeed]);

  useFrame((_, delta) => {
    syncMoonFocusLock(
      resolveMoonFocusActive({ navTargetId, autoNavigating, routeActive }),
      getSimulationDate(),
    );

    if (!autoNavigating || !navTargetId) {
      return;
    }

    const legMarker = discoveryAutopilotState.active
      ? `discovery:${discoveryAutopilotState.currentTargetId}`
      : `${routeLegIndex}:${navTargetId}`;
    if (legKey.current !== legMarker) {
      velocity.current.set(0, 0, 0);
      acceleration.current.set(0, 0, 0);
      legKey.current = legMarker;
    }

    const absolutePos = resolveTargetPosition(navTargetId);
    if (!absolutePos) {
      return;
    }

    const planetConfig = isMoonTarget(navTargetId)
      ? ({ radius: MOON.radius } as ReturnType<typeof getPlanet>)
      : getPlanet(navTargetId);
    const arrivalDist = getPlanetArrivalDistance(planetConfig);
    const standoffUnits = getDiscoveryStandoffUnits(navTargetId, planetConfig);

    const discoveryTransit =
      discoveryAutopilotState.active &&
      discoveryAutopilotState.phase === "transit";
    const routeTransit =
      routeActive && !routeTourState.observing && autoNavigating;
    const scenicTransit = discoveryTransit || routeTransit;

    if (discoveryTransit && discoveryAutopilotState.alignmentMs <= 0) {
      markDiscoveryDeparture();
    }
    if (routeTransit && routeTourState.alignmentMs <= 0) {
      markRouteDeparture();
    }

    const alignmentMs = discoveryTransit
      ? discoveryAutopilotState.alignmentMs
      : routeTourState.alignmentMs;

    if (discoveryTransit && !discoveryAutopilotState.approachLocked && alignmentMs > 0) {
      beginDiscoveryTransitLock(
        navTargetId,
        absolutePos,
        viewerPosition,
        planetConfig,
      );
    }
    if (routeTransit && !routeTourState.approachLocked && alignmentMs > 0) {
      beginRouteTransitLock(
        navTargetId,
        absolutePos,
        viewerPosition,
        planetConfig,
      );
    }

    desiredPos.current.copy(
      discoveryTransit
        ? getDiscoveryDesiredPosition(
            navTargetId,
            absolutePos,
            viewerPosition,
            planetConfig,
          )
        : routeTransit
          ? getRouteDesiredPosition(
              navTargetId,
              absolutePos,
              viewerPosition,
              planetConfig,
            )
          : getApproachPositionForTarget(
              navTargetId,
              absolutePos,
              viewerPosition,
              planetConfig,
            ),
    );

    const dt = Math.min(delta, 0.05);

    thrustDir.current.subVectors(desiredPos.current, viewerPosition);
    const dist = thrustDir.current.length();
    const distToBody = viewerPosition.distanceTo(absolutePos);

    if (!routeActive || scenicTransit) {
      if (!discoveryTransit && !routeTransit) {
        steerToward(
          yawRef,
          pitchRef,
          viewerPosition,
          absolutePos,
          dt,
          2.8,
        );
      }
    }

    if (discoveryTransit || routeTransit) {
      const searchFocusTransit =
        discoveryTransit && discoveryAutopilotState.searchFocusLocked;
      const transitEtaSec = scenicTransitEtaSec(searchFocusTransit);
      const elapsedSec =
        alignmentMs > 0 ? (Date.now() - alignmentMs) / 1000 : 0;
      const envelope = scenicTransitSpeedEnvelope(
        distToBody,
        standoffUnits,
        elapsedSec,
        { searchFocus: searchFocusTransit },
      );
      const speed =
        scenicTransitSpeed(dist, alignmentMs, Date.now(), transitEtaSec) *
        envelope;
      const multiple = scenicLightspeedMultiple(speed);
      setDisplayLightspeedMultiple(multiple >= 1 ? multiple : 0);

      const inApproachZone =
        distToBody <= standoffUnits * SCENIC_APPROACH_ZONE_SCALE;
      const arrivalThreshold = Math.max(standoffUnits * 0.06, 0.12);
      const coastingToOrbit =
        inApproachZone && dist <= standoffUnits * 0.68;

      let move = 0;
      if (!coastingToOrbit && dist > 1e-6) {
        const dir = thrustDir.current.multiplyScalar(1 / dist);
        move = Math.min(dist, speed * dt);
        viewerPosition.addScaledVector(dir, move);
        velocity.current.copy(dir).multiplyScalar(move / Math.max(dt, 1e-6));
      }

      if (inApproachZone && dist > 1e-6) {
        const approachSettle = (1 - envelope) * dt * 1.25;
        if (approachSettle > 0.001) {
          viewerPosition.lerp(
            desiredPos.current,
            Math.min(0.09, approachSettle),
          );
        }
        if (coastingToOrbit) {
          const coastSpeed = Math.max(speed * envelope * 0.68, dist * 0.28);
          velocity.current.copy(thrustDir.current.normalize()).multiplyScalar(
            coastSpeed,
          );
        }
      }

      const transitProgress = THREE.MathUtils.clamp(
        elapsedSec / transitEtaSec,
        0,
        1,
      );
      const approachProgress = inApproachZone
        ? 1 -
          THREE.MathUtils.clamp(
            (distToBody - standoffUnits * 0.95) /
              (standoffUnits * (SCENIC_APPROACH_ZONE_SCALE - 0.95)),
            0,
            1,
          )
        : 0;
      steerToward(
        yawRef,
        pitchRef,
        viewerPosition,
        absolutePos,
        dt,
        1.35 + transitProgress * 0.5 - approachProgress * 1.2,
      );

      const intensity = Math.min(
        1,
        multiple / SCENIC_MAX_LIGHTSPEED_MULTIPLIER,
      );
      const warpVisual = multiple >= 1;
      lightspeedState.active = warpVisual;
      lightspeedState.intensity = warpVisual ? intensity : 0;

      flightRef.current.velocity.copy(velocity.current);
      flightRef.current.acceleration.set(0, 0, 0);
      flightRef.current.thrusting = move > 0;
      flightRef.current.throttle = warpVisual ? 0.5 + intensity * 0.5 : 0.35;
      flightRef.current.speed = velocity.current.length();
      flightRef.current.speedKmPerSec = unitsPerSecToKmPerSec(
        flightRef.current.speed,
      );
      flightRef.current.lightspeedActive = warpVisual;
      flightRef.current.lightspeedIntensity = warpVisual ? intensity : 0;

      setLightspeedIntensity(warpVisual ? intensity : 0);
      setLightspeedActive(warpVisual);
      setDisplaySpeedKmPerSec(flightRef.current.speedKmPerSec);

      applyCameraAngles(camera, yawRef.current, pitchRef.current);

      const cam = camera as THREE.PerspectiveCamera;
      if ("fov" in cam) {
        const targetFov =
          warpVisual && intensity > 0.02
            ? lightspeedTargetFov(intensity)
            : BASE_FOV;
        cam.fov = THREE.MathUtils.lerp(
          cam.fov,
          targetFov,
          1 - Math.exp(-3 * dt),
        );
        cam.updateProjectionMatrix();
      }

      const arrived =
        dist <= arrivalThreshold ||
        (coastingToOrbit &&
          envelope <= SCENIC_APPROACH_MIN_SPEED * 1.2) ||
        elapsedSec >= transitEtaSec + (searchFocusTransit ? 2 : 12);

      if (arrived) {
        const settleBlend = 1 - Math.exp(-2.8 * dt);
        viewerPosition.lerp(desiredPos.current, settleBlend);
        velocity.current.multiplyScalar(1 - settleBlend);
        flightRef.current.velocity.copy(velocity.current);
        flightRef.current.speed = velocity.current.length();
        flightRef.current.speedKmPerSec = unitsPerSecToKmPerSec(
          flightRef.current.speed,
        );
        setDisplaySpeedKmPerSec(flightRef.current.speedKmPerSec);
        const settleMultiple = scenicLightspeedMultiple(flightRef.current.speed);
        setDisplayLightspeedMultiple(settleMultiple >= 1 ? settleMultiple : 0);

        if (viewerPosition.distanceTo(desiredPos.current) > arrivalThreshold * 0.5) {
          return;
        }
        viewerPosition.copy(desiredPos.current);
        velocity.current.set(0, 0, 0);
        flightRef.current.velocity.set(0, 0, 0);
        flightRef.current.speed = 0;
        flightRef.current.speedKmPerSec = 0;
        resetLightspeedState();
        setLightspeedIntensity(0);
        setLightspeedActive(false);
        setDisplaySpeedKmPerSec(0);
        setDisplayLightspeedMultiple(0);

        if (discoveryAutopilotState.active && !routeActive && navTargetId) {
          beginDiscoveryOrbitPhase();
          endAutopilotTransit();
          return;
        }

        if (routeActive && navTargetId) {
          if (isMoonTarget(navTargetId)) {
            captureOrbitFrame(
              viewerPosition,
              absolutePos,
              MOON.radius,
              idleOrbitState.frame,
            );
            captureDiscoveryPlanetOrbit(idleOrbitState.frame, 0);
          } else {
            const arrivedPlanet = getPlanet(navTargetId);
            captureOrbitFrame(
              viewerPosition,
              absolutePos,
              arrivedPlanet.radius,
              idleOrbitState.frame,
            );
            captureDiscoveryPlanetOrbit(idleOrbitState.frame, 0);
          }
          beginRouteObserve(
            navTargetId,
            routeWaypoints[routeLegIndex + 1] ?? null,
          );
          endAutopilotTransit();
          return;
        }
      }
      return;
    }

    setDisplayLightspeedMultiple(0);

    const shiftBoost = inputKeys.has("shift");
    const effectiveTravelSpeed = travelSpeedRef.current;
    const useLightspeed = shiftBoost || distToBody > AUTO_NAV_WARP_DISTANCE;

    const useThrustPath = dist > arrivalDist * 0.35;

    if (useThrustPath) {
      if (useLightspeed) {
        const dir = thrustDir.current.clone().normalize();
        const speed = LIGHTSPEED_MAX;
        const move = Math.min(dist, speed * dt);
        viewerPosition.addScaledVector(dir, move);
        velocity.current.copy(dir).multiplyScalar(speed);
        acceleration.current.set(0, 0, 0);

        const multiple = scenicLightspeedMultiple(speed);
        const intensity = lightspeedIntensity(speed);
        setDisplayLightspeedMultiple(multiple >= 0.95 ? multiple : 0);
        lightspeedState.active = true;
        lightspeedState.intensity = intensity;

        flightRef.current.velocity.copy(velocity.current);
        flightRef.current.acceleration.set(0, 0, 0);
        flightRef.current.thrusting = move > 0;
        flightRef.current.throttle = 0.5 + intensity * 0.5;
        flightRef.current.speed = speed;
        flightRef.current.speedKmPerSec = unitsPerSecToKmPerSec(speed);
        flightRef.current.lightspeedActive = true;
        flightRef.current.lightspeedIntensity = intensity;

        setLightspeedIntensity(intensity);
        setLightspeedActive(true);
        setDisplaySpeedKmPerSec(flightRef.current.speedKmPerSec);
      } else {
        const result = applyAutopilotThrust(
          velocity.current,
          acceleration.current,
          thrustDir.current,
          dt,
          effectiveTravelSpeed,
          false,
        );

        viewerPosition.addScaledVector(velocity.current, dt);

        flightRef.current.velocity.copy(velocity.current);
        flightRef.current.acceleration.copy(acceleration.current);
        flightRef.current.thrusting = result.thrusting;
        flightRef.current.throttle = result.throttle;
        flightRef.current.speed = result.speed;
        flightRef.current.speedKmPerSec = unitsPerSecToKmPerSec(result.speed);
        flightRef.current.lightspeedActive = false;
        flightRef.current.lightspeedIntensity = 0;

        resetLightspeedState();
        setLightspeedIntensity(0);
        setLightspeedActive(false);
        setDisplaySpeedKmPerSec(flightRef.current.speedKmPerSec);
      }
    } else {
      velocity.current.multiplyScalar(1 - Math.exp(-8 * dt));
      if (velocity.current.length() < STOP_THRESHOLD) {
        velocity.current.set(0, 0, 0);
      }
      viewerPosition.addScaledVector(velocity.current, dt);
      flightRef.current.velocity.copy(velocity.current);
      flightRef.current.speed = velocity.current.length();
      flightRef.current.speedKmPerSec = unitsPerSecToKmPerSec(
        flightRef.current.speed,
      );
    }

    applyCameraAngles(camera, yawRef.current, pitchRef.current);

    const cam = camera as THREE.PerspectiveCamera;
    if ("fov" in cam) {
      const intensity = flightRef.current.lightspeedIntensity;
      const targetFov =
        intensity > 0.02
          ? lightspeedTargetFov(intensity)
          : BASE_FOV;
      cam.fov = THREE.MathUtils.lerp(
        cam.fov,
        targetFov,
        1 - Math.exp(-4 * dt),
      );
      cam.updateProjectionMatrix();
    }

    const routeArrived =
      dist < arrivalDist * 1.05 &&
      velocity.current.length() < ARRIVAL_SPEED;
    const normalArrived =
      dist < arrivalDist &&
      velocity.current.length() < ARRIVAL_SPEED;

    if (routeArrived || normalArrived) {
      viewerPosition.copy(desiredPos.current);
      velocity.current.set(0, 0, 0);
      acceleration.current.set(0, 0, 0);
      flightRef.current.velocity.copy(velocity.current);
      flightRef.current.thrusting = false;
      flightRef.current.throttle = 0;
      flightRef.current.speed = velocity.current.length();
      flightRef.current.speedKmPerSec = unitsPerSecToKmPerSec(
        flightRef.current.speed,
      );
      resetLightspeedState();
      setLightspeedIntensity(0);
      setLightspeedActive(false);
      setDisplaySpeedKmPerSec(flightRef.current.speedKmPerSec);
      setDisplayLightspeedMultiple(0);

      if (!routeActive && navTargetId) {
        if (isMoonTarget(navTargetId)) {
          captureOrbitFrame(
            viewerPosition,
            absolutePos,
            MOON.radius,
            idleOrbitState.frame,
          );
          idleOrbitState.phase = 0;
          captureDiscoveryPlanetOrbit(idleOrbitState.frame, 0);
        } else {
          const arrived = getPlanet(navTargetId);
          captureOrbitFrame(
            viewerPosition,
            absolutePos,
            arrived.radius,
            idleOrbitState.frame,
          );
          idleOrbitState.phase = 0;
          activateIdleOrbit(navTargetId);
          idleOrbitState.active = true;
          captureDiscoveryPlanetOrbit(idleOrbitState.frame, 0);
        }
      }

      if (routeActive) {
        advanceRouteLeg();
      } else {
        clearAutoNavigation();
      }
    }
  });

  return null;
}
