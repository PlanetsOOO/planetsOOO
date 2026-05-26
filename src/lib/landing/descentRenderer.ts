import * as THREE from "three";
import {
  altitudeKmToTileZoom,
  loadStitchedTileCanvas,
} from "@/lib/earth/tileImagery";
import { loadStitchedHeightField } from "@/lib/earth/terrainImagery";
import {
  buildLandingCell,
  LANDING_TILE_GRID,
  type LandingCell,
} from "@/lib/landing/locationCell";

export type DescentRenderTarget = {
  lat: number;
  lon: number;
  altitudeKm: number;
};

export type DescentRenderResult = {
  blob: Blob;
  cell: LandingCell;
  durationSec: number;
};

const DURATION_SEC = 12;
const SEGMENTS = 128;

/** Meters per pixel at equator for WebMercator zoom. */
function metersPerPixel(zoom: number, lat: number): number {
  return (156_543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

export async function renderSatelliteDescentVideo(
  canvas: HTMLCanvasElement,
  target: DescentRenderTarget,
): Promise<DescentRenderResult> {
  const zoom = Math.max(
    altitudeKmToTileZoom(target.altitudeKm),
    9,
  );
  const cell = buildLandingCell("earth", target.lat, target.lon, zoom);

  const [colorCanvas, heights] = await Promise.all([
    loadStitchedTileCanvas(cell.tileX, cell.tileY, cell.zoom, LANDING_TILE_GRID),
    loadStitchedHeightField(cell.tileX, cell.tileY, cell.zoom, LANDING_TILE_GRID),
  ]);

  const gridPx = colorCanvas.width;
  const mpp = metersPerPixel(cell.zoom, target.lat);
  const spanM = gridPx * mpp;

  const colorTex = new THREE.CanvasTexture(colorCanvas);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.ClampToEdgeWrapping;
  colorTex.wrapT = THREE.ClampToEdgeWrapping;

  const geometry = new THREE.PlaneGeometry(spanM, spanM, SEGMENTS, SEGMENTS);
  geometry.rotateX(-Math.PI / 2);

  const pos = geometry.attributes.position as THREE.BufferAttribute;
  const half = spanM / 2;
  const dispScale = THREE.MathUtils.lerp(2.5, 1, Math.min(target.altitudeKm / 120, 1));

  for (let i = 0; i < pos.count; i += 1) {
    const lx = pos.getX(i) + half;
    const lz = pos.getZ(i) + half;
    const u = THREE.MathUtils.clamp(lx / spanM, 0, 1);
    const v = THREE.MathUtils.clamp(lz / spanM, 0, 1);
    const px = Math.floor(u * (gridPx - 1));
    const py = Math.floor(v * (gridPx - 1));
    const h = heights[py * gridPx + px] ?? 0;
    pos.setY(i, Math.max(0, h * dispScale));
  }
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    map: colorTex,
    roughness: 0.92,
    metalness: 0.02,
  });
  const terrain = new THREE.Mesh(geometry, material);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02060e);
  scene.fog = new THREE.FogExp2(0x5a8ec0, 0.000018);
  scene.add(terrain);

  const sun = new THREE.DirectionalLight(0xfff4e8, 1.35);
  sun.position.set(spanM * 0.4, spanM * 0.8, spanM * 0.25);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x6a8ab8, 0.45));

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth || 1280, canvas.clientHeight || 720, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const camera = new THREE.PerspectiveCamera(
    55,
    (canvas.clientWidth || 1280) / (canvas.clientHeight || 720),
    1,
    spanM * 20,
  );

  const blob = await recordDescentAnimation(
    renderer,
    scene,
    camera,
    spanM,
    target.altitudeKm,
  );

  geometry.dispose();
  material.dispose();
  colorTex.dispose();
  renderer.dispose();

  return { blob, cell, durationSec: DURATION_SEC };
}

async function recordDescentAnimation(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  spanM: number,
  altitudeKm: number,
): Promise<Blob> {
  const canvas = renderer.domElement;
  const stream = canvas.captureStream(30);
  const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = () => reject(new Error("Recording failed"));
  });

  recorder.start(200);

  const startAlt = Math.max(altitudeKm * 1000, spanM * 0.35);
  const endAlt = Math.max(spanM * 0.004, 120);
  const start = performance.now();

  await new Promise<void>((resolve) => {
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (DURATION_SEC * 1000));
      const eased = 1 - (1 - t) ** 2.2;
      const alt = THREE.MathUtils.lerp(startAlt, endAlt, eased);
      const dist = alt / Math.tan((55 * Math.PI) / 360);

      camera.position.set(0, alt, dist * 0.7);
      camera.lookAt(0, 0, 0);

      const fog = scene.fog as THREE.FogExp2;
      fog.density = THREE.MathUtils.lerp(0.00004, 0.000008, eased);

      renderer.render(scene, camera);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });

  recorder.stop();
  return done;
}

/** Play a cached landing clip on a video element (no recording). */
export function playLandingVideo(video: HTMLVideoElement, url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    video.src = url;
    video.onended = () => resolve();
    video.onerror = () => reject(new Error("Video playback failed"));
    void video.play().catch(reject);
  });
}
