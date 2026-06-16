import type { NavTargetId } from "@/data/navigationTargets";
import { angularRadius } from "@/lib/astronomy/scale";
import * as THREE from "three";

const DEG = Math.PI / 180;

export type LabelOccluder = {
  id: NavTargetId;
  center: THREE.Vector3;
  radius: number;
};

const occluders = new Map<NavTargetId, LabelOccluder>();

const _origin = new THREE.Vector3(0, 0, 0);
const _rayDir = new THREE.Vector3();
const _oc = new THREE.Vector3();
const _labelNdc = new THREE.Vector3();
const _occNdc = new THREE.Vector3();
const _center = new THREE.Vector3();
const _scale = new THREE.Vector3();

function raySphereDistance(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  center: THREE.Vector3,
  radius: number,
): number | null {
  _oc.copy(origin).sub(center);
  const b = _oc.dot(direction);
  const c = _oc.lengthSq() - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t > 0 ? t : null;
}

export function upsertLabelOccluder(
  id: NavTargetId,
  center: THREE.Vector3,
  radius: number,
): void {
  let entry = occluders.get(id);
  if (!entry) {
    entry = { id, center: new THREE.Vector3(), radius: 0 };
    occluders.set(id, entry);
  }
  entry.center.copy(center);
  entry.radius = radius;
}

export function removeLabelOccluder(id: NavTargetId): void {
  occluders.delete(id);
}

/** Publish a body's world-space occlusion sphere (call each frame from body meshes). */
export function registerBodyOccluder(
  id: NavTargetId,
  bodyRoot: THREE.Object3D | null,
  renderRadius: number,
): void {
  if (!bodyRoot || renderRadius <= 0) {
    removeLabelOccluder(id);
    return;
  }
  bodyRoot.getWorldPosition(_center);
  bodyRoot.getWorldScale(_scale);
  upsertLabelOccluder(id, _center, renderRadius * _scale.x);
}

/**
 * True when another body's sphere blocks this label from the camera.
 * The owning body is never an occluder for its own label.
 */
export function isLabelOccluded(
  ownerId: NavTargetId,
  labelWorldPos: THREE.Vector3,
  camera: THREE.Camera,
  size: { width: number; height: number },
): boolean {
  const labelDistSq = labelWorldPos.lengthSq();
  if (labelDistSq < 1e-12) return false;
  const labelDist = Math.sqrt(labelDistSq);

  _rayDir.copy(labelWorldPos).multiplyScalar(1 / labelDist);

  const perspective = camera as THREE.PerspectiveCamera;
  const fovRad =
    "fov" in perspective ? perspective.fov * DEG : (60 * Math.PI) / 180;
  const aspect = size.height > 0 ? size.width / size.height : 1;

  for (const occluder of occluders.values()) {
    if (occluder.id === ownerId || occluder.radius <= 0) continue;

    const hit = raySphereDistance(
      _origin,
      _rayDir,
      occluder.center,
      occluder.radius * 1.03,
    );
    if (hit !== null && hit < labelDist - 1e-6) {
      return true;
    }

    const occDistSq = occluder.center.lengthSq();
    if (occDistSq >= labelDistSq) continue;

    _labelNdc.copy(labelWorldPos).project(camera);
    _occNdc.copy(occluder.center).project(camera);

    const occDist = Math.sqrt(occDistSq);
    const alpha = angularRadius(occluder.radius, occDist);
    const ndcRadiusY = (2 * alpha) / fovRad;
    const ndcRadiusX = ndcRadiusY / aspect;

    const dx = (_labelNdc.x - _occNdc.x) / Math.max(ndcRadiusX, 1e-6);
    const dy = (_labelNdc.y - _occNdc.y) / Math.max(ndcRadiusY, 1e-6);
    if (dx * dx + dy * dy <= 1.08 * 1.08) {
      return true;
    }
  }

  return false;
}
