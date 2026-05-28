"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { unitsPerSecToKmPerSec } from "@/data/astronomy";
import { useExplorer } from "@/context/ExplorerContext";
import {
  applyCoastDrag,
  applyFullBrake,
  BASE_MAX_SPEED,
  BASE_MAX_THRUST,
  COAST_RESPONSE,
  STOP_THRESHOLD,
  THRUST_RESPONSE,
} from "@/lib/flightPhysics";
import type { FlightState } from "@/hooks/useFlightState";
import { clearInputKeys, inputKeys } from "@/lib/inputState";
import {
  isMobileFlightActive,
  mobileTouchState,
  MOBILE_LOOK_SENSITIVITY,
} from "@/lib/mobileTouchState";
import {
  BASE_FOV,
  LIGHTSPEED_ACCEL,
  LIGHTSPEED_MAX,
  LUDICROUS_ACCEL,
  LUDICROUS_SPEED_MAX,
  lightspeedIntensity,
  lightspeedMultiple,
  ludicrousIntensity,
  warpTargetFov,
} from "@/lib/lightspeed";
import {
  applyCameraAngles,
  directionFromAngles,
} from "@/lib/navigation";
import { markIdleOrbitUserActivity, idleOrbitState } from "@/lib/idleOrbitState";
import { discoveryAutopilotState, markDiscoveryPovActivity } from "@/lib/discoveryAutopilot";
import { flightReticleState } from "@/lib/flightReticleState";
import { viewerPosition } from "@/lib/viewerState";
import { lightspeedState, resetLightspeedState } from "@/lib/warpState";

const MOUSE_SENSITIVITY = 0.0022;
const PITCH_LIMIT = Math.PI / 2 - 0.12;

function requestPointerLockIfSupported(el: HTMLElement): void {
  el.requestPointerLock?.();
}

function isScenicAutopilotZoomKey(
  key: string,
  discoveryActive: boolean,
): boolean {
  return (
    discoveryActive &&
    discoveryAutopilotState.phase === "orbit" &&
    (key === "ArrowUp" || key === "ArrowDown")
  );
}

interface FlightControlsProps {
  flightRef: React.MutableRefObject<FlightState>;
  yawRef: React.MutableRefObject<number>;
  pitchRef: React.MutableRefObject<number>;
}

function syncKey(set: Set<string>, key: string, down: boolean) {
  if (down) set.add(key);
  else set.delete(key);
}

