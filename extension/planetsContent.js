const DEFAULTS = {
  flightKey: "Backquote",
  exitKey: "Backquote",
};
const POINTER_NOISE_EPSILON = 2;
const WHEEL_NOISE_EPSILON = 1;
const LUDICROUS_SPEED_MULTIPLIER = 100;
const DEFAULT_SPEED_TRACKER_DETAIL = {
  active: true,
  speedKmPerSec: 0,
  lightspeedMultiple: 0,
  speedUnit: "kph",
};

function isScreensaverPage() {
  const params = new URLSearchParams(window.location.search);
  const value = params.get("screensaver");
  return value === "1" || value === "true";
}

function configuredFlightKey(settings) {
  const params = new URLSearchParams(window.location.search);
  return params.get("flightKey")?.trim() || settings.flightKey || DEFAULTS.flightKey;
}

function configuredExitKey(settings, flightKey) {
  const params = new URLSearchParams(window.location.search);
  return params.get("exitKey")?.trim() || settings.exitKey || flightKey || DEFAULTS.exitKey;
}

function flightEnabled() {
  const value = new URLSearchParams(window.location.search).get("flight");
  return value == null || value === "1" || value === "true";
}

function closeScreensaver() {
  void chrome.runtime.sendMessage({ type: "close" });
}

function notifyFlightModeEntered() {
  void chrome.runtime.sendMessage({ type: "screensaver-flight-entered" });
}

function notifyFlightModeExited() {
  void chrome.runtime.sendMessage({ type: "screensaver-flight-exited" });
}

function notifyScreensaverReady() {
  void chrome.runtime.sendMessage({ type: "screensaver-page-ready" });
}

function formatSpeedMultiple(multiple) {
  if (multiple >= 100) return `${Math.round(multiple)}×`;
  if (multiple >= 10) return `${Math.round(multiple)}×`;
  if (multiple >= 1) return `${multiple.toFixed(1)}×`;
  return `${multiple.toFixed(2)}×`;
}

function speedTrackerLines(detail) {
  const multiple = Number(detail?.lightspeedMultiple || 0);
  const showCMultiple = multiple >= 0.95;
  const ludicrous = multiple >= LUDICROUS_SPEED_MULTIPLIER * 0.95;

  if (showCMultiple) {
    return {
      mode: ludicrous ? "ludicrous" : "lightspeed",
      heading: ludicrous ? "LUDICROUS" : "LIGHTSPEED",
      value: `${formatSpeedMultiple(multiple)} c`,
    };
  }

  const kmPerSec = Number(detail?.speedKmPerSec || 0);
  const speedUnit = detail?.speedUnit === "mph" ? "mph" : "kph";
  const value =
    speedUnit === "kph" ? kmPerSec * 3600 : kmPerSec * 2236.9362920544;

  return {
    mode: "normal",
    heading: "",
    value: `${Math.max(0, value).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })} ${speedUnit === "kph" ? "km/h" : "mph"}`,
  };
}

function ensureSpeedTracker() {
  let el = document.getElementById("orbit-extension-speed-tracker");
  if (el) return el;
  if (!document.body) return null;

  el = document.createElement("div");
  el.id = "orbit-extension-speed-tracker";
  el.setAttribute("aria-live", "polite");
  Object.assign(el.style, {
    position: "fixed",
    top: "1.25rem",
    right: "3.5rem",
    zIndex: "2147483647",
    color: "rgba(82, 82, 91, 0.8)",
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    fontSize: "10px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: "1.25",
    opacity: "0",
    pointerEvents: "none",
    textAlign: "right",
    transition: "opacity 240ms ease",
    userSelect: "none",
  });
  document.body.append(el);
  return el;
}

function renderSpeedTracker(detail) {
  const el = ensureSpeedTracker();
  if (!el) return;

  const lines = speedTrackerLines(detail);
  el.replaceChildren();

  if (lines.heading) {
    const heading = document.createElement("p");
    heading.textContent = lines.heading;
    Object.assign(heading.style, {
      margin: "0 0 2px",
      color:
        lines.mode === "ludicrous"
          ? "rgba(232, 121, 249, 0.95)"
          : "rgba(56, 189, 248, 0.9)",
      letterSpacing: "0.05em",
    });
    el.append(heading);
  }

  const value = document.createElement("p");
  value.textContent = lines.value;
  Object.assign(value.style, {
    margin: "0",
    color:
      lines.mode === "ludicrous"
        ? "rgba(240, 171, 252, 0.8)"
        : lines.mode === "lightspeed"
          ? "rgba(125, 211, 252, 0.75)"
          : "inherit",
  });
  el.append(value);
}

function setSpeedTrackerVisible(visible, detail) {
  const el = ensureSpeedTracker();
  if (!el) return;
  if (detail) renderSpeedTracker(detail);
  el.style.opacity = visible ? "1" : "0";
}

if (isScreensaverPage()) {
  notifyScreensaverReady();

  chrome.storage.sync.get(DEFAULTS, (settings) => {
    const flightKey = configuredFlightKey(settings);
    const exitKey = configuredExitKey(settings, flightKey);
    const canUseFlight = flightEnabled();
    let flightMode = false;

    window.addEventListener("orbit-screensaver-flight-mode", (event) => {
      flightMode = Boolean(event.detail?.active);
      if (flightMode) {
        notifyFlightModeEntered();
      } else {
        notifyFlightModeExited();
      }
      setSpeedTrackerVisible(
        flightMode,
        flightMode ? DEFAULT_SPEED_TRACKER_DETAIL : undefined,
      );
    });

    window.addEventListener("orbit-screensaver-speed", (event) => {
      const active = Boolean(event.detail?.active);
      if (!flightMode || !active) {
        setSpeedTrackerVisible(false);
        return;
      }
      setSpeedTrackerVisible(true, event.detail);
    });

    window.addEventListener(
      "keydown",
      (event) => {
        const modified = event.metaKey || event.ctrlKey || event.altKey;

        if (
          event.key?.toLowerCase() === "l" &&
          !modified &&
          (flightMode || (canUseFlight && event.code === flightKey))
        ) {
          return;
        }

        if (canUseFlight && !flightMode && event.code === flightKey && !modified) {
          flightMode = true;
          notifyFlightModeEntered();
          setSpeedTrackerVisible(true, DEFAULT_SPEED_TRACKER_DETAIL);
          return;
        }

        if (flightMode) {
          if (event.code === exitKey && !modified) {
            return;
          }
          return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        closeScreensaver();
      },
      true,
    );

    const closeOnPointer = (event) => {
      if (flightMode) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeScreensaver();
    };

    const closeOnMeaningfulMouseMove = (event) => {
      if (flightMode) return;
      const movement =
        Math.abs(event.movementX || 0) + Math.abs(event.movementY || 0);
      if (movement < POINTER_NOISE_EPSILON) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeScreensaver();
    };

    const closeOnMeaningfulWheel = (event) => {
      if (flightMode) return;
      const movement =
        Math.abs(event.deltaX || 0) +
        Math.abs(event.deltaY || 0) +
        Math.abs(event.deltaZ || 0);
      if (movement < WHEEL_NOISE_EPSILON) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeScreensaver();
    };

    window.addEventListener("pointerdown", closeOnPointer, true);
    window.addEventListener("mousedown", closeOnPointer, true);
    window.addEventListener("click", closeOnPointer, true);
    window.addEventListener("contextmenu", closeOnPointer, true);
    window.addEventListener("mousemove", closeOnMeaningfulMouseMove, true);
    window.addEventListener("wheel", closeOnMeaningfulWheel, {
      capture: true,
      passive: false,
    });
  });
}
