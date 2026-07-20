const DEFAULTS = {
  enabled: true,
  idleMinutes: 5,
  source: "planets",
  siteUrl: "https://www.planets.ooo/",
  displayIds: [],
  allowMultipleDisplays: false,
  plan: "basic",
  flightKey: "Backquote",
  exitKey: "Backquote",
  closeOnActive: false,
};

// Dev-only Premium bypass; package-extension.mjs sets false in store zips.
const ALLOW_ADMIN_PREMIUM_OVERRIDE = true;

const form = document.getElementById("settings");
const enabledEl = document.getElementById("enabled");
const idleMinutesEl = document.getElementById("idleMinutes");
const idleMinutesLabel = document.getElementById("idleMinutesLabel");
const displayListEl = document.getElementById("displayList");
const allowMultipleDisplaysEl = document.getElementById("allowMultipleDisplays");
const flightSectionEl = document.getElementById("flightSection");
const flightKeyEl = document.getElementById("flightKey");
const exitKeyEl = document.getElementById("exitKey");
const closeOnActiveEl = document.getElementById("closeOnActive");
const premiumLinkEl = document.getElementById("premiumLink");
const premiumStatusEl = document.getElementById("premiumStatus");
const accountNoticeEl = document.getElementById("accountNotice");
const accountLinkEl = document.getElementById("accountLink");
const extensionLinkEl = document.getElementById("extensionLink");
const saveBtn = document.getElementById("save");
const previewBtn = document.getElementById("preview");
const closeBtn = document.getElementById("close");
const legalYearEl = document.getElementById("legalYear");
let currentPlan = DEFAULTS.plan;

if (legalYearEl) {
  legalYearEl.textContent = String(new Date().getFullYear());
}

async function updatePremiumLink() {
  if (!premiumLinkEl) return;
  const installId = await getPremiumInstallId();
  const chromeGaiaId = await getChromeGaiaId();
  const url = new URL("/premium", DEFAULTS.siteUrl);
  url.searchParams.set("extensionId", chrome.runtime.id);
  url.searchParams.set("installId", installId);
  if (chromeGaiaId) url.searchParams.set("chromeGaiaId", chromeGaiaId);
  premiumLinkEl.href = url.toString();
}

async function updateAccountLinks() {
  const installId = await getPremiumInstallId();
  if (accountLinkEl) {
    accountLinkEl.href = new URL("/account", DEFAULTS.siteUrl).toString();
  }
  if (extensionLinkEl) {
    const url = new URL("/auth/extension", DEFAULTS.siteUrl);
    url.searchParams.set("extensionId", chrome.runtime.id);
    url.searchParams.set("installId", installId);
    extensionLinkEl.href = url.toString();
  }
}

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

function isPremium(settings) {
  return settings.plan === "premium";
}

function applyPlanState(settings) {
  const premium = isPremium(settings);
  flightSectionEl.classList.toggle("is-basic", !premium);
  flightKeyEl.disabled = !premium;
  exitKeyEl.disabled = !premium;
  if (accountNoticeEl) accountNoticeEl.hidden = !premium;
}

