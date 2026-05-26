import * as THREE from "three";

/** Soft circular screen-space point sprite (replaces square WebGL points). */
export function createCircularSpriteMaterial(options?: {
  opacity?: number;
  additive?: boolean;
  depthWrite?: boolean;
  sizeAttenuation?: boolean;
}) {
  const {
    opacity = 0.85,
    additive = false,
    depthWrite = false,
    sizeAttenuation = false,
  } = options ?? {};

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uSize: { value: 6 },
      uColor: { value: new THREE.Color("#ffffff") },
      uOpacity: { value: opacity },
      uSizeAttenuation: { value: sizeAttenuation ? 1 : 0 },
    },
    vertexShader: `
      uniform float uSize;
      uniform float uSizeAttenuation;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float px = uSize;
        if (uSizeAttenuation > 0.5) {
          px = uSize * (300.0 / max(-mv.z, 1.0));
        }
        gl_PointSize = clamp(px, 1.0, 128.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float core = smoothstep(0.5, 0.08, d);
        float glow = smoothstep(0.5, 0.0, d);
        float alpha = mix(core, glow, 0.35) * uOpacity;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
}

/** Instanced stars / DSOs with per-vertex size and color attributes. */
export function createInstancedCircularSpriteMaterial(options?: {
  additive?: boolean;
  alphaScale?: number;
}) {
  const { additive = true, alphaScale = 1 } = options ?? {};

  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uAlphaScale: { value: alphaScale },
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(size, 1.0, 128.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform float uAlphaScale;
      varying vec3 vColor;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float core = smoothstep(0.5, 0.1, d);
        float glow = smoothstep(0.5, 0.0, d);
        float alpha = mix(core, glow, 0.25) * uAlphaScale;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
  });
}
