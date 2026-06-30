"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useExplorer } from "@/context/ExplorerContext";
import {
  arcminToPixelSize,
  CELESTIAL_SPHERE_RADIUS,
  magnitudeToPixelSize,
  parseDsoArcmin,
} from "@/lib/astronomy/scale";
import { getCelestialSphereScale } from "@/lib/coordinates/frame";
import { createInstancedCircularSpriteMaterial } from "@/lib/materials/circularSprite";
import {
  bvToColor,
  magnitudeToBrightness,
  raDecToVector3,
} from "@/lib/celestial/coordinates";
import { RENDER_FRAME_PRIORITY } from "@/lib/renderFramePriority";
import { assetUrl } from "@/lib/assetUrl";

interface StarFeature {
  type: "Feature";
  properties: { mag: number; bv: string | number };
  geometry: { type: "Point"; coordinates: [number, number] };
}

interface ConstellationFeature {
  type: "Feature";
  id: string;
  geometry: {
    type: "MultiLineString";
    coordinates: [number, number][][];
  };
}

interface DsoFeature {
  type: "Feature";
  id: string;
  properties: {
    desig?: string;
    type?: string;
    mag?: number;
    dim?: string;
  };
  geometry: { type: "Point"; coordinates: [number, number] };
}

interface GeoCollection<T> {
  features: T[];
}

const DSO_COLORS: Record<string, string> = {
  gg: "#c8d4ff",
  g: "#b8c8ff",
  oc: "#9ec4ff",
  gc: "#ffd4a8",
  pn: "#88ffee",
  sfr: "#ff99cc",
  bn: "#5544aa",
  snr: "#ffa066",
  sd: "#d0e0ff",
  i: "#c0d8ff",
  en: "#ff88cc",
  rn: "#6688ff",
};

function buildStarGeometry(stars: StarFeature[]) {
  const count = stars.length;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  const tmp = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const [ra, dec] = stars[i].geometry.coordinates;
    const mag = stars[i].properties.mag;
    const bv = Number(stars[i].properties.bv);

    raDecToVector3(ra, dec, CELESTIAL_SPHERE_RADIUS, new THREE.Vector3()).toArray(
      positions,
      i * 3,
    );
    sizes[i] = magnitudeToPixelSize(mag);
    const brightness = magnitudeToBrightness(mag);
    bvToColor(Number.isFinite(bv) ? bv : 0.6, tmp).multiplyScalar(brightness);
    tmp.toArray(colors, i * 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  return geometry;
}

function buildConstellationGeometry(lines: ConstellationFeature[]) {
  const segments: number[] = [];

  for (const feature of lines) {
    for (const line of feature.geometry.coordinates) {
      for (let i = 0; i < line.length - 1; i++) {
        const a = line[i];
        const b = line[i + 1];
        const va = raDecToVector3(a[0], a[1], CELESTIAL_SPHERE_RADIUS);
        const vb = raDecToVector3(b[0], b[1], CELESTIAL_SPHERE_RADIUS);
        segments.push(va.x, va.y, va.z, vb.x, vb.y, vb.z);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(segments, 3),
  );
  return geometry;
}

function buildDsoGeometry(objects: DsoFeature[]) {
  const count = objects.length;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  const tmp = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const f = objects[i];
    const [ra, dec] = f.geometry.coordinates;
    raDecToVector3(ra, dec, CELESTIAL_SPHERE_RADIUS, new THREE.Vector3()).toArray(
      positions,
      i * 3,
    );
    const arcmin = parseDsoArcmin(f.properties.dim);
    sizes[i] = arcminToPixelSize(arcmin);
    const type = f.properties.type ?? "oc";
    tmp.set(DSO_COLORS[type] ?? "#aabbee");
    if (f.properties.mag != null && f.properties.mag < 900) {
      tmp.multiplyScalar(magnitudeToBrightness(f.properties.mag));
    }
    tmp.toArray(colors, i * 3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
  return geometry;
}

function TrueScaleStars({ geometry }: { geometry: THREE.BufferGeometry }) {
  const mat = useMemo(() => createInstancedCircularSpriteMaterial(), []);

  return (
    <points geometry={geometry} material={mat} renderOrder={-2} frustumCulled={false} />
  );
}

function ConstellationLines({ geometry }: { geometry: THREE.BufferGeometry }) {
  return (
    <lineSegments geometry={geometry} renderOrder={-1} frustumCulled={false}>
      <lineBasicMaterial
        color="#6a8fc7"
        transparent
        opacity={0.32}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}

function DeepSkyObjects({ geometry }: { geometry: THREE.BufferGeometry }) {
  const mat = useMemo(
    () => createInstancedCircularSpriteMaterial({ alphaScale: 0.55 }),
    [],
  );

  return (
    <points geometry={geometry} material={mat} renderOrder={0} frustumCulled={false} />
  );
}

export function CelestialSky() {
  const { showConstellations } = useExplorer();
  const [catalog, setCatalog] = useState<{
    stars: THREE.BufferGeometry;
    lines: THREE.BufferGeometry;
    dsos: THREE.BufferGeometry;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [starsRes, linesRes, dsosRes] = await Promise.all([
        fetch(assetUrl("/data/stars.6.json")),
        fetch(assetUrl("/data/constellations.lines.json")),
        fetch(assetUrl("/data/dsos.bright.json")),
      ]);
      if (!starsRes.ok || !linesRes.ok) return;

      const starsJson = (await starsRes.json()) as GeoCollection<StarFeature>;
      const linesJson =
        (await linesRes.json()) as GeoCollection<ConstellationFeature>;
      const dsosJson = dsosRes.ok
        ? ((await dsosRes.json()) as GeoCollection<DsoFeature>)
        : { features: [] };

      if (cancelled) return;

      setCatalog({
        stars: buildStarGeometry(starsJson.features),
        lines: buildConstellationGeometry(linesJson.features),
        dsos: buildDsoGeometry(dsosJson.features),
      });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      catalog?.stars.dispose();
      catalog?.lines.dispose();
      catalog?.dsos.dispose();
    };
  }, [catalog]);

  const scaleRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!scaleRef.current) return;
    const scale = getCelestialSphereScale();
    scaleRef.current.scale.setScalar(scale);
  }, RENDER_FRAME_PRIORITY.bodies);

  return (
    <group ref={scaleRef}>
      {catalog && (
        <>
          <TrueScaleStars geometry={catalog.stars} />
          {showConstellations && (
            <ConstellationLines geometry={catalog.lines} />
          )}
          <DeepSkyObjects geometry={catalog.dsos} />
        </>
      )}
    </group>
  );
}
