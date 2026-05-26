import * as THREE from "three";

/**
 * Mask Earth city lights to the night hemisphere relative to the Sun.
 */
export function applyEarthDayNightShader(
  material: THREE.MeshStandardMaterial,
  sunDirection: THREE.Vector3,
) {
  if (material.userData.dayNightApplied) return;
  material.userData.dayNightApplied = true;
  const sunDirUniform = { value: sunDirection.clone() };
  material.userData.sunDirUniform = sunDirUniform;

  const previousCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile?.call(material, shader, renderer);
    shader.uniforms.sunDirection = sunDirUniform;

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
uniform vec3 sunDirection;`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
      float sunDot = dot(normalize(vNormal), normalize(sunDirection));
      float night = 1.0 - smoothstep(-0.08, 0.18, sunDot);
      totalEmissiveRadiance *= night;`,
    );
  };

  const baseKey = material.customProgramCacheKey?.() ?? "";
  material.customProgramCacheKey = () => `earth-day-night-${baseKey}`;
  material.needsUpdate = true;
}

export function updateEarthSunDirection(
  material: THREE.MeshStandardMaterial,
  sunDirection: THREE.Vector3,
) {
  const uniform = material.userData.sunDirUniform as
    | { value: THREE.Vector3 }
    | undefined;
  if (uniform) uniform.value.copy(sunDirection);
}
