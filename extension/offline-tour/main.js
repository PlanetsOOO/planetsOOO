import * as THREE from "three";

const POINTER_NOISE_EPSILON = 2;
const WHEEL_NOISE_EPSILON = 1;
const OBSERVE_SEC = 54;
const TRANSITION_SEC = 30;
const LEG_SEC = OBSERVE_SEC + TRANSITION_SEC;
const CLOCK_SPEED = 1;
const SCENIC_FOCUS_RADIUS_SCALE = 3;
const FLIGHT_IDLE_RETURN_MS = 15000;
const FLIGHT_MOUSE_SENSITIVITY = 0.0024;
const FLIGHT_BASE_SPEED = 4.2;
const FLIGHT_FAST_MULTIPLIER = 8;
const FLIGHT_LUDICROUS_MULTIPLIER = 22;
const FLIGHT_MIN_SURFACE_SCALE = 1.28;
const FLIGHT_SCENE_UNIT_KM = 1200;
const LIGHTSPEED_MULTIPLIER = 1;
const LUDICROUS_SPEED_MULTIPLIER = 100;

const params = new URLSearchParams(window.location.search);
const flightKey = params.get("flightKey") || "Backquote";
const exitKey = params.get("exitKey") || flightKey;
const flightParam = params.get("flight");
const flightEnabled =
  flightParam == null || flightParam === "1" || flightParam === "true";

const root = document.getElementById("threeRoot");
const fadeOverlay = document.getElementById("fadeOverlay");
const offlineFlightMessage = document.getElementById("offlineFlightMessage");
const offlineFlightHud = document.getElementById("offlineFlightHud");
const offlineFlightHudHeading = document.getElementById("offlineFlightHudHeading");
const offlineFlightHudValue = document.getElementById("offlineFlightHudValue");

const TOUR = [
  {
    id: "sun",
    texture: "textures/2k_sun.jpg",
    radius: 3.8,
    viewDistance: 19,
    cameraY: 1.2,
    orbitTilt: 0.16,
    spin: 0.01,
    color: 0xffc45c,
    exposure: 0.92,
  },
  {
    id: "mercury",
    texture: "textures/2k_mercury.jpg",
    radius: 1.55,
    viewDistance: 7.8,
    cameraY: 0.5,
    orbitTilt: 0.12,
    spin: 0.012,
    color: 0xb5b5b5,
    exposure: 1.1,
  },
  {
    id: "venus",
    texture: "textures/2k_venus_surface.jpg",
    radius: 2.15,
    viewDistance: 9.4,
    cameraY: 0.25,
    orbitTilt: 0.1,
    spin: -0.007,
    color: 0xe8cda8,
    exposure: 1.08,
  },
  {
    id: "earth",
    texture: "textures/2k_earth_daymap.jpg",
    clouds: "textures/2k_earth_clouds.jpg",
    radius: 2.25,
    viewDistance: 9.6,
    cameraY: 0.58,
    orbitTilt: 0.14,
    spin: 0.01,
    color: 0x6b93d6,
    exposure: 1.1,
  },
  {
    id: "mars",
    texture: "textures/2k_mars.jpg",
    radius: 1.9,
    viewDistance: 8.8,
    cameraY: 0.35,
    orbitTilt: 0.1,
    spin: 0.011,
    color: 0xc1440e,
    exposure: 1.1,
  },
  {
    id: "jupiter",
    texture: "textures/2k_jupiter.jpg",
    radius: 3.15,
    viewDistance: 13.8,
    cameraY: 0.9,
    orbitTilt: 0.08,
    spin: 0.009,
    color: 0xd4a574,
    exposure: 1.05,
  },
  {
    id: "saturn",
    texture: "textures/2k_saturn.jpg",
    ringTexture: "textures/2k_saturn_ring_alpha.png",
    radius: 2.85,
    viewDistance: 14.4,
    cameraY: 1,
    orbitTilt: 0.08,
    spin: 0.008,
    color: 0xf4e5c3,
    exposure: 1.05,
  },
  {
    id: "uranus",
    texture: "textures/2k_uranus.jpg",
    radius: 2.45,
    viewDistance: 11.2,
    cameraY: 0.35,
    orbitTilt: 0.06,
    spin: -0.007,
    color: 0xb5e8e8,
    exposure: 1.1,
  },
  {
    id: "neptune",
    texture: "textures/2k_neptune.jpg",
    radius: 2.4,
    viewDistance: 11.1,
    cameraY: 0.45,
    orbitTilt: 0.06,
    spin: 0.008,
    color: 0x5b7fde,
    exposure: 1.1,
  },
];

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x02040a, 0.01);

