const DEFAULTS = {
  flightKey: "Backquote",
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

function closeScreensaver() {
  void chrome.runtime.sendMessage({ type: "close" });
}

if (isScreensaverPage()) {
  chrome.storage.sync.get(DEFAULTS, (settings) => {
    const flightKey = configuredFlightKey(settings);

    window.addEventListener(
      "keydown",
      (event) => {
        if (event.code === flightKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        closeScreensaver();
      },
      true,
    );

    const closeOnPointer = (event) => {
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
