const DEFAULTS = {
  flightKey: "Backquote",
  exitKey: "Backquote",
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

function closeScreensaver() {
  void chrome.runtime.sendMessage({ type: "close" });
}

function notifyFlightModeEntered() {
  void chrome.runtime.sendMessage({ type: "screensaver-flight-entered" });
}

if (isScreensaverPage()) {
  chrome.storage.sync.get(DEFAULTS, (settings) => {
    const flightKey = configuredFlightKey(settings);
    const exitKey = configuredExitKey(settings, flightKey);
    let flightMode = false;

    window.addEventListener(
      "keydown",
      (event) => {
        const modified = event.metaKey || event.ctrlKey || event.altKey;

        if (!flightMode && event.code === flightKey && !modified) {
          flightMode = true;
          notifyFlightModeEntered();
          return;
        }

        if (flightMode) {
          if (event.code === exitKey && !modified) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (event.repeat) return;
            closeScreensaver();
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

    window.addEventListener("pointerdown", closeOnPointer, true);
    window.addEventListener("mousedown", closeOnPointer, true);
    window.addEventListener("click", closeOnPointer, true);
    window.addEventListener("contextmenu", closeOnPointer, true);
  });
}