export function FlightControls({
  flightRef,
  yawRef,
  pitchRef,
}: FlightControlsProps) {
  const { gl } = useThree();
  const {
    autoNavigating,
    routeActive,
    discoveryAutopilotActive,
    navigationActive,
    travelSpeed,
    setNavigationActive,
    setDisplaySpeedKmPerSec,
    setDisplayLightspeedMultiple,
    setLightspeedIntensity,
    setLightspeedActive,
    selectReticleTarget,
    interruptRouteNavigation,
    exitAutopilot,
    markScenicChromeActivity,
    markFlightReticleActivity,
  } = useExplorer();
  const travelSpeedRef = useRef(travelSpeed);
  const routeActiveRef = useRef(routeActive);
  const autoNavigatingRef = useRef(autoNavigating);
  const discoveryActiveRef = useRef(discoveryAutopilotActive);
  const navigationActiveRef = useRef(navigationActive);
  const velocity = useRef(new THREE.Vector3());
  const acceleration = useRef(new THREE.Vector3());
  const targetAccel = useRef(new THREE.Vector3());
  const inputDir = useRef(new THREE.Vector3());
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const up = useRef(new THREE.Vector3(0, 1, 0));
  const keys = useRef(new Set<string>());
  const throttleSmoothed = useRef(0);
  const lightspeedSpool = useRef(0);
  const speedReport = useRef(0);
  const lightspeedReport = useRef(0);
  const routeDragLook = useRef(false);
  const discoveryOrbitDragLook = useRef(false);

  useEffect(() => {
    travelSpeedRef.current = travelSpeed;
  }, [travelSpeed]);

  useEffect(() => {
    routeActiveRef.current = routeActive;
    autoNavigatingRef.current = autoNavigating;
    discoveryActiveRef.current = discoveryAutopilotActive;
    navigationActiveRef.current = navigationActive;
  }, [routeActive, autoNavigating, discoveryAutopilotActive, navigationActive]);

  useEffect(() => {
    const el = gl.domElement;

    const trackKey = (key: string, down: boolean) => {
      syncKey(keys.current, key, down);
      syncKey(inputKeys, key, down);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const routeTrip = routeActiveRef.current && autoNavigatingRef.current;

      if (["w", "a", "s", "d", " ", "shift"].includes(key)) {
        if (!discoveryActiveRef.current) {
          markIdleOrbitUserActivity();
        }
      }

      if (routeTrip && ["w", "a", "s", "d"].includes(key)) {
        interruptRouteNavigation();
        velocity.current.set(0, 0, 0);
        acceleration.current.set(0, 0, 0);
        flightRef.current.velocity.set(0, 0, 0);
        flightRef.current.acceleration.set(0, 0, 0);
        flightRef.current.speed = 0;
        flightRef.current.speedKmPerSec = 0;
        autoNavigatingRef.current = false;
        routeActiveRef.current = false;
      }

      if (
        discoveryAutopilotState.searchFocusLocked &&
        ["w", "a", "s", "d"].includes(key)
      ) {
        e.preventDefault();
        exitAutopilot();
        discoveryActiveRef.current = false;
        autoNavigatingRef.current = false;
        void el.requestPointerLock();
        trackKey(key, true);
        return;
      }

      if (document.pointerLockElement !== el && !routeTrip) return;

      if (
        document.pointerLockElement === el &&
        !isScenicAutopilotZoomKey(e.key, discoveryActiveRef.current)
      ) {
        markFlightReticleActivity();
      }

      trackKey(key, true);
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        trackKey("shift", true);
      }
      if (["w", "a", "s", "d", " "].includes(key)) {
        e.preventDefault();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      trackKey(key, false);
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") {
        trackKey("shift", false);
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      const routeTrip = routeActiveRef.current && autoNavigatingRef.current;
      const discoveryOrbit =
        discoveryActiveRef.current &&
        discoveryAutopilotState.phase === "orbit";
      if (
        (routeTrip || discoveryOrbit) &&
        document.pointerLockElement !== el &&
        e.button === 0
      ) {
        if (routeTrip) routeDragLook.current = true;
        if (discoveryOrbit) discoveryOrbitDragLook.current = true;
        return;
      }
      if (document.pointerLockElement !== el) return;
      if (e.button !== 0) return;
      markFlightReticleActivity();
      if (flightReticleState.targetId) {
        selectReticleTarget(flightReticleState.targetId);
      }
    };

    const onMouseUp = () => {
      routeDragLook.current = false;
      discoveryOrbitDragLook.current = false;
    };

    const onClick = () => {
      if (mobileTouchState.enabled) return;
      const routeTrip = routeActiveRef.current && autoNavigatingRef.current;
      if (autoNavigatingRef.current && !routeTrip) return;
      if (document.pointerLockElement === el) return;
      setNavigationActive(true);
      requestPointerLockIfSupported(el);
    };

    const onPointerLockChange = () => {
      if (mobileTouchState.enabled) return;
      const locked = document.pointerLockElement === el;
      setNavigationActive(locked);
      if (!locked) {
        keys.current.clear();
        clearInputKeys();
        resetLightspeedState();
        lightspeedSpool.current = 0;
        setLightspeedActive(false);
        setLightspeedIntensity(0);
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const routeTrip = routeActiveRef.current && autoNavigatingRef.current;
      const discoveryOrbit =
        discoveryActiveRef.current &&
        discoveryAutopilotState.phase === "orbit";
      const pointerLocked = document.pointerLockElement === el;
      const canLook =
        pointerLocked ||
        (routeTrip && routeDragLook.current) ||
        (discoveryOrbit && discoveryOrbitDragLook.current);

      if (autoNavigatingRef.current && !routeTrip) return;
      if (!canLook) return;

      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 0) {
        if (pointerLocked) {
          markFlightReticleActivity();
        }
        if (discoveryOrbit) {
          markDiscoveryPovActivity();
          markScenicChromeActivity();
        } else if (!discoveryActiveRef.current) {
          markIdleOrbitUserActivity();
        }
      }
      yawRef.current -= e.movementX * MOUSE_SENSITIVITY;
      pitchRef.current -= e.movementY * MOUSE_SENSITIVITY;
      pitchRef.current = THREE.MathUtils.clamp(
        pitchRef.current,
        -PITCH_LIMIT,
        PITCH_LIMIT,
      );
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    el.addEventListener("click", onClick);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onPointerLockChange);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("click", onClick);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
    };
  }, [
    gl,
    autoNavigating,
    routeActive,
    discoveryAutopilotActive,
    setNavigationActive,
    setLightspeedActive,
    setLightspeedIntensity,
    selectReticleTarget,
    interruptRouteNavigation,
    exitAutopilot,
    markScenicChromeActivity,
    markFlightReticleActivity,
    yawRef,
    pitchRef,
    flightRef,
  ]);

  useFrame((state, delta) => {
    const routeTrip = routeActive && autoNavigating;
    const discoveryPhase = discoveryAutopilotState.phase;
    const discoveryHandoff =
      discoveryAutopilotActive &&
      (discoveryPhase === "orbit" || discoveryPhase === "depart");

    if (discoveryHandoff) {
      velocity.current.set(0, 0, 0);
      acceleration.current.set(0, 0, 0);
      flightRef.current.velocity.set(0, 0, 0);
      flightRef.current.speed = 0;
      flightRef.current.speedKmPerSec = 0;
      applyCameraAngles(state.camera, yawRef.current, pitchRef.current);
      return;
    }

    if (autoNavigating && !routeTrip) {
      velocity.current.copy(flightRef.current.velocity);
      acceleration.current.copy(flightRef.current.acceleration);
      return;
    }

    if (routeTrip) {
      velocity.current.copy(flightRef.current.velocity);
      acceleration.current.copy(flightRef.current.acceleration);
      applyCameraAngles(state.camera, yawRef.current, pitchRef.current);
      return;
    }

    const dt = Math.min(delta, 0.05);
    const mobileFlight = isMobileFlightActive();

    if (
      mobileFlight &&
      (mobileTouchState.thrustX !== 0 ||
        mobileTouchState.thrustY !== 0 ||
        mobileTouchState.braking ||
        mobileTouchState.speedTier > 0)
    ) {
      markIdleOrbitUserActivity();
    }

    if (idleOrbitState.active) {
      velocity.current.set(0, 0, 0);
      acceleration.current.set(0, 0, 0);
      flightRef.current.velocity.set(0, 0, 0);
      flightRef.current.speed = 0;
      flightRef.current.speedKmPerSec = 0;
      return;
    }

    const camera = state.camera;
    const el = gl.domElement;
    const pointerLocked = document.pointerLockElement === el;

    if (mobileFlight) {
      const ldx = mobileTouchState.lookDx;
      const ldy = mobileTouchState.lookDy;
      if (ldx !== 0 || ldy !== 0) {
        yawRef.current -= ldx * MOBILE_LOOK_SENSITIVITY;
        pitchRef.current -= ldy * MOBILE_LOOK_SENSITIVITY;
        pitchRef.current = THREE.MathUtils.clamp(
          pitchRef.current,
          -PITCH_LIMIT,
          PITCH_LIMIT,
        );
        mobileTouchState.lookDx = 0;
        mobileTouchState.lookDy = 0;
        markFlightReticleActivity();
      }
    }

    directionFromAngles(yawRef.current, pitchRef.current, forward.current);
    right.current.crossVectors(forward.current, up.current).normalize();

    const k = pointerLocked ? keys.current : new Set<string>();
    if (mobileFlight) {
      if (mobileTouchState.braking) {
        k.add(" ");
      } else if (mobileTouchState.speedTier >= 2) {
        k.add("shift");
        k.add("w");
        k.add("f");
      } else if (mobileTouchState.speedTier >= 1) {
        k.add("shift");
        k.add("w");
      } else {
        if (mobileTouchState.thrustY > 0) k.add("w");
        if (mobileTouchState.thrustY < 0) k.add("s");
        if (mobileTouchState.thrustX > 0) k.add("d");
        if (mobileTouchState.thrustX < 0) k.add("a");
      }
    }

    const inFlightMode =
      (pointerLocked && navigationActiveRef.current) || mobileFlight;
    const braking = k.has(" ");
    const lightspeedForward =
      inFlightMode && !braking && k.has("shift") && k.has("w") && !k.has("s");
    /** Ludicrous overdrive — Shift+W plus F (100× c on top of lightspeed). */
    const ludicrousBoost =
      lightspeedForward && k.has("f");
    const lightspeedBackward =
      inFlightMode &&
      !braking &&
      k.has("shift") &&
      k.has("s") &&
      !k.has("w") &&
      !k.has("f");
    const warpEngaged = lightspeedForward || lightspeedBackward;

    const vel = velocity.current;
    const accel = acceleration.current;
    const target = targetAccel.current;
    inputDir.current.set(0, 0, 0);

    let newSpeed = vel.length();
    let kmPerSec = unitsPerSecToKmPerSec(newSpeed);
    let intensity = 0;

    if (braking) {
      applyFullBrake(vel, accel, dt, travelSpeedRef.current);
      newSpeed = vel.length();
      kmPerSec = unitsPerSecToKmPerSec(newSpeed);
      intensity = THREE.MathUtils.lerp(
        lightspeedSpool.current,
        0,
        1 - Math.exp(-8 * dt),
      );
      lightspeedSpool.current = intensity;
      resetLightspeedState();
      flightRef.current.lightspeedActive = false;
      flightRef.current.lightspeedIntensity = 0;
    } else if (warpEngaged) {
      const axis = forward.current.clone();
      if (lightspeedBackward) axis.negate();

      const targetSpeed = ludicrousBoost
        ? LUDICROUS_SPEED_MAX
        : LIGHTSPEED_MAX;
      const spoolRate = ludicrousBoost ? LUDICROUS_ACCEL : LIGHTSPEED_ACCEL;

      const signedSpeed = vel.dot(axis);
      const speedAbs = Math.abs(signedSpeed);
      const nextSpeed = THREE.MathUtils.lerp(
        speedAbs,
        targetSpeed,
        1 - Math.exp(-spoolRate * dt),
      );
      vel.copy(axis).multiplyScalar(nextSpeed);
      accel.copy(axis).multiplyScalar(spoolRate * 0.02);

      newSpeed = nextSpeed;
      kmPerSec = unitsPerSecToKmPerSec(newSpeed);
      intensity = ludicrousBoost
        ? ludicrousIntensity(newSpeed)
        : lightspeedIntensity(newSpeed);
      lightspeedSpool.current = intensity;

      lightspeedState.active = true;
      lightspeedState.intensity = intensity;
      lightspeedState.ludicrous =
        ludicrousBoost && newSpeed >= LIGHTSPEED_MAX * 0.95;
      flightRef.current.lightspeedActive = true;
      flightRef.current.lightspeedIntensity = intensity;
    } else {
      let responseRate = COAST_RESPONSE;
      const boost = travelSpeedRef.current;
      const maxSpeed = BASE_MAX_SPEED * boost;
      const maxThrust = BASE_MAX_THRUST * Math.sqrt(boost);

      if (k.has("w")) inputDir.current.add(forward.current);
      if (k.has("s")) inputDir.current.sub(forward.current);
      if (k.has("d")) inputDir.current.add(right.current);
      if (k.has("a")) inputDir.current.sub(right.current);
      if (k.has("shift")) inputDir.current.sub(up.current);

      const hasInput = inputDir.current.lengthSq() > 0;

      if (hasInput) {
        inputDir.current.normalize().multiplyScalar(maxThrust);
        target.copy(inputDir.current);
        responseRate = THRUST_RESPONSE;
      } else if (vel.lengthSq() > STOP_THRESHOLD * STOP_THRESHOLD) {
        applyCoastDrag(vel, accel, dt);
        newSpeed = vel.length();
        kmPerSec = unitsPerSecToKmPerSec(newSpeed);
        intensity = THREE.MathUtils.lerp(
          lightspeedSpool.current,
          0,
          1 - Math.exp(-6 * dt),
        );
        lightspeedSpool.current = intensity;
        resetLightspeedState();
        flightRef.current.lightspeedActive = false;
        flightRef.current.lightspeedIntensity = 0;
        responseRate = 0;
      } else {
        target.set(0, 0, 0);
        vel.set(0, 0, 0);
      }

      if (responseRate > 0) {
        const blend = 1 - Math.exp(-responseRate * dt);
        accel.lerp(target, blend);
        vel.addScaledVector(accel, dt);

        newSpeed = vel.length();
        if (newSpeed > maxSpeed) {
          vel.multiplyScalar(maxSpeed / newSpeed);
          newSpeed = maxSpeed;
        }
        if (!hasInput && newSpeed < STOP_THRESHOLD) {
          vel.set(0, 0, 0);
          accel.set(0, 0, 0);
          newSpeed = 0;
        }

        kmPerSec = unitsPerSecToKmPerSec(newSpeed);
        intensity = THREE.MathUtils.lerp(
          lightspeedSpool.current,
          0,
          1 - Math.exp(-6 * dt),
        );
        lightspeedSpool.current = intensity;

        resetLightspeedState();
        flightRef.current.lightspeedActive = false;
        flightRef.current.lightspeedIntensity = 0;
      }
    }

    viewerPosition.addScaledVector(vel, dt);

    applyCameraAngles(camera, yawRef.current, pitchRef.current);

    const thrusting =
      (warpEngaged ||
        (braking && vel.lengthSq() > STOP_THRESHOLD * STOP_THRESHOLD) ||
        inputDir.current.lengthSq() > 0) &&
      (pointerLocked || mobileFlight);
    const targetThrottle = warpEngaged
      ? 0.5 + intensity * 0.5
      : thrusting
        ? Math.min(
            1,
            accel.length() /
              (BASE_MAX_THRUST * Math.sqrt(travelSpeedRef.current)),
          )
        : 0;
    throttleSmoothed.current = THREE.MathUtils.lerp(
      throttleSmoothed.current,
      targetThrottle,
      1 - Math.exp(-4 * dt),
    );

    flightRef.current.velocity.copy(vel);
    flightRef.current.acceleration.copy(accel);
    flightRef.current.thrusting = thrusting;
    flightRef.current.throttle = throttleSmoothed.current;
    flightRef.current.speed = newSpeed;
    flightRef.current.speedKmPerSec = kmPerSec;

    speedReport.current += dt;
    if (speedReport.current > 0.08) {
      setDisplaySpeedKmPerSec(kmPerSec);
      if (warpEngaged && newSpeed >= LIGHTSPEED_MAX * 0.95) {
        setDisplayLightspeedMultiple(lightspeedMultiple(newSpeed));
      } else if (!warpEngaged) {
        setDisplayLightspeedMultiple(0);
      }
      speedReport.current = 0;
    }

    lightspeedReport.current += dt;
    if (lightspeedReport.current > 0.05) {
      setLightspeedIntensity(intensity);
      setLightspeedActive(warpEngaged || intensity > 0.02);
      lightspeedReport.current = 0;
    }

    const cam = camera as THREE.PerspectiveCamera;
    if ("fov" in cam) {
      const targetFov =
        warpEngaged || intensity > 0.02
          ? warpTargetFov(newSpeed, ludicrousBoost)
          : BASE_FOV;
      cam.fov = THREE.MathUtils.lerp(cam.fov, targetFov, 1 - Math.exp(-4 * dt));
      cam.updateProjectionMatrix();
    }
  });

  return null;
}
