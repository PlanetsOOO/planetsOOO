const POINTER_NOISE_EPSILON = 2;
const WHEEL_NOISE_EPSILON = 1;
const UPGRADE_CHECK_MS = 30_000;

const params = new URLSearchParams(window.location.search);
const flightKey = params.get("flightKey") || "Backquote";
const exitKey = params.get("exitKey") || flightKey;

const focusName = document.getElementById("focusName");
const focusFact = document.getElementById("focusFact");
const focusWrap = document.getElementById("focusWrap");
const focusBody = document.getElementById("focusBody");
const focusRing = document.getElementById("focusRing");
const orbitField = document.getElementById("orbitField");
const tourRail = document.getElementById("tourRail");
const upgradeStatus = document.getElementById("upgradeStatus");
const hint = document.querySelector(".hint");

const tourStops = [
  {
    id: "sun",
    name: "Sun",
    fact: "The local tour starts at the solar anchor, then loops outward through every planet.",
    color: "#fbbf24",
    size: "34vmin",
    cameraX: "12vw",
    cameraY: "2vh",
    cameraScale: 1.08,
    tilt: "0deg",
    gradient:
      "radial-gradient(circle at 34% 30%, #fff7ed, #fde68a 28%, #f97316 62%, #7c2d12)",
    glow: "rgba(251, 191, 36, 0.7)",
    bandColor: "rgba(255, 255, 255, 0.08)",
    bandAngle: "18deg",
    orbit: 0,
  },
  {
    id: "mercury",
    name: "Mercury",
    fact: "A compact inner-world pass, standing in for the online scenic tour while offline.",
    color: "#b5b5b5",
    size: "12vmin",
    cameraX: "-9vw",
    cameraY: "8vh",
    cameraScale: 1.38,
    tilt: "2deg",
    gradient:
      "radial-gradient(circle at 32% 28%, #f8fafc, #a3a3a3 36%, #525252 72%, #171717)",
    glow: "rgba(163, 163, 163, 0.42)",
    bandColor: "rgba(255, 255, 255, 0.06)",
    bandAngle: "-18deg",
    orbit: 1,
  },
  {
    id: "venus",
    name: "Venus",
    fact: "Offline mode keeps a planet-by-planet scenic rhythm without requiring the web app.",
    color: "#e8cda8",
    size: "18vmin",
    cameraX: "8vw",
    cameraY: "-4vh",
    cameraScale: 1.34,
    tilt: "177deg",
    gradient:
      "radial-gradient(circle at 34% 30%, #fff7ed, #f5d0a9 34%, #b45309 72%, #431407)",
    glow: "rgba(251, 191, 36, 0.34)",
    bandColor: "rgba(255, 237, 213, 0.12)",
    bandAngle: "28deg",
    orbit: 2,
  },
  {
    id: "earth",
    name: "Earth",
    fact: "When the internet returns, this tab upgrades back to the full PlanetsOOO tour.",
    color: "#6b93d6",
    size: "19vmin",
    cameraX: "-7vw",
    cameraY: "5vh",
    cameraScale: 1.36,
    tilt: "23deg",
    gradient:
      "radial-gradient(circle at 34% 28%, #ecfeff, #60a5fa 26%, #1d4ed8 52%, #052e16 72%, #020617)",
    glow: "rgba(96, 165, 250, 0.46)",
    bandColor: "rgba(34, 197, 94, 0.16)",
    bandAngle: "-32deg",
    orbit: 3,
  },
  {
    id: "mars",
    name: "Mars",
    fact: "A packaged fallback can later be upgraded with local texture assets for higher fidelity.",
    color: "#c1440e",
    size: "16vmin",
    cameraX: "9vw",
    cameraY: "-7vh",
    cameraScale: 1.44,
    tilt: "25deg",
    gradient:
      "radial-gradient(circle at 35% 28%, #fed7aa, #c2410c 42%, #7c2d12 72%, #1c1917)",
    glow: "rgba(248, 113, 113, 0.36)",
    bandColor: "rgba(254, 215, 170, 0.12)",
    bandAngle: "12deg",
    orbit: 4,
  },
  {
    id: "jupiter",
    name: "Jupiter",
    fact: "The offline loop preserves the broad scenic sequence across the outer planets.",
    color: "#d4a574",
    size: "31vmin",
    cameraX: "-5vw",
    cameraY: "2vh",
    cameraScale: 1.18,
    tilt: "3deg",
    gradient:
      "radial-gradient(circle at 34% 28%, #fff7ed, #d4a574 24%, #92400e 48%, #f5deb3 58%, #7c2d12 76%, #1c1917)",
    glow: "rgba(251, 146, 60, 0.38)",
    bandColor: "rgba(255, 247, 237, 0.18)",
    bandAngle: "0deg",
    orbit: 5,
  },
  {
    id: "saturn",
    name: "Saturn",
    fact: "Ring focus is represented locally so the fallback still feels like a tour stop.",
    color: "#f4e5c3",
    size: "27vmin",
    cameraX: "5vw",
    cameraY: "-5vh",
    cameraScale: 1.24,
    tilt: "27deg",
    gradient:
      "radial-gradient(circle at 34% 28%, #fff7ed, #f4e5c3 34%, #b45309 68%, #3f2f17)",
    glow: "rgba(244, 229, 195, 0.4)",
    bandColor: "rgba(255, 247, 237, 0.14)",
    bandAngle: "4deg",
    ring: true,
    orbit: 6,
  },
  {
    id: "uranus",
    name: "Uranus",
    fact: "Distant-planet passes keep moving even when the network is unavailable.",
    color: "#b5e8e8",
    size: "23vmin",
    cameraX: "-8vw",
    cameraY: "-5vh",
    cameraScale: 1.26,
    tilt: "97deg",
    gradient:
      "radial-gradient(circle at 34% 28%, #f0fdfa, #a7f3d0 34%, #38bdf8 72%, #0f172a)",
    glow: "rgba(125, 211, 252, 0.36)",
    bandColor: "rgba(240, 253, 250, 0.09)",
    bandAngle: "74deg",
    orbit: 7,
  },
  {
    id: "neptune",
    name: "Neptune",
    fact: "The loop ends beyond the classical planets, then returns to the Sun.",
    color: "#5b7fde",
    size: "22vmin",
    cameraX: "8vw",
    cameraY: "5vh",
    cameraScale: 1.3,
    tilt: "28deg",
    gradient:
      "radial-gradient(circle at 34% 28%, #dbeafe, #60a5fa 30%, #1d4ed8 62%, #020617)",
    glow: "rgba(96, 165, 250, 0.42)",
    bandColor: "rgba(219, 234, 254, 0.12)",
    bandAngle: "-8deg",
    orbit: 8,
  },
];

