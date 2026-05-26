"use client";

import { useRef } from "react";
import * as THREE from "three";

export interface FlightState {
  velocity: THREE.Vector3;
  acceleration: THREE.Vector3;
  thrusting: boolean;
  throttle: number;
  /** Scene units per second */
  speed: number;
  /** km/s */
  speedKmPerSec: number;
  /** 0–1 lightspeed spool */
  lightspeedIntensity: number;
  lightspeedActive: boolean;
}

export function useFlightStateRef() {
  return useRef<FlightState>({
    velocity: new THREE.Vector3(),
    acceleration: new THREE.Vector3(),
    thrusting: false,
    throttle: 0,
    speed: 0,
    speedKmPerSec: 0,
    lightspeedIntensity: 0,
    lightspeedActive: false,
  });
}