const camera = new THREE.PerspectiveCamera(
  44,
  window.innerWidth / window.innerHeight,
  0.1,
  200,
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
root.append(renderer.domElement);

const textureLoader = new THREE.TextureLoader();
const textures = new Map();
const stage = new THREE.Group();
const lookTarget = new THREE.Vector3(0, 0, 0);
const cameraTarget = new THREE.Vector3();
const transitionEndCamera = new THREE.Vector3();
const transitionEntryStart = new THREE.Vector3();
const transitionCenter = new THREE.Vector3(0, 0, 0);
const screenRight = new THREE.Vector3();
const screenForward = new THREE.Vector3();
const screenOffset = new THREE.Vector3();
const flightForward = new THREE.Vector3();
const flightRight = new THREE.Vector3();
const flightDirection = new THREE.Vector3();
const flightVelocity = new THREE.Vector3();
const flightLookTarget = new THREE.Vector3();
const flightUp = new THREE.Vector3(0, 1, 0);

function focusViewDistance(stop) {
  return stop.radius * SCENIC_FOCUS_RADIUS_SCALE;
}

let activeBundle = null;
let incomingBundle = null;
let activeIndex = -1;
let incomingIndex = -1;
let previousFrameMs = performance.now();
let elapsedSec = Math.floor(Math.random() * TOUR.length) * LEG_SEC;
let offlineFlightMessageTimer = null;
let offlineFlightHudVisible = false;
let flightActive = false;
let flightIdleTimer = null;
let flightYaw = 0;
let flightPitch = 0;
const pressedKeys = new Set();

scene.add(stage);
scene.add(new THREE.AmbientLight(0x5f6f8f, 0.08));

const keyLight = new THREE.DirectionalLight(0xfff0cf, 4.5);
keyLight.position.set(8, 5.2, 10);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 1;
keyLight.shadow.camera.far = 60;
keyLight.shadow.camera.left = -18;
keyLight.shadow.camera.right = 18;
keyLight.shadow.camera.top = 18;
keyLight.shadow.camera.bottom = -18;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x789dff, 0.22);
fillLight.position.set(-9, -2, -6);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xb8d6ff, 0.52);
rimLight.position.set(-7, 4, -9);
scene.add(rimLight);

const sunGlow = new THREE.PointLight(0xffc15c, 0, 46, 1.4);
sunGlow.position.set(0, 0, 0);
scene.add(sunGlow);

function loadTexture(path) {
  if (textures.has(path)) return textures.get(path);
  const texture = textureLoader.load(path);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  textures.set(path, texture);
  return texture;
}

function preloadTextures() {
  for (const stop of TOUR) {
    loadTexture(stop.texture);
    if (stop.clouds) loadTexture(stop.clouds);
    if (stop.ringTexture) loadTexture(stop.ringTexture);
  }
}

function makeStars() {
  const count = 2200;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const r = 80 + Math.random() * 95;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.cos(phi) * r;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;

    const tint = 0.72 + Math.random() * 0.28;
    colors[i * 3] = tint * 0.78;
    colors[i * 3 + 1] = tint * 0.84;
    colors[i * 3 + 2] = tint;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.14,
    vertexColors: true,
    transparent: true,
    opacity: 0.76,
    depthWrite: false,
  });
  scene.add(new THREE.Points(geometry, material));
}

function disposeGroup(group) {
  group.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) {
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of materials) material.dispose();
    }
  });
}