let tourIndex = 0;
let hintTimer = null;

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

async function tryUpgradeOnline() {
  try {
    const result = await chrome.runtime.sendMessage({
      type: "upgrade-offline-screensaver",
    });
    if (result?.upgraded) {
      upgradeStatus.textContent = "Internet found · loading PlanetsOOO scenic tour";
      return;
    }
    upgradeStatus.textContent = "Offline scenic mode · waiting for PlanetsOOO";
  } catch {
    upgradeStatus.textContent = "Offline scenic mode · extension worker unavailable";
  }
}

function showFlightUnavailable() {
  if (!hint) return;
  hint.textContent = "Flight mode needs the online PlanetsOOO app";
  hint.classList.add("is-visible");
  if (hintTimer != null) window.clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => {
    hint.textContent = "Any input closes scenic mode · configured flight key shows online note";
    hint.classList.remove("is-visible");
  }, 2200);
}

function applyTourStop(index) {
  const stop = tourStops[index % tourStops.length];
  focusName.textContent = stop.name;
  focusFact.textContent = stop.fact;
  focusWrap.style.setProperty("--body-size", stop.size);
  focusWrap.style.setProperty("--camera-x", stop.cameraX);
  focusWrap.style.setProperty("--camera-y", stop.cameraY);
  focusWrap.style.setProperty("--camera-scale", String(stop.cameraScale));
  focusBody.style.setProperty("--body-gradient", stop.gradient);
  focusBody.style.setProperty("--body-glow", stop.glow);
  focusBody.style.setProperty("--tilt", stop.tilt);
  focusBody.style.setProperty("--band-color", stop.bandColor);
  focusBody.style.setProperty("--band-angle", stop.bandAngle);
  focusRing.classList.toggle("is-visible", Boolean(stop.ring));
  document
    .querySelectorAll("[data-tour-stop]")
    .forEach((item) => item.classList.toggle("is-active", item.dataset.tourStop === stop.id));
  orbitField.style.transform = `translate(-50%, -50%) rotateX(62deg) rotateZ(${
    -18 - stop.orbit * 8
  }deg)`;
}

function nextTourStop() {
  tourIndex += 1;
  applyTourStop(tourIndex);
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

function buildOrbitField() {
  for (const stop of tourStops.slice(1)) {
    const track = document.createElement("div");
    track.className = "orbit-track";
    track.style.setProperty("--inset", `${7 + stop.orbit * 4.8}%`);
    orbitField.append(track);

    const angle = -34 + stop.orbit * 32;
    const radius = 42 - stop.orbit * 3.7;
    const x = 50 + Math.cos((angle / 180) * Math.PI) * radius;
    const y = 50 + Math.sin((angle / 180) * Math.PI) * radius;
    const marker = document.createElement("span");
    marker.className = "orbit-marker";
    marker.dataset.tourStop = stop.id;
    marker.style.setProperty("--x", `${x}%`);
    marker.style.setProperty("--y", `${y}%`);
    marker.style.setProperty("--dot", stop.id === "jupiter" || stop.id === "saturn" ? "0.72rem" : "0.48rem");
    marker.style.setProperty("--color", stop.color);
    orbitField.append(marker);
  }

  for (const stop of tourStops) {
    const item = document.createElement("li");
    item.dataset.tourStop = stop.id;
    item.style.setProperty("--color", stop.color);
    item.title = stop.name;
    tourRail.append(item);
  }
}

window.addEventListener("contextmenu", (event) => {
  closeFromInput(event);
});

window.addEventListener("pointerdown", closeFromInput, true);
window.addEventListener("mousedown", closeFromInput, true);
window.addEventListener("click", closeFromInput, true);

window.addEventListener(
  "mousemove",
  (event) => {
    if (meaningfulPointerMove(event)) closeFromInput(event);
  },
  true,
);

window.addEventListener(
  "wheel",
  (event) => {
    if (meaningfulWheel(event)) closeFromInput(event);
  },
  true,
);

window.addEventListener("keydown", (event) => {
  const modified = event.metaKey || event.ctrlKey || event.altKey;
  if (event.code === flightKey && !modified) {
    event.preventDefault();
    event.stopImmediatePropagation();
    showFlightUnavailable();
    return;
  }

  if (event.key === "Escape" || event.code === exitKey || !modified) {
    closeFromInput(event);
  }
});

window.addEventListener("online", () => {
  upgradeStatus.textContent = "Internet detected · checking PlanetsOOO";
  void tryUpgradeOnline();
});

notifyReady();
buildOrbitField();
applyTourStop(tourIndex);
window.setInterval(nextTourStop, 8_500);
window.setInterval(() => void tryUpgradeOnline(), UPGRADE_CHECK_MS);
void tryUpgradeOnline();
