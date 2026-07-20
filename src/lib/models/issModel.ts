import * as THREE from "three";
import { ISS } from "@/data/iss";
import {
  getTrackableEmissiveIntensity,
  getTrackableFocusDisplayScale,
} from "@/lib/trackableDisplay";

export function createIssMaterials() {
  const hull = new THREE.MeshStandardMaterial({
    color: ISS.hullColor,
    metalness: 0.78,
    roughness: 0.34,
    emissive: new THREE.Color("#7aa8d8"),
    emissiveIntensity: 0.08,
  });
  const module = new THREE.MeshStandardMaterial({
    color: ISS.moduleColor,
    metalness: 0.7,
    roughness: 0.4,
    emissive: new THREE.Color("#6a90b8"),
    emissiveIntensity: 0.06,
  });
  const panel = new THREE.MeshStandardMaterial({
    color: ISS.panelColor,
    metalness: 0.42,
    roughness: 0.48,
    emissive: new THREE.Color("#1a3058"),
    emissiveIntensity: 0.04,
  });
  const radiator = new THREE.MeshStandardMaterial({
    color: ISS.radiatorColor,
    metalness: 0.55,
    roughness: 0.42,
    emissive: new THREE.Color("#5a7898"),
    emissiveIntensity: 0.05,
  });
  const node = new THREE.MeshStandardMaterial({
    color: "#b8c8d8",
    metalness: 0.82,
    roughness: 0.28,
    emissive: new THREE.Color("#8aa8c8"),
    emissiveIntensity: 0.06,
  });
  return { hull, module, panel, radiator, node };
}

type IssMaterials = ReturnType<typeof createIssMaterials>;

export function updateIssMaterialsForFocus(
  materials: IssMaterials,
  focused: boolean,
  inEarthShadow: boolean,
): void {
  const intensity = getTrackableEmissiveIntensity(focused, inEarthShadow);
  for (const mat of Object.values(materials)) {
    mat.emissiveIntensity = intensity;
    mat.needsUpdate = true;
  }
}

function addBox(
  root: THREE.Group,
  material: THREE.Material,
  sx: number,
  sy: number,
  sz: number,
  x: number,
  y: number,
  z: number,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  root.add(mesh);
}

function addCylinder(
  root: THREE.Group,
  material: THREE.Material,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  x: number,
  y: number,
  z: number,
  rotZ = 0,
) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 20, 1),
    material,
  );
  mesh.position.set(x, y, z);
  mesh.rotation.z = rotZ;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  root.add(mesh);
}

/**
 * Normalized ISS truss model (x = truss axis, span ≈ 1.0 ≈ 109 m).
 * Scaled to true scene units via bounding radius in IssMesh.
 */
export function buildIssModelGroup(materials: IssMaterials): THREE.Group {
  const root = new THREE.Group();
  root.frustumCulled = false;
  const halfSpan = 0.5;

  addBox(root, materials.hull, 0.2, 0.038, 0.038, 0, 0, 0);
  addBox(root, materials.hull, 0.16, 0.032, 0.032, 0.18, 0, 0);
  addBox(root, materials.hull, 0.16, 0.032, 0.032, -0.18, 0, 0);

  addCylinder(root, materials.node, 0.028, 0.028, 0.05, 0.3, 0, 0);
  addCylinder(root, materials.node, 0.028, 0.028, 0.05, -0.3, 0, 0);

  addCylinder(root, materials.module, 0.021, 0.021, 0.1, 0.08, 0.022, 0, Math.PI / 2);
  addCylinder(root, materials.module, 0.019, 0.019, 0.075, -0.06, 0.02, 0, Math.PI / 2);
  addCylinder(root, materials.module, 0.017, 0.017, 0.055, 0.02, -0.02, 0, Math.PI / 2);
  addCylinder(root, materials.module, 0.016, 0.016, 0.04, -0.12, 0.018, 0, Math.PI / 2);

  addCylinder(root, materials.module, 0.012, 0.014, 0.018, 0.1, 0.03, 0.012);

  const wingSpan = 0.31;
  const wingHeight = 0.11;
  addBox(root, materials.hull, 0.02, 0.04, 0.02, 0.22, 0.075, 0);
  addBox(root, materials.hull, 0.02, 0.04, 0.02, 0.22, -0.075, 0);
  addBox(root, materials.hull, 0.02, 0.04, 0.02, -0.22, 0.075, 0);
  addBox(root, materials.hull, 0.02, 0.04, 0.02, -0.22, -0.075, 0);
  addBox(root, materials.panel, wingSpan, wingHeight, 0.0012, 0.22, 0.14, 0);
  addBox(root, materials.panel, wingSpan, wingHeight, 0.0012, 0.22, -0.14, 0);
  addBox(root, materials.panel, wingSpan, wingHeight, 0.0012, -0.22, 0.14, 0);
  addBox(root, materials.panel, wingSpan, wingHeight, 0.0012, -0.22, -0.14, 0);

  addBox(root, materials.radiator, 0.13, 0.055, 0.0008, 0.11, 0.058, 0.02);
  addBox(root, materials.radiator, 0.13, 0.055, 0.0008, 0.11, -0.058, 0.02);

  addCylinder(root, materials.node, 0.012, 0.015, 0.03, halfSpan - 0.02, 0, 0);
  addCylinder(root, materials.node, 0.012, 0.015, 0.03, -(halfSpan - 0.02), 0, 0);

  root.traverse((child) => {
    child.frustumCulled = false;
  });

  return root;
}

/** Map normalized model units to scene bounding radius. */
export function issModelToSceneScale(): number {
  return ISS.boundingRadius / 0.5;
}

export function getIssMeshDisplayScale(
  renderRadius: number,
  boundingRadius: number,
  angularPx: number,
  focused: boolean,
): number {
  return getTrackableFocusDisplayScale(
    renderRadius,
    boundingRadius,
    angularPx,
    focused,
  );
}
