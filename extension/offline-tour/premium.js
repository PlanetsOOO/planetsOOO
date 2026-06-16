import * as THREE from "three";
import { PLANETS } from "@/data/planets";
import { C_KM_S, C_UNITS_PER_S } from "@/lib/astronomy/constants";
import { getHeliocentricPosition } from "@/lib/astronomy/ephemeris";
import { LUDICROUS_SPEED_MULTIPLIER } from "@/lib/lightspeed";
import { SUN_DISPLAY_RADIUS_SCALE } from "@/lib/astronomy/scale";

/**
 * Premium offline scenic tour.
 *
 * Unlike the basic offline tour (one planet at a time at the origin), this scene
 * reuses the exact same simulation the web app uses: real J2000 Keplerian
 * positions from `@/lib/astronomy/ephemeris` at the app's true scale
 * (1 unit = 1,000 km). The camera flies between the real heliocentric positions
 * of the planets, conveying genuine interplanetary distance and speed, then
 * orbits each body up close. Premium users can drop into manual flight at any
 * time. A floating origin keeps the focused body at full float precision despite
 * the millions-of-units span of the real solar system.
 */

const KM_PER_UNIT = 1000;

const POINTER_NOISE_EPSILON = 2;
const WHEEL_NOISE_EPSILON = 1;

const OBSERVE_SEC = 17;
const TRANSIT_SEC = 9;
const FOCUS_RADIUS_SCALE = 3.4;
const OBSERVE_ANGULAR_SPEED = 0.07;
const SIM_TIME_SCALE = 1800;

const FLIGHT_IDLE_RETURN_MS = 15000;
const FLIGHT_MOUSE_SENSITIVITY = 0.0024;
const FLIGHT_BASE_SPEED = 6;
const FLIGHT_LIGHTSPEED = C_UNITS_PER_S;
const FLIGHT_LUDICROUS_SPEED = C_UNITS_PER_S * LUDICROUS_SPEED_MULTIPLIER;
const LIGHTSPEED_C_THRESHOLD = 0.5;
const LUDICROUS_C_THRESHOLD = 12;

const params = new URLSearchParams(window.location.search);
const flightKey = params.get("flightKey") || "Backquote";
const exitKey = params.get("exitKey") || flightKey;
const flightEnabled = params.get("flight") !== "0";

const root = document.getElementById("threeRoot");
const fadeOverlay = document.getElementById("fadeOverlay");
const offlineFlightMessage = document.getElementById("offlineFlightMessage");
const offlineFlightHud = document.getElementById("offlineFlightHud");
const offlineFlightHudHeading = document.getElementById("offlineFlightHudHeading");
const offlineFlightHudValue = document.getElementById("offlineFlightHudValue");
const bodyLabel = document.getElementById("offlineBodyLabel");

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  5e7,
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
  logarithmicDepthBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
root.append(renderer.domElement);

const textureLoader = new THREE.TextureLoader();
const textures = new Map();

const sunLight = new THREE.PointLight(0xfff3da, 3.2, 0, 0);
scene.add(sunLight);
scene.add(new THREE.AmbientLight(0x32405a, 0.16));
const fillLight = new THREE.HemisphereLight(0x2a3a5a, 0x05070d, 0.18);
scene.add(fillLight);

// --- Reusable vectors -------------------------------------------------------
const viewerReal = new THREE.Vector3();
const prevViewerReal = new THREE.Vector3();
const transitStartReal = new THREE.Vector3();
const targetReal = new THREE.Vector3();
const focusReal = new THREE.Vector3();
const lookRender = new THREE.Vector3();
const tmpOffset = new THREE.Vector3();
const tmpVec = new THREE.Vector3();
const ephem = { x: 0, y: 0, z: 0 };

const flightForward = new THREE.Vector3();
const flightRight = new THREE.Vector3();
const flightDirection = new THREE.Vector3();
const flightVelocity = new THREE.Vector3();
const flightUp = new THREE.Vector3(0, 1, 0);

