import * as THREE from "three";
import {
  LIGHTSPEED_MAX,
  lightspeedIntensity,
} from "@/lib/lightspeed";

export const BASE_MAX_SPEED = 0.22;
export const BASE_MAX_THRUST = 0.028;
export const LINEAR_DRAG = 0.18;
export const THRUST_RESPONSE = 2.8;
export const COAST_RESPONSE = 1.5;
export const STOP_THRESHOLD = 0.000005;
/** Exponential coast-down when keys released (1/s). */
export const COAST_DRAG = 2.8;
/** Exponential full stop on spacebar (1/s), scaled by travel speed in applyFullBrake. */
export const BRAKE_STOP_RATE = 11;

const _target = new THREE.Vector3();
const _drag = new THREE.Vector3();

/** Spacebar brake — kills all velocity, ignoring thrust inputs. */
export function applyFullBrake(
  vel: THREE.Vector3,
  accel: THREE.Vector3,
  dt: number,
  travelSpeed: number,
): void {
  const speed = vel.length();
  if (speed <= STOP_THRESHOLD) {
    vel.set(0, 0, 0);
    accel.set(0, 0, 0);
    return;
  }

  const rate =
    BRAKE_STOP_RATE * Math.sqrt(Math.max(1, travelSpeed / 40));
  const nextSpeed = speed * Math.exp(-rate * dt);

  if (nextSpeed <= STOP_THRESHOLD) {
    vel.set(0, 0, 0);
    accel.set(0, 0, 0);
    return;
  }

  _drag.copy(vel).normalize();
  vel.copy(_drag).multiplyScalar(nextSpeed);
  accel.copy(_drag).multiplyScalar(-(speed - nextSpeed) / Math.max(dt, 1e-6));
}

/** Passive slowdown when no thrust input. */
export function applyCoastDrag(
  vel: THREE.Vector3,
  accel: THREE.Vector3,
  dt: number,
): void {
  const speed = vel.length();
  if (speed <= STOP_THRESHOLD) {
    vel.set(0, 0, 0);
    accel.set(0, 0, 0);
    return;
  }

  const nextSpeed = speed * Math.exp(-COAST_DRAG * dt);
  if (nextSpeed <= STOP_THRESHOLD) {
    vel.set(0, 0, 0);
    accel.set(0, 0, 0);
    return;
  }

  vel.multiplyScalar(nextSpeed / speed);
  accel.set(0, 0, 0);
}

export function steerToward(
  yaw: { current: number },
  pitch: { current: number },
  from: THREE.Vector3,
  to: THREE.Vector3,
  dt: number,
  rate = 2.8,
): void {
  _target.subVectors(to, from);
  if (_target.lengthSq() < 1e-6) return;
  _target.normalize();

  const targetYaw = Math.atan2(-_target.x, -_target.z);
  const targetPitch = Math.asin(
    THREE.MathUtils.clamp(_target.y, -1, 1),
  );

  let dyaw = targetYaw - yaw.current;
  while (dyaw > Math.PI) dyaw -= Math.PI * 2;
  while (dyaw < -Math.PI) dyaw += Math.PI * 2;

  const blend = 1 - Math.exp(-rate * dt);
  yaw.current += dyaw * blend;
  pitch.current = THREE.MathUtils.lerp(
    pitch.current,
    targetPitch,
    blend,
  );
  pitch.current = THREE.MathUtils.clamp(
    pitch.current,
    -Math.PI / 2 + 0.12,
    Math.PI / 2 - 0.12,
  );
}

/** Discovery cruise — softer acceleration for fluid interplanetary travel. */
export interface ThrustResult {
  speed: number;
  lightspeedActive: boolean;
  lightspeedIntensity: number;
  thrusting: boolean;
  throttle: number;
}

