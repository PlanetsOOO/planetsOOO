const DEFAULTS = {
  enabled: true,
  idleMinutes: 5,
  source: "planets",
  siteUrl: "https://www.planets.ooo/",
  flightKey: "Backquote",
  exitKey: "Backquote",
  closeOnActive: false,
  restoreWindowState: true,
};

const form = document.getElementById("form");
const enabledEl = document.getElementById("enabled");
const sourceEl = document.getElementById("source");
const siteUrlEl = document.getElementById("siteUrl");
const siteUrlFieldEl = document.getElementById("siteUrlField");
const flightKeyEl = document.getElementById("flightKey");
const exitKeyEl = document.getElementById("exitKey");
const idleMinutesEl = document.getElementById("idleMinutes");
const idleMinutesLabel = document.getElementById("idleMinutesLabel");
const closeOnActiveEl = document.getElementById("closeOnActive");
const restoreWindowStateEl = document.getElementById("restoreWindowState");
const statusEl = document.getElementById("status");
const previewBtn = document.getElementById("preview");

function formatIdleLabel(minutes) {
  const value = Number(minutes);
  if (value < 1) return `${Math.round(value * 60)} sec`;
  if (Number.isInteger(value)) return `${value} min`;
  return `${value.toFixed(2).replace(/0$/, "")} min`;
}

function setStatus(text, ok = true) {
  statusEl.textContent = text;
  statusEl.dataset.ok = ok ? "1" : "0";
}

function syncSourceFields() {
  siteUrlFieldEl.style.display = sourceEl.value === "planets" ? "grid" : "none";
}

async function loadSettings() {
  const settings = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
  enabledEl.checked = settings.enabled;
  sourceEl.value = settings.source;
  siteUrlEl.value = settings.siteUrl;
  flightKeyEl.value = settings.flightKey;
  exitKeyEl.value = settings.exitKey || settings.flightKey;
  idleMinutesEl.value = String(settings.idleMinutes);
  idleMinutesLabel.textContent = formatIdleLabel(settings.idleMinutes);
  closeOnActiveEl.checked = settings.closeOnActive;
  restoreWindowStateEl.checked = settings.restoreWindowState;
  syncSourceFields();
}

sourceEl.addEventListener("change", syncSourceFields);

idleMinutesEl.addEventListener("input", () => {
  idleMinutesLabel.textContent = formatIdleLabel(idleMinutesEl.value);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  await chrome.storage.sync.set({
    enabled: enabledEl.checked,
    source: sourceEl.value,
    siteUrl: siteUrlEl.value.trim(),
    flightKey: flightKeyEl.value,
    exitKey: exitKeyEl.value,
    idleMinutes: Number(idleMinutesEl.value),
    closeOnActive: closeOnActiveEl.checked,
    restoreWindowState: restoreWindowStateEl.checked,
  });
  setStatus("Saved.");
});

previewBtn.addEventListener("click", async () => {
  setStatus("Opening preview…");
  try {
    const result = await chrome.runtime.sendMessage({ type: "preview" });
    if (result?.ok) {
      setStatus(
        [`Opened in ${result.state ?? "fullscreen"} mode.`, result.url ?? ""]
          .filter(Boolean)
          .join("\n"),
      );
      return;
    }
    setStatus(result?.error ?? "Preview failed.", false);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : "Preview failed.", false);
  }
});

void loadSettings();