// --- Simulation clock -------------------------------------------------------
const simEpochMs = Date.now();
let simMs = 0;
const simDate = new Date(simEpochMs);

// --- Tour state -------------------------------------------------------------
const SUN_INDEX = PLANETS.findIndex((p) => p.id === "sun");
let bodies = [];
let focusIndex = Math.floor(Math.random() * PLANETS.length);
let nextIndex = focusIndex;
let phase = "observe";
let phaseElapsed = 0;
let observeAngle = Math.random() * Math.PI * 2;
let entryAngle = 0;

let previousFrameMs = performance.now();
let offlineFlightMessageTimer = null;
let offlineFlightHudVisible = false;
let labelHidden = false;
let flightActive = false;
let flightIdleTimer = null;
let flightYaw = 0;
let flightPitch = 0;
const pressedKeys = new Set();

function displayRadius(planet) {
  return planet.id === "sun"
    ? planet.radius * SUN_DISPLAY_RADIUS_SCALE
    : planet.radius;
}

function focusViewDistance(planet) {
  return displayRadius(planet) * FOCUS_RADIUS_SCALE;
}

function loadTexture(path) {
  if (textures.has(path)) return textures.get(path);
  const texture = textureLoader.load(path);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  textures.set(path, texture);
  return texture;
}

function texturePath(webPath) {
  return webPath.replace(/^\//, "");
}

function makeSunGlow(radius) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, "rgba(255,240,205,0.95)");
  gradient.addColorStop(0.25, "rgba(255,205,120,0.55)");
  gradient.addColorStop(0.6, "rgba(255,150,60,0.18)");
  gradient.addColorStop(1, "rgba(255,140,40,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    }),
  );
  sprite.scale.setScalar(radius * 4.2);
  return sprite;
}

function spinRate(planet) {
  const retrograde = planet.id === "venus" || planet.id === "uranus";
  return (retrograde ? -1 : 1) * 0.05;
}

function createBody(planet) {
  const radius = displayRadius(planet);
  const group = new THREE.Group();
  const map = loadTexture(texturePath(planet.texture));

  const material =
    planet.id === "sun"
      ? new THREE.MeshBasicMaterial({ map, color: new THREE.Color(planet.color) })
      : new THREE.MeshStandardMaterial({
          map,
          color: 0xffffff,
          roughness: 0.96,
          metalness: 0.0,
        });

  const segments = planet.id === "sun" ? 96 : 72;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, segments, segments),
    material,
  );
  mesh.rotation.z = planet.tilt || 0;
  group.add(mesh);

  let clouds = null;
  if (planet.clouds) {
    clouds = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.012, 72, 72),
      new THREE.MeshStandardMaterial({
        map: loadTexture(texturePath(planet.clouds)),
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      }),
    );
    mesh.add(clouds);
  }

  if (planet.ringTexture) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius * 1.32, radius * 2.32, 128),
      new THREE.MeshBasicMaterial({
        map: loadTexture(texturePath(planet.ringTexture)),
        transparent: true,
        alphaTest: 0.02,
        opacity: 0.86,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = Math.PI / 2.35;
    ring.rotation.y = -0.2;
    group.add(ring);
  }

  if (planet.id === "sun") {
    group.add(makeSunGlow(radius));
  }

  scene.add(group);
  return {
    planet,
    group,
    mesh,
    clouds,
    radius,
    spin: spinRate(planet),
    realPos: new THREE.Vector3(),
  };
}

function buildBodies() {
  bodies = PLANETS.map(createBody);
}

function makeStars() {
  const count = 3200;
  const radius = 6_000_000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const r = radius * (0.85 + Math.random() * 0.15);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.cos(phi) * r;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;

    const tint = 0.72 + Math.random() * 0.28;
    colors[i * 3] = tint * 0.82;
    colors[i * 3 + 1] = tint * 0.86;
    colors[i * 3 + 2] = tint;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 1.7,
    sizeAttenuation: false,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const stars = new THREE.Points(geometry, material);
  stars.frustumCulled = false;
  scene.add(stars);
}

