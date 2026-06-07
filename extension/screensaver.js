const POINTER_NOISE_EPSILON = 2;
const WHEEL_NOISE_EPSILON = 1;
const UPGRADE_CHECK_MS = 30_000;

const params = new URLSearchParams(window.location.search);
const flightKey = params.get("flightKey") || "Backquote";
const exitKey = params.get("exitKey") || flightKey;

const focusName = document.getElementById("focusName");
const focusFact = document.getElementById("focusFact");
const system = document.getElementById("system");
const upgradeStatus = document.getElementById("upgradeStatus");
const hint = document.querySelector(".hint");

const tourStops = [
  {
    name: "Sun",
    className: "sun-focus",
    fact: "Offline fallback is running locally from the extension package.",
  },
  {
    name: "Earth",
    className: "earth-focus",
    fact: "The online PlanetsOOO scenic tour will replace this view when reachable.",
  },
  {
    name: "Mars",
    className: "mars-focus",
    fact: "Packaged mode keeps the screensaver usable without a network connection.",
  },
  {
    name: "Saturn",
    className: "saturn-focus",
    fact: "Future offline upgrades can bundle richer local textures and data.",
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
  system.className = `system ${stop.className}`;
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
applyTourStop(tourIndex);
window.setInterval(nextTourStop, 8_500);
window.setInterval(() => void tryUpgradeOnline(), UPGRADE_CHECK_MS);
void tryUpgradeOnline();
