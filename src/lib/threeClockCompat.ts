import * as THREE from "three";
import { OrbitClock } from "./orbitClock";

const MARKER = "__orbitClockCompat";

function clockAlreadyPatched(): boolean {
  return Boolean(
    (THREE.Clock as unknown as Record<string, boolean | undefined>)[MARKER],
  );
}

function canAssignThreeClock(): boolean {
  const desc = Object.getOwnPropertyDescriptor(
    THREE as unknown as object,
    "Clock",
  );
  if (!desc) return true;
  return Boolean(desc.writable || desc.set);
}

/**
 * R3F v9 still constructs THREE.Clock, which logs a deprecation warning in
 * three.js r183+. Use a drop-in replacement until we adopt R3F v10.
 *
 * In the packaged extension, `three` is aliased to `threeExtensionShim` at
 * build time so this patch is not needed (and would throw on a read-only export).
 */
export function installThreeClockCompat(): void {
  if (typeof window === "undefined") return;
  if (clockAlreadyPatched()) return;
  if (!canAssignThreeClock()) return;

  (OrbitClock as unknown as Record<string, boolean>)[MARKER] = true;

  try {
    const threeNamespace = THREE as unknown as Record<string, unknown>;
    threeNamespace.Clock = OrbitClock;
  } catch {
    // Namespace can be read-only in some bundlers.
  }
}