function bodyRealPosition(planet, date, out) {
  getHeliocentricPosition(planet.id, 0, date, ephem);
  return out.set(ephem.x, ephem.y, ephem.z);
}

/** Orbit offset around a body (in real scene units), in its local ecliptic plane. */
function orbitOffset(planet, angle, out) {
  const d = focusViewDistance(planet);
  return out.set(
    Math.cos(angle) * d,
    d * 0.17 + displayRadius(planet) * 0.05,
    Math.sin(angle) * d,
  );
}

function smoothstep(t) {
  const c = THREE.MathUtils.clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

function pickNextIndex(current) {
  if (PLANETS.length <= 1) return current;
  let candidate = current;
  while (candidate === current) {
    candidate = Math.floor(Math.random() * PLANETS.length);
  }
  return candidate;
}

// --- Label ------------------------------------------------------------------
function setBodyLabel(text, visible) {
  if (!bodyLabel) return;
  bodyLabel.textContent = text;
  bodyLabel.classList.toggle("is-visible", visible && !labelHidden);
}

// --- Scenic tour ------------------------------------------------------------
function beginObserve(index, angle) {
  focusIndex = index;
  phase = "observe";
  phaseElapsed = 0;
  observeAngle = angle;
}

function beginTransit() {
  nextIndex = pickNextIndex(focusIndex);
  entryAngle = Math.random() * Math.PI * 2;
  phase = "transit";
  phaseElapsed = 0;
  transitStartReal.copy(viewerReal);
}

function updateScenic(delta) {
  phaseElapsed += delta;

  if (phase === "observe") {
    observeAngle += delta * OBSERVE_ANGULAR_SPEED;
    const planet = bodies[focusIndex].planet;
    bodyRealPosition(planet, simDate, focusReal);
    orbitOffset(planet, observeAngle, tmpOffset);
    viewerReal.copy(focusReal).add(tmpOffset);
    setBodyLabel(planet.name, true);

    if (phaseElapsed >= OBSERVE_SEC) beginTransit();
    return;
  }

  // transit — fly toward the destination body's orbit-entry position.
  const toPlanet = bodies[nextIndex].planet;
  const t = smoothstep(phaseElapsed / TRANSIT_SEC);

  bodyRealPosition(toPlanet, simDate, focusReal);
  orbitOffset(toPlanet, entryAngle, tmpOffset);
  targetReal.copy(focusReal).add(tmpOffset);
  viewerReal.lerpVectors(transitStartReal, targetReal, t);

  // Always head toward the destination body.
  lookRender.copy(focusReal).sub(viewerReal);

  setBodyLabel(toPlanet.name, t > 0.65);

  if (phaseElapsed >= TRANSIT_SEC) beginObserve(nextIndex, entryAngle);
}

// --- Flight -----------------------------------------------------------------
function clearFlightIdleTimer() {
  if (flightIdleTimer != null) {
    window.clearTimeout(flightIdleTimer);
    flightIdleTimer = null;
  }
}

function updateFlightBasis() {
  const cosPitch = Math.cos(flightPitch);
  flightForward
    .set(
      Math.sin(flightYaw) * cosPitch,
      Math.sin(flightPitch),
      Math.cos(flightYaw) * cosPitch,
    )
    .normalize();
  flightRight.crossVectors(flightForward, flightUp).normalize();
}

function isFlightSpeedKeyDown() {
  return (
    pressedKeys.has("ShiftLeft") ||
    pressedKeys.has("ShiftRight") ||
    pressedKeys.has("Shift")
  );
}

function updateFlight(delta) {
  updateFlightBasis();
  flightDirection.set(0, 0, 0);
  if (pressedKeys.has("KeyW")) flightDirection.add(flightForward);
  if (pressedKeys.has("KeyS")) flightDirection.sub(flightForward);
  if (pressedKeys.has("KeyD")) flightDirection.add(flightRight);
  if (pressedKeys.has("KeyA")) flightDirection.sub(flightRight);

  const fast = isFlightSpeedKeyDown() && pressedKeys.has("KeyW");
  const ludicrous = fast && pressedKeys.has("KeyF");
  const speed = ludicrous
    ? FLIGHT_LUDICROUS_SPEED
    : fast
      ? FLIGHT_LIGHTSPEED
      : FLIGHT_BASE_SPEED;

  if (flightDirection.lengthSq() > 0) {
    flightDirection.normalize().multiplyScalar(speed);
    flightVelocity.lerp(flightDirection, 0.18);
  } else {
    flightVelocity.multiplyScalar(0.86);
  }
  if (pressedKeys.has("Space")) flightVelocity.multiplyScalar(0.7);

  viewerReal.addScaledVector(flightVelocity, delta);

  // Surface collision against any nearby body.
  for (const body of bodies) {
    const minDistance = body.radius * 1.18;
    const dist = tmpVec.copy(viewerReal).sub(body.realPos).length();
    if (dist < minDistance && dist > 1e-6) {
      tmpVec.multiplyScalar(minDistance / dist);
      viewerReal.copy(body.realPos).add(tmpVec);
      flightVelocity.multiplyScalar(0.25);
    }
  }

  lookRender.copy(flightForward);
}

function enterFlight() {
  if (flightActive) {
    markFlightActivity();
    return;
  }
  flightActive = true;
  pressedKeys.clear();
  flightVelocity.set(0, 0, 0);

  // Re-derive a forward direction from the current view (toward focus body).
  camera.getWorldDirection(flightForward);
  flightYaw = Math.atan2(flightForward.x, flightForward.z);
  flightPitch = Math.asin(THREE.MathUtils.clamp(flightForward.y, -0.92, 0.92));

  notifyFlightModeEntered();
  markFlightActivity();
  showOfflineFlightMessage("FLIGHT MODE");
  setFlightHudVisible(true);
  renderer.domElement.requestPointerLock?.();
}

function returnToScenicFromFlight() {
  if (!flightActive) return;
  flightActive = false;
  pressedKeys.clear();
  flightVelocity.set(0, 0, 0);
  clearFlightIdleTimer();
  hideOfflineFlightMessage();
  setFlightHudVisible(false);
  notifyFlightModeExited();
  if (document.pointerLockElement === renderer.domElement) {
    document.exitPointerLock();
  }
  // Resume scenic tour by observing the nearest body.
  let nearest = focusIndex;
  let best = Infinity;
  for (let i = 0; i < bodies.length; i += 1) {
    const d = tmpVec.copy(viewerReal).sub(bodies[i].realPos).length();
    if (d < best) {
      best = d;
      nearest = i;
    }
  }
  beginObserve(nearest, observeAngle);
}

function markFlightActivity() {
  if (!flightActive) return;
  clearFlightIdleTimer();
  flightIdleTimer = window.setTimeout(
    returnToScenicFromFlight,
    FLIGHT_IDLE_RETURN_MS,
  );
}

// --- Rendering (floating origin) -------------------------------------------
function updateBodies(delta) {
  for (const body of bodies) {
    bodyRealPosition(body.planet, simDate, body.realPos);
    body.group.position.copy(body.realPos).sub(viewerReal);
    body.mesh.rotation.y += body.spin * delta;
    if (body.clouds) body.clouds.rotation.y += body.spin * 0.4 * delta;
  }
  sunLight.position.copy(bodies[SUN_INDEX].realPos).sub(viewerReal);
}

// --- Speed HUD --------------------------------------------------------------
function setFlightHudVisible(visible) {
  offlineFlightHudVisible = visible;
  if (offlineFlightHud) offlineFlightHud.classList.toggle("is-visible", visible);
}

function formatMultiple(multiple) {
  if (multiple >= 10) return `${Math.round(multiple)}×`;
  return `${multiple.toFixed(1)}×`;
}

function updateSpeedReadout(unitsPerSec, allowHud) {
  if (!offlineFlightHud || !offlineFlightHudValue) return;

  // Only surface speed while actually travelling (manual flight or scenic
  // transit) — never while parked in orbit during observation.
  if (!allowHud) {
    if (offlineFlightHudVisible) setFlightHudVisible(false);
    return;
  }
  if (!offlineFlightHudVisible) setFlightHudVisible(true);

  const kmPerSec = unitsPerSec * KM_PER_UNIT;
  const cMultiple = kmPerSec / C_KM_S;
  const showLightspeed = cMultiple >= LIGHTSPEED_C_THRESHOLD;
  const ludicrous = cMultiple >= LUDICROUS_C_THRESHOLD;

  offlineFlightHud.classList.toggle("is-lightspeed", showLightspeed && !ludicrous);
  offlineFlightHud.classList.toggle("is-ludicrous", ludicrous);

  if (offlineFlightHudHeading) {
    offlineFlightHudHeading.hidden = !showLightspeed;
    offlineFlightHudHeading.textContent = ludicrous ? "LUDICROUS" : "LIGHTSPEED";
  }

  offlineFlightHudValue.textContent = showLightspeed
    ? `${formatMultiple(cMultiple)} c`
    : `${Math.max(0, kmPerSec * 3600).toLocaleString(undefined, {
        maximumFractionDigits: 0,
      })} km/h`;
}

// --- Flight message ---------------------------------------------------------
function hideOfflineFlightMessage() {
  if (!offlineFlightMessage) return;
  offlineFlightMessage.classList.remove("is-visible");
  if (offlineFlightMessageTimer != null) {
    window.clearTimeout(offlineFlightMessageTimer);
    offlineFlightMessageTimer = null;
  }
}

function showOfflineFlightMessage(text = "FLIGHT MODE", duration = 2600) {
  if (!offlineFlightMessage) return;
  offlineFlightMessage.textContent = text;
  offlineFlightMessage.classList.add("is-visible");
  if (offlineFlightMessageTimer != null) {
    window.clearTimeout(offlineFlightMessageTimer);
  }
  offlineFlightMessageTimer = window.setTimeout(() => {
    offlineFlightMessage.classList.remove("is-visible");
    offlineFlightMessageTimer = null;
  }, duration);
}

// --- Extension messaging ----------------------------------------------------
function notifyFlightModeEntered() {
  void chrome.runtime.sendMessage({ type: "screensaver-flight-entered" });
}

function notifyFlightModeExited() {
  void chrome.runtime.sendMessage({ type: "screensaver-flight-exited" });
}

function notifyReady() {
  void chrome.runtime.sendMessage({ type: "screensaver-page-ready" });
}

function closeScreensaver() {
  void chrome.runtime.sendMessage({ type: "close" });
}

function closeFromInput(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  closeScreensaver();
}

// --- Input ------------------------------------------------------------------
function meaningfulPointerMove(event) {
  return (
    Math.abs(event.movementX || 0) + Math.abs(event.movementY || 0) >=
    POINTER_NOISE_EPSILON
  );
}

function meaningfulWheel(event) {
  return (
    Math.abs(event.deltaX || 0) +
      Math.abs(event.deltaY || 0) +
      Math.abs(event.deltaZ || 0) >=
    WHEEL_NOISE_EPSILON
  );
}

function bindInput() {
  window.addEventListener("contextmenu", (event) => {
    if (!flightActive) {
      closeFromInput(event);
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    markFlightActivity();
  });

  for (const eventName of ["pointerdown", "mousedown", "click"]) {
    window.addEventListener(
      eventName,
      (event) => {
        if (!flightActive) {
          closeFromInput(event);
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        markFlightActivity();
        if (eventName === "pointerdown") renderer.domElement.requestPointerLock?.();
      },
      true,
    );
  }

  window.addEventListener(
    "mousemove",
    (event) => {
      if (flightActive) {
        if (meaningfulPointerMove(event)) {
          flightYaw -= (event.movementX || 0) * FLIGHT_MOUSE_SENSITIVITY;
          flightPitch -= (event.movementY || 0) * FLIGHT_MOUSE_SENSITIVITY;
          flightPitch = THREE.MathUtils.clamp(flightPitch, -1.35, 1.35);
          markFlightActivity();
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (meaningfulPointerMove(event)) closeFromInput(event);
    },
    true,
  );

  window.addEventListener(
    "wheel",
    (event) => {
      if (flightActive) {
        if (meaningfulWheel(event)) markFlightActivity();
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (meaningfulWheel(event)) closeFromInput(event);
    },
    { capture: true, passive: false },
  );

  window.addEventListener("keydown", (event) => {
    const modified = event.metaKey || event.ctrlKey || event.altKey;

    if (flightActive) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.code === "Escape" || (event.code === exitKey && !modified)) {
        returnToScenicFromFlight();
        return;
      }
      if (event.code === "KeyL") {
        toggleLabel();
        return;
      }
      pressedKeys.add(event.code);
      if (event.key === "Shift") pressedKeys.add("Shift");
      markFlightActivity();
      return;
    }

    if (event.code === "KeyL" && !modified) {
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleLabel();
      return;
    }

    if (flightEnabled && event.code === flightKey && !modified) {
      event.preventDefault();
      event.stopImmediatePropagation();
      enterFlight();
      return;
    }

    closeFromInput(event);
  });

  window.addEventListener(
    "keyup",
    (event) => {
      if (!flightActive) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      pressedKeys.delete(event.code);
      if (event.key === "Shift") pressedKeys.delete("Shift");
      markFlightActivity();
    },
    true,
  );

  document.addEventListener("pointerlockchange", () => {
    if (flightActive && document.pointerLockElement !== renderer.domElement) {
      returnToScenicFromFlight();
    }
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function toggleLabel() {
  labelHidden = !labelHidden;
  if (bodyLabel && labelHidden) bodyLabel.classList.remove("is-visible");
}

// --- Main loop --------------------------------------------------------------
function animate() {
  const now = performance.now();
  const delta = Math.min((now - previousFrameMs) / 1000, 0.05);
  previousFrameMs = now;

  simMs += delta * 1000 * SIM_TIME_SCALE;
  simDate.setTime(simEpochMs + simMs);

  prevViewerReal.copy(viewerReal);

  if (flightActive) {
    updateFlight(delta);
  } else {
    updateScenic(delta);
  }

  updateBodies(delta);

  if (fadeOverlay) fadeOverlay.style.opacity = "0";

  camera.position.set(0, 0, 0);
  if (!flightActive && phase === "observe") {
    lookRender.copy(bodies[focusIndex].group.position);
  }
  tmpVec.copy(camera.position).add(lookRender);
  camera.lookAt(tmpVec);

  const speedUnits = delta > 0 ? prevViewerReal.distanceTo(viewerReal) / delta : 0;
  updateSpeedReadout(speedUnits, flightActive || phase === "transit");

  renderer.render(scene, camera);
  window.requestAnimationFrame(animate);
}

// --- Boot -------------------------------------------------------------------
buildBodies();
makeStars();

// Seed the camera at the starting focus body so frame 0 is already framed.
{
  const planet = bodies[focusIndex].planet;
  bodyRealPosition(planet, simDate, focusReal);
  orbitOffset(planet, observeAngle, tmpOffset);
  viewerReal.copy(focusReal).add(tmpOffset);
  updateBodies(0);
  camera.position.set(0, 0, 0);
  camera.lookAt(bodies[focusIndex].group.position);
}

bindInput();
notifyReady();
animate();