export function applyDiscoveryAutopilotThrust(
  vel: THREE.Vector3,
  accel: THREE.Vector3,
  thrustDir: THREE.Vector3,
  dt: number,
  travelSpeed: number,
  transitProgress: number,
  approachFactor = 1,
): ThrustResult {
  const dir = thrustDir.clone().normalize();
  const ease = THREE.MathUtils.smoothstep(transitProgress, 0.05, 0.92);
  const cruiseCap = BASE_MAX_SPEED * travelSpeed * (0.35 + 0.65 * ease);
  const maxSpeed = cruiseCap * THREE.MathUtils.clamp(approachFactor, 0.1, 1);
  const maxThrust =
    BASE_MAX_THRUST * Math.sqrt(travelSpeed) * (0.45 + 0.55 * ease) *
    THREE.MathUtils.lerp(0.35, 1, approachFactor);

  accel.copy(dir).multiplyScalar(maxThrust);

  const speedAlong = vel.dot(dir);
  let targetSpeed = Math.min(maxSpeed, speedAlong + maxThrust * dt);

  if (approachFactor < 0.45 && speedAlong > maxSpeed) {
    targetSpeed = THREE.MathUtils.lerp(speedAlong, maxSpeed, 1 - Math.exp(-6 * dt));
  }

  const blend = 1 - Math.exp(-THRUST_RESPONSE * 0.65 * dt);
  const nextAlong = THREE.MathUtils.lerp(speedAlong, targetSpeed, blend);

  const lateral = vel
    .clone()
    .sub(dir.clone().multiplyScalar(speedAlong))
    .multiplyScalar(Math.max(0, 1 - LINEAR_DRAG * dt * 1.2));

  vel.copy(dir).multiplyScalar(Math.max(0, nextAlong)).add(lateral);

  let speed = vel.length();
  if (speed > maxSpeed) {
    vel.multiplyScalar(maxSpeed / speed);
    speed = maxSpeed;
  }

  return {
    speed,
    lightspeedActive: false,
    lightspeedIntensity: 0,
    thrusting: maxThrust > 0.001,
    throttle: Math.min(1, speed / Math.max(maxSpeed, 0.001)),
  };
}

export function applyAutopilotThrust(
  vel: THREE.Vector3,
  accel: THREE.Vector3,
  thrustDir: THREE.Vector3,
  dt: number,
  travelSpeed: number,
  useLightspeed: boolean,
): ThrustResult {
  const dir = thrustDir.clone().normalize();

  if (useLightspeed) {
    const speedAlong = vel.dot(dir);
    const target = LIGHTSPEED_MAX;
    const next = THREE.MathUtils.lerp(
      speedAlong,
      target,
      1 - Math.exp(-4.5 * dt),
    );
    vel.copy(dir).multiplyScalar(Math.max(0, next));
    accel.copy(dir).multiplyScalar(0.05);
    const intensity = lightspeedIntensity(Math.abs(next));
    return {
      speed: Math.abs(next),
      lightspeedActive: true,
      lightspeedIntensity: intensity,
      thrusting: true,
      throttle: 0.5 + intensity * 0.5,
    };
  }

  const maxSpeed = BASE_MAX_SPEED * travelSpeed;
  const maxThrust = BASE_MAX_THRUST * Math.sqrt(travelSpeed);
  accel.copy(dir).multiplyScalar(maxThrust);

  const speedAlong = vel.dot(dir);
  const targetSpeed = Math.min(maxSpeed, speedAlong + maxThrust * dt);
  const blend = 1 - Math.exp(-THRUST_RESPONSE * dt);
  const nextAlong = THREE.MathUtils.lerp(speedAlong, targetSpeed, blend);

  const lateral = vel
    .clone()
    .sub(dir.clone().multiplyScalar(speedAlong))
    .multiplyScalar(Math.max(0, 1 - LINEAR_DRAG * dt));

  vel.copy(dir).multiplyScalar(Math.max(0, nextAlong)).add(lateral);

  let speed = vel.length();
  if (speed > maxSpeed) {
    vel.multiplyScalar(maxSpeed / speed);
    speed = maxSpeed;
  }

  return {
    speed,
    lightspeedActive: false,
    lightspeedIntensity: 0,
    thrusting: true,
    throttle: Math.min(1, speed / Math.max(maxSpeed, 0.001)),
  };
}