async function loadSettings() {
  const settings = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
  const local = await chrome.storage.local.get(
    ALLOW_ADMIN_PREMIUM_OVERRIDE
      ? { adminPremiumOverride: false, premiumEntitlement: "" }
      : { premiumEntitlement: "" },
  );
  const displays = await getDisplays();
  const hasEntitlement =
    typeof local.premiumEntitlement === "string" &&
    local.premiumEntitlement.length > 0;
  currentPlan =
    (ALLOW_ADMIN_PREMIUM_OVERRIDE && local.adminPremiumOverride) ||
    (settings.plan === "premium" && hasEntitlement)
      ? "premium"
      : "basic";

  enabledEl.checked = settings.enabled;
  idleMinutesEl.value = String(settings.idleMinutes);
  idleMinutesLabel.textContent = formatIdleLabel(settings.idleMinutes);
  renderDisplays(displays, settings.displayIds);
  allowMultipleDisplaysEl.checked = Boolean(settings.allowMultipleDisplays);
  flightKeyEl.value = settings.flightKey;
  exitKeyEl.value = settings.exitKey || settings.flightKey;
  closeOnActiveEl.checked = settings.closeOnActive;
  applyPlanState({ ...settings, plan: currentPlan });
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
    allowMultipleDisplays: allowMultipleDisplaysEl.checked,
    plan: currentPlan,
    flightKey: flightKeyEl.value,
    exitKey: exitKeyEl.value,
    idleMinutes: Number(idleMinutesEl.value),
    closeOnActive: closeOnActiveEl.checked,
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

premiumLinkEl?.addEventListener("click", async (event) => {
  event.preventDefault();
  try {
    await updatePremiumLink();
    // Premium click is the only intentional OAuth moment: restore if owned,
    // otherwise open checkout (consent may appear once for this extension).
    setPremiumStatus("Checking Premium…", "muted");
    let restoreResult = null;
    try {
      restoreResult = await chrome.runtime.sendMessage({
        type: "restore-premium",
        interactive: true,
      });
    } catch {
      // Service worker may not be ready yet.
    }
    await loadSettings();
    if (restoreResult?.restored || currentPlan === "premium") {
      const status = premiumStatusMessage(currentPlan, restoreResult);
      setPremiumStatus(status.text, status.tone);
      return;
    }

    const chromeGaiaId = await getChromeGaiaId();
    if (!chromeGaiaId) {
      setPremiumStatus("Sign into Chrome to purchase Premium.", "warn");
      return;
    }
    const result = await chrome.runtime.sendMessage({
      type: "open-premium-checkout",
      url: premiumLinkEl.href,
    });
    if (!result?.ok) {
      setPremiumStatus(result?.error ?? "Unable to open Premium.", "warn");
      return;
    }
    setPremiumStatus(
      restoreResult?.needsAuth
        ? "Complete Chrome access if prompted, then finish checkout."
        : "Complete checkout to unlock flight on this install.",
      "muted",
    );
  } catch (err) {
    setPremiumStatus(
      err instanceof Error ? err.message : "Unable to open Premium.",
      "warn",
    );
  }
});

function setPremiumStatus(message, tone = "ok") {
  if (!premiumStatusEl) return;
  if (!message) {
    premiumStatusEl.hidden = true;
    premiumStatusEl.textContent = "";
    premiumStatusEl.classList.remove("is-warn", "is-muted");
    return;
  }
  premiumStatusEl.hidden = false;
  premiumStatusEl.textContent = message;
  premiumStatusEl.classList.toggle("is-warn", tone === "warn");
  premiumStatusEl.classList.toggle("is-muted", tone === "muted");
}

function premiumStatusMessage(plan, restoreResult) {
  if (restoreResult?.restored) {
    return { text: "Premium restored for this Chrome install.", tone: "ok" };
  }
  if (plan === "premium") {
    return { text: "Premium active on this install.", tone: "ok" };
  }
  if (restoreResult?.error === "No Premium purchase found for this Chrome profile.") {
    return {
      text: "No Premium purchase on this Chrome profile.",
      tone: "muted",
    };
  }
  if (restoreResult?.needsAuth) {
    return {
      text: "Premium unlocks after purchase. Reinstalls restore when you open Premium.",
      tone: "muted",
    };
  }
  if (restoreResult?.ok === false && restoreResult?.error) {
    return { text: restoreResult.error, tone: "warn" };
  }
  return {
    text: "Purchase Premium to unlock flight. Reinstalls restore automatically when possible.",
    tone: "muted",
  };
}

async function refreshPremiumStatus() {
  let restoreResult = null;
  try {
    // Silent only — never open Google consent on popup open / install.
    restoreResult = await chrome.runtime.sendMessage({
      type: "restore-premium",
      interactive: false,
    });
  } catch {
    // Popup may open before the service worker is ready.
  }
  await loadSettings();
  const status = premiumStatusMessage(currentPlan, restoreResult);
  setPremiumStatus(status.text, status.tone);
}

void updatePremiumLink();
void updateAccountLinks();
void refreshPremiumStatus();
