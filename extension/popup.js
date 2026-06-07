const DEFAULTS = {
  enabled: true,
  idleMinutes: 5,
  source: "planets",
  siteUrl: "https://www.planets.ooo/",
  displayIds: [],
  flightKey: "Backquote",
  exitKey: "Backquote",
  closeOnActive: false,
  restoreWindowState: true,
};

const form = document.getElementById("settings");
const enabledEl = document.getElementById("enabled");
const idleMinutesEl = document.getElementById("idleMinutes");
const idleMinutesLabel = document.getElementById("idleMinutesLabel");
const displayListEl = document.getElementById("displayList");
const flightKeyEl = document.getElementById("flightKey");
const exitKeyEl = document.getElementById("exitKey");
const closeOnActiveEl = document.getElementById("closeOnActive");
const restoreWindowStateEl = document.getElementById("restoreWindowState");
const saveBtn = document.getElementById("save");
const previewBtn = document.getElementById("preview");
const closeBtn = document.getElementById("close");

function formatIdleLabel(minutes) {
  const value = Number(minutes);
  if (value < 1) return `${Math.round(value * 60)} sec`;
  if (Number.isInteger(value)) return `${value} min`;
  return `${value.toFixed(2).replace(/0$/, "")} min`;
}

function displayName(display, index) {
  return display.name || `Display ${index + 1}`;
}

function displayGeometry(display) {
  const bounds = display.bounds;
  return `${bounds.width}×${bounds.height}`;
}

async function getDisplays() {
  if (!chrome.system?.display?.getInfo) return [];
  return new Promise((resolve) => {
    chrome.system.display.getInfo((displays) => resolve(displays));
  });
}

function renderDisplays(displays, selectedIds) {
  displayListEl.textContent = "";

  if (displays.length === 0) {
    displayListEl.textContent = "Using current display.";
    return;
  }

  const selected = new Set(selectedIds?.length ? selectedIds : []);
  if (selected.size === 0) {
    const primary = displays.find((display) => display.isPrimary) ?? displays[0];
    selected.add(primary.id);
  }

  for (const [index, display] of displays.entries()) {
    const label = document.createElement("label");
    label.className = "display-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "displayIds";
    checkbox.value = display.id;
    checkbox.checked = selected.has(display.id);

    const text = document.createElement("span");
    text.textContent = `${displayName(display, index)} · ${displayGeometry(display)}${
      display.isPrimary ? " · primary" : ""
    }`;

    label.append(checkbox, text);
    displayListEl.append(label);
  }
}

function selectedDisplayIds() {
  return Array.from(
    displayListEl.querySelectorAll('input[name="displayIds"]:checked'),
  ).map((input) => input.value);
}

async function loadSettings() {
  const settings = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
  const displays = await getDisplays();

  enabledEl.checked = settings.enabled;
  idleMinutesEl.value = String(settings.idleMinutes);
  idleMinutesLabel.textContent = formatIdleLabel(settings.idleMinutes);
  renderDisplays(displays, settings.displayIds);
  flightKeyEl.value = settings.flightKey;
  exitKeyEl.value = settings.exitKey || settings.flightKey;
  closeOnActiveEl.checked = settings.closeOnActive;
  restoreWindowStateEl.checked = settings.restoreWindowState;
}

async function saveSettings() {
  const displays = selectedDisplayIds();
  const displayInputs = displayListEl.querySelectorAll('input[name="displayIds"]');
  if (displayInputs.length > 0 && displays.length === 0) {
    console.warn("Select at least one display.");
    return false;
  }

  await chrome.storage.sync.set({
    enabled: enabledEl.checked,
    source: DEFAULTS.source,
    siteUrl: DEFAULTS.siteUrl,
    displayIds: displays,
    flightKey: flightKeyEl.value,
    exitKey: exitKeyEl.value,
    idleMinutes: Number(idleMinutesEl.value),
    closeOnActive: closeOnActiveEl.checked,
    restoreWindowState: restoreWindowStateEl.checked,
  });
  return true;
}

idleMinutesEl.addEventListener("input", () => {
  idleMinutesLabel.textContent = formatIdleLabel(idleMinutesEl.value);
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
});

saveBtn.addEventListener("click", async () => {
  const previous = saveBtn.textContent;
  try {
    if (await saveSettings()) {
      saveBtn.textContent = "Saved";
      window.setTimeout(() => {
        saveBtn.textContent = previous;
      }, 900);
    }
  } catch (err) {
    console.warn(err instanceof Error ? err.message : "Save failed.");
  }
});

previewBtn.addEventListener("click", async () => {
  try {
    const saved = await saveSettings();
    if (!saved) return;
    const result = await chrome.runtime.sendMessage({ type: "preview" });
    if (!result?.ok) console.warn(result?.error ?? "Preview failed.");
  } catch (err) {
    console.warn(err instanceof Error ? err.message : "Preview failed.");
  }
});

closeBtn.addEventListener("click", () => {
  window.close();
});

void loadSettings();
