import * as THREE from "three";

export type ApproachPlanetUniforms = {
  approachMapNext: { value: THREE.Texture };
  approachBlend: { value: number };
};

export function applyApproachPlanetShader(
  material: THREE.MeshStandardMaterial,
  nextMap: THREE.Texture,
): ApproachPlanetUniforms {
  if (material.userData.approachApplied) {
    return material.userData.approachUniforms as ApproachPlanetUniforms;
  }

  material.userData.approachApplied = true;
  const uniforms: ApproachPlanetUniforms = {
    approachMapNext: { value: nextMap },
    approachBlend: { value: 0 },
  };
  material.userData.approachUniforms = uniforms;

  const previousCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previousCompile?.call(material, shader, renderer);

    shader.uniforms.approachMapNext = uniforms.approachMapNext;
    shader.uniforms.approachBlend = uniforms.approachBlend;

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
uniform sampler2D approachMapNext;
uniform float approachBlend;`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <map_fragment>",
      `#include <map_fragment>
#ifdef USE_MAP
  vec4 approachTexel = texture2D( approachMapNext, vMapUv );
  diffuseColor.rgb = mix( diffuseColor.rgb, approachTexel.rgb, approachBlend * approachTexel.a );
#endif`,
    );
  };

  const baseKey = material.customProgramCacheKey?.() ?? "";
  material.customProgramCacheKey = () => `planet-approach-blend-${baseKey}`;
  material.needsUpdate = true;
  return uniforms;
}

export function updateApproachPlanetUniforms(
  material: THREE.MeshStandardMaterial,
  nextMap: THREE.Texture,
  blend: number,
): void {
  const uniforms = material.userData.approachUniforms as
    | ApproachPlanetUniforms
    | undefined;
  if (!uniforms) return;
  uniforms.approachMapNext.value = nextMap;
  uniforms.approachBlend.value = THREE.MathUtils.clamp(blend, 0, 1);
}
