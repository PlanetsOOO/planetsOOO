const DEFAULTS = {
  flightKey: "Backquote",
  exitKey: "Backquote",
};
const POINTER_NOISE_EPSILON = 2;
const WHEEL_NOISE_EPSILON = 1;

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

function closeScreensaver() {
  void chrome.runtime.sendMessage({ type: "close" });
}

function notifyFlightModeEntered() {
  void chrome.runtime.sendMessage({ type: "screensaver-flight-entered" });
}

function notifyScreensaverReady() {
  void chrome.runtime.sendMessage({ type: "screensaver-page-ready" });
}

if (isScreensaverPage()) {
  notifyScreensaverReady();

  chrome.storage.sync.get(DEFAULTS, (settings) => {
    const flightKey = configuredFlightKey(settings);
    const exitKey = configuredExitKey(settings, flightKey);
    let flightMode = false;

    window.addEventListener("orbit-screensaver-flight-mode", (event) => {
      flightMode = Boolean(event.detail?.active);
    });

    window.addEventListener(
      "keydown",
      (event) => {
        const modified = event.metaKey || event.ctrlKey || event.altKey;

        if (event.key?.toLowerCase() === "l" && !modified) {
          return;
        }

        if (!flightMode && event.code === flightKey && !modified) {
          flightMode = true;
          notifyFlightModeEntered();
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
    window.addEventListener("wheel", closeOnMeaningfulWheel, true);
  });
}