function createBody(stop) {
  const group = new THREE.Group();
  const material =
    stop.id === "sun"
      ? new THREE.MeshBasicMaterial({
          map: loadTexture(stop.texture),
          color: stop.color,
        })
      : new THREE.MeshStandardMaterial({
          map: loadTexture(stop.texture),
          color: stop.color,
          roughness: 0.92,
          metalness: 0.02,
        });

  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(stop.radius, 96, 96),
    material,
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.rotation.z = stop.id === "uranus" ? 1.35 : 0;
  group.add(mesh);

  let clouds = null;
  if (stop.clouds) {
    clouds = new THREE.Mesh(
      new THREE.SphereGeometry(stop.radius * 1.012, 96, 96),
      new THREE.MeshStandardMaterial({
        map: loadTexture(stop.clouds),
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    );
    clouds.castShadow = true;
    clouds.receiveShadow = true;
    group.add(clouds);
  }

  let ring = null;
  if (stop.ringTexture) {
    ring = new THREE.Mesh(
      new THREE.RingGeometry(stop.radius * 1.34, stop.radius * 2.34, 128),
      new THREE.MeshStandardMaterial({
        map: loadTexture(stop.ringTexture),
        transparent: true,
        alphaTest: 0.02,
        opacity: 0.82,
        side: THREE.DoubleSide,
        depthWrite: false,
        roughness: 0.95,
      }),
    );
    ring.rotation.x = Math.PI / 2.45;
    ring.rotation.y = -0.2;
    ring.castShadow = true;
    ring.receiveShadow = true;
    group.add(ring);
  }

  return { stop, group, mesh, clouds, ring };
}

function removeBundle(bundle) {
  if (!bundle) return;
  stage.remove(bundle.group);
  disposeGroup(bundle.group);
}

function setActiveStop(index) {
  const nextIndex = index % TOUR.length;
  if (activeIndex === nextIndex && activeBundle) return;

  removeBundle(activeBundle);
  removeBundle(incomingBundle);

  activeIndex = nextIndex;
  incomingIndex = -1;
  activeBundle = createBody(TOUR[activeIndex]);
  incomingBundle = null;
  activeBundle.group.position.set(0, 0, 0);
  stage.add(activeBundle.group);

  renderer.toneMappingExposure = activeBundle.stop.exposure;
  sunGlow.intensity = activeBundle.stop.id === "sun" ? 3.2 : 0;
}

function ensureIncoming(index) {
  const nextIndex = index % TOUR.length;
  if (incomingIndex === nextIndex && incomingBundle) return;

  removeBundle(incomingBundle);
  incomingIndex = nextIndex;
  incomingBundle = createBody(TOUR[incomingIndex]);
  stage.add(incomingBundle.group);
}

function smoothstep(t) {
  const clamped = THREE.MathUtils.clamp(t, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function orbitCameraPosition(stop, phase, target) {
  const angle = phase * Math.PI * 1.18;
  const viewDistance = focusViewDistance(stop);
  target.set(
    Math.cos(angle) * viewDistance,
    stop.cameraY + Math.sin(angle * 0.7) * stop.radius * stop.orbitTilt,
    Math.sin(angle) * viewDistance,
  );
  return target;
}

function updateScreenBasis() {
  camera.updateMatrixWorld(true);
  screenRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  camera.getWorldDirection(screenForward);
}

function screenExitDistance(stop) {
  const halfFov = THREE.MathUtils.degToRad(camera.fov) / 2;
  const halfWidth = focusViewDistance(stop) * Math.tan(halfFov) * camera.aspect;
  return halfWidth + stop.radius * 2.4;
}

function currentTourFocusIndex() {
  const leg = Math.floor(elapsedSec / LEG_SEC) % TOUR.length;
  const local = elapsedSec % LEG_SEC;
  return local >= OBSERVE_SEC + TRANSITION_SEC / 2
    ? (leg + 1) % TOUR.length
    : leg;
}

function syncFlightLookFromCamera() {
  camera.getWorldDirection(flightForward);
  flightYaw = Math.atan2(flightForward.x, flightForward.z);
  flightPitch = Math.asin(THREE.MathUtils.clamp(flightForward.y, -0.92, 0.92));
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

function updateObserve(localSec) {
  removeBundle(incomingBundle);
  incomingBundle = null;
  incomingIndex = -1;
  if (fadeOverlay) fadeOverlay.style.opacity = "0";
  activeBundle.group.visible = true;

  const phase = localSec / OBSERVE_SEC;
  const drift = Math.sin(phase * Math.PI * 2) * activeBundle.stop.radius * 0.08;

  activeBundle.group.position.set(0, 0, 0);
  orbitCameraPosition(activeBundle.stop, phase, cameraTarget);
  camera.position.lerp(cameraTarget, 0.025);
  lookTarget.set(0, drift, 0);
  camera.lookAt(lookTarget);
}

function updateTransition(localSec, leg) {
  const rawT = (localSec - OBSERVE_SEC) / TRANSITION_SEC;
  const nextIndex = (leg + 1) % TOUR.length;

  if (fadeOverlay) fadeOverlay.style.opacity = "0";

  const outgoing = activeBundle.stop;
  const incoming = TOUR[nextIndex];
  const exitDistance = Math.max(
    screenExitDistance(outgoing),
    screenExitDistance(incoming),
    outgoing.radius + incoming.radius + 8,
  );
  const retreat = Math.max(focusViewDistance(outgoing), focusViewDistance(incoming)) + 7;
  const startCamera = orbitCameraPosition(outgoing, 1, cameraTarget);
  const endCamera = orbitCameraPosition(incoming, 0.04, transitionEndCamera);

  if (rawT < 0.5) {
    const exitT = smoothstep(rawT * 2);
    removeBundle(incomingBundle);
    incomingBundle = null;
    incomingIndex = -1;
    activeBundle.group.visible = true;
    camera.position.copy(startCamera);
    camera.position.z += exitT * 8;
    camera.position.y += Math.sin(exitT * Math.PI) * 0.8;
    camera.lookAt(0, 0, 0);
    updateScreenBasis();
    screenOffset
      .copy(screenRight)
      .multiplyScalar(exitDistance * exitT)
      .addScaledVector(screenForward, -retreat * exitT * 0.2);
    activeBundle.group.position.copy(screenOffset);
    camera.lookAt(transitionCenter);
    renderer.toneMappingExposure = outgoing.exposure;
    sunGlow.intensity = outgoing.id === "sun" ? 3.2 * (1 - exitT) : 0;
    return;
  }

  const enterT = smoothstep((rawT - 0.5) * 2);
  activeBundle.group.visible = false;
  ensureIncoming(nextIndex);
  incomingBundle.group.visible = true;
  camera.position.lerpVectors(startCamera, endCamera, enterT);
  camera.position.z += (1 - enterT) * 8;
  camera.position.y += Math.sin(enterT * Math.PI) * 0.8;
  camera.lookAt(0, 0, 0);
  updateScreenBasis();
  transitionEntryStart
    .copy(screenRight)
    .multiplyScalar(-exitDistance)
    .addScaledVector(screenForward, -retreat * 0.2);
  incomingBundle.group.position.lerpVectors(
    transitionEntryStart,
    transitionCenter,
    enterT,
  );
  camera.lookAt(transitionCenter);
  renderer.toneMappingExposure = THREE.MathUtils.lerp(
    outgoing.exposure,
    incoming.exposure,
    enterT,
  );
  sunGlow.intensity = incoming.id === "sun" ? 3.2 * enterT : 0;
}

function updateTour(elapsed) {
  const leg = Math.floor(elapsed / LEG_SEC) % TOUR.length;
  const local = elapsed % LEG_SEC;

  setActiveStop(leg);

  if (local < OBSERVE_SEC) {
    updateObserve(local);
    return;
  }

  updateTransition(local, leg);
}

function clearFlightIdleTimer() {
  if (flightIdleTimer != null) {
    window.clearTimeout(flightIdleTimer);
    flightIdleTimer = null;
  }
}

function setFlightHudVisible(visible) {
  offlineFlightHudVisible = visible;
  if (offlineFlightHud) {
    offlineFlightHud.classList.toggle("is-visible", visible);
  }
}

function formatSpeedMultiple(multiple) {
  if (multiple >= 100) return `${Math.round(multiple)}×`;
  if (multiple >= 10) return `${Math.round(multiple)}×`;
  if (multiple >= 1) return `${multiple.toFixed(1)}×`;
  return `${multiple.toFixed(2)}×`;
}

function updateFlightHud(speedKmPerSec, lightspeedMultiple = 0) {
  if (!offlineFlightHud || !offlineFlightHudValue) return;

  const showLightspeed = lightspeedMultiple >= 0.95;
  const ludicrous =
    lightspeedMultiple >= LUDICROUS_SPEED_MULTIPLIER * 0.95;

  offlineFlightHud.classList.toggle("is-lightspeed", showLightspeed && !ludicrous);
  offlineFlightHud.classList.toggle("is-ludicrous", ludicrous);

  if (offlineFlightHudHeading) {
    offlineFlightHudHeading.hidden = !showLightspeed;
    offlineFlightHudHeading.textContent = ludicrous ? "LUDICROUS" : "LIGHTSPEED";
  }

  offlineFlightHudValue.textContent = showLightspeed
    ? `${formatSpeedMultiple(lightspeedMultiple)} c`
    : `${Math.max(0, speedKmPerSec * 3600).toLocaleString(undefined, {
        maximumFractionDigits: 0,
      })} km/h`;

  if (!offlineFlightHudVisible) setFlightHudVisible(true);
}

function notifyFlightModeEntered() {
  void chrome.runtime.sendMessage({ type: "screensaver-flight-entered" });
}

function notifyFlightModeExited() {
  void chrome.runtime.sendMessage({ type: "screensaver-flight-exited" });
}

function hideOfflineFlightMessage() {
  if (!offlineFlightMessage) return;
  offlineFlightMessage.classList.remove("is-visible");
  if (offlineFlightMessageTimer != null) {
    window.clearTimeout(offlineFlightMessageTimer);
    offlineFlightMessageTimer = null;
  }
}

function showOfflineFlightMessage(text = "OFFLINE FLIGHT", duration = 3000) {
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

  elapsedSec = activeIndex >= 0 ? activeIndex * LEG_SEC : elapsedSec;
}

function markFlightActivity() {
  if (!flightActive) return;
  clearFlightIdleTimer();
  flightIdleTimer = window.setTimeout(
    returnToScenicFromFlight,
    FLIGHT_IDLE_RETURN_MS,
  );
}

function enterOfflineFlight(event) {
  event.preventDefault();
  event.stopImmediatePropagation();

  if (flightActive) {
    markFlightActivity();
    return;
  }

  const focusIndex = currentTourFocusIndex();
  setActiveStop(focusIndex);
  removeBundle(incomingBundle);
  incomingBundle = null;
  incomingIndex = -1;
  activeBundle.group.visible = true;
  activeBundle.group.position.set(0, 0, 0);

  orbitCameraPosition(activeBundle.stop, 0.12, cameraTarget);
  camera.position.copy(cameraTarget);
  camera.lookAt(0, activeBundle.stop.cameraY * 0.1, 0);
  syncFlightLookFromCamera();

  flightActive = true;
  pressedKeys.clear();
  flightVelocity.set(0, 0, 0);
  elapsedSec = activeIndex * LEG_SEC;
  renderer.toneMappingExposure = activeBundle.stop.exposure;
  sunGlow.intensity = activeBundle.stop.id === "sun" ? 3.2 : 0;

  notifyFlightModeEntered();
  markFlightActivity();
  showOfflineFlightMessage();
  updateFlightHud(0, 0);
  renderer.domElement.requestPointerLock?.();
}

function isFlightSpeedKeyDown() {
  return (
    pressedKeys.has("ShiftLeft") ||
    pressedKeys.has("ShiftRight") ||
    pressedKeys.has("Shift")
  );
}

function updateOfflineFlight(delta) {
  if (!activeBundle) {
    setActiveStop(0);
  }

  removeBundle(incomingBundle);
  incomingBundle = null;
  incomingIndex = -1;
  activeBundle.group.visible = true;
  activeBundle.group.position.set(0, 0, 0);
  if (fadeOverlay) fadeOverlay.style.opacity = "0";

  updateFlightBasis();
  flightDirection.set(0, 0, 0);
  if (pressedKeys.has("KeyW")) flightDirection.add(flightForward);
  if (pressedKeys.has("KeyS")) flightDirection.sub(flightForward);
  if (pressedKeys.has("KeyD")) flightDirection.add(flightRight);
  if (pressedKeys.has("KeyA")) flightDirection.sub(flightRight);

  const fast = isFlightSpeedKeyDown() && pressedKeys.has("KeyW");
  const ludicrous = fast && pressedKeys.has("KeyF");
  const speedMultiplier = ludicrous
    ? FLIGHT_LUDICROUS_MULTIPLIER
    : fast
      ? FLIGHT_FAST_MULTIPLIER
      : 1;
  const speed = FLIGHT_BASE_SPEED * speedMultiplier;

  if (flightDirection.lengthSq() > 0) {
    flightDirection.normalize().multiplyScalar(speed);
    flightVelocity.lerp(flightDirection, 0.18);
  } else {
    flightVelocity.multiplyScalar(0.88);
  }

  if (pressedKeys.has("Space")) {
    flightVelocity.multiplyScalar(0.72);
  }

  camera.position.addScaledVector(flightVelocity, delta);

  const minDistance = activeBundle.stop.radius * FLIGHT_MIN_SURFACE_SCALE;
  const distanceFromFocus = camera.position.length();
  if (distanceFromFocus < minDistance) {
    camera.position.setLength(minDistance);
    flightVelocity.multiplyScalar(0.25);
  }

  flightLookTarget.copy(camera.position).add(flightForward);
  camera.lookAt(flightLookTarget);

  const sceneUnitsPerSec = flightVelocity.length();
  const speedKmPerSec = sceneUnitsPerSec * FLIGHT_SCENE_UNIT_KM;
  updateFlightHud(
    speedKmPerSec,
    ludicrous
      ? LUDICROUS_SPEED_MULTIPLIER
      : fast
        ? LIGHTSPEED_MULTIPLIER
        : 0,
  );
}

function spinBundle(bundle, delta, multiplier = 1) {
  if (!bundle) return;
  bundle.mesh.rotation.y += bundle.stop.spin * delta * multiplier;
  if (bundle.clouds) {
    bundle.clouds.rotation.y += bundle.stop.spin * delta * 1.35 * multiplier;
  }
  if (bundle.ring) bundle.ring.rotation.z += bundle.stop.spin * delta * 0.06 * multiplier;
}

function updateObjects(delta) {
  spinBundle(activeBundle, delta);
  spinBundle(incomingBundle, delta, 0.75);
}

function closeScreensaver() {
  void chrome.runtime.sendMessage({ type: "close" });
}

function closeFromInput(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  closeScreensaver();
}

function notifyReady() {
  void chrome.runtime.sendMessage({ type: "screensaver-page-ready" });
}

function requestOnlineUpgradeWhenReachable() {
  const requestUpgrade = () => {
    void chrome.runtime.sendMessage({ type: "upgrade-offline-screensaver" });
  };

  requestUpgrade();
  window.addEventListener("online", requestUpgrade);
}

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

  window.addEventListener(
    "pointerdown",
    (event) => {
      if (!flightActive) {
        closeFromInput(event);
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      markFlightActivity();
      renderer.domElement.requestPointerLock?.();
    },
    true,
  );

  window.addEventListener(
    "mousedown",
    (event) => {
      if (!flightActive) {
        closeFromInput(event);
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      markFlightActivity();
    },
    true,
  );

  window.addEventListener(
    "click",
    (event) => {
      if (!flightActive) {
        closeFromInput(event);
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      markFlightActivity();
    },
    true,
  );

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

      if (
        event.code === "Escape" ||
        (event.code === exitKey && !modified)
      ) {
        returnToScenicFromFlight();
        return;
      }

      pressedKeys.add(event.code);
      if (event.key === "Shift") pressedKeys.add("Shift");
      markFlightActivity();
      return;
    }

    if (flightEnabled && event.code === flightKey && !modified) {
      enterOfflineFlight(event);
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

function animate() {
  const now = performance.now();
  const delta = Math.min((now - previousFrameMs) / 1000, 0.05);
  previousFrameMs = now;
  if (flightActive) {
    updateOfflineFlight(delta);
  } else {
    elapsedSec += delta * CLOCK_SPEED;
    updateTour(elapsedSec);
  }
  updateObjects(delta);
  renderer.render(scene, camera);
  window.requestAnimationFrame(animate);
}

preloadTextures();
makeStars();
setActiveStop(Math.floor(elapsedSec / LEG_SEC) % TOUR.length);
camera.position.set(
  0,
  activeBundle.stop.cameraY,
  focusViewDistance(activeBundle.stop),
);
bindInput();
notifyReady();
requestOnlineUpgradeWhenReachable();
animate();
