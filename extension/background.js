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

let screensaverTabId = null;
let screensaverWindowId = null;
let screensaverInstances = [];
let previousWindowState = "normal";
let fullscreenRetryTimer = null;
let fullscreenRecoveryTimer = null;
const lastFullscreenRequestAt = new Map();
let screensaverFlightMode = false;

const FULLSCREEN_CHECK_DELAY_MS = 3200;
const FULLSCREEN_RECOVERY_DELAY_MS = 450;
const FULLSCREEN_REQUEST_COOLDOWN_MS = 2500;

function promisifyChrome(fn, ...args) {
  return new Promise((resolve, reject) => {
    fn(...args, (result) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(result);
    });
  });
}

function windowsGetLastFocused(options = {}) {
  return promisifyChrome(chrome.windows.getLastFocused, options);
}

function windowsCreate(options) {
  return promisifyChrome(chrome.windows.create, options);
}

function windowsUpdate(windowId, options) {
  return promisifyChrome(chrome.windows.update, windowId, options);
}

function windowsGet(windowId) {
  return promisifyChrome(chrome.windows.get, windowId);
}

function tabsCreate(options) {
  return promisifyChrome(chrome.tabs.create, options);
}

function tabsGet(tabId) {
  return promisifyChrome(chrome.tabs.get, tabId);
}

function tabsRemove(tabId) {
  return promisifyChrome(chrome.tabs.remove, tabId);
}

function tabsQuery(queryInfo) {
  return promisifyChrome(chrome.tabs.query, queryInfo);
}

function displaysGetInfo() {
  if (!chrome.system?.display?.getInfo) return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    chrome.system.display.getInfo((displays) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(displays);
    });
  });
}

async function saveDebug(info) {
  try {
    await chrome.storage.local.set({
      lastRun: { ...info, at: new Date().toISOString() },
    });
  } catch {
    // Debug writes should never block screensaver behavior.
  }
}

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

async function applyIdleInterval() {
  const settings = await getSettings();
  if (!settings.enabled) return;
  const seconds = Math.max(15, Math.round(Number(settings.idleMinutes) * 60));
  chrome.idle.setDetectionInterval(seconds);
}

async function requestWindowFullscreen(windowId, { focus = false } = {}) {
  const before = await windowsGet(windowId);
  if (before?.state === "fullscreen") return "fullscreen";

  const now = Date.now();
  const lastRequestAt = lastFullscreenRequestAt.get(windowId) ?? 0;
  if (now - lastRequestAt < FULLSCREEN_REQUEST_COOLDOWN_MS) {
    return before?.state || "unknown";
  }
  lastFullscreenRequestAt.set(windowId, now);

  if (focus && !before?.focused) {
    await windowsUpdate(windowId, { focused: true });
  }
  await windowsUpdate(windowId, { state: "fullscreen" });
  const updated = await windowsGet(windowId);
  return updated.state || "fullscreen";
}

function clearFullscreenRetry() {
  if (fullscreenRetryTimer != null) {
    clearTimeout(fullscreenRetryTimer);
    fullscreenRetryTimer = null;
  }
  if (fullscreenRecoveryTimer != null) {
    clearTimeout(fullscreenRecoveryTimer);
    fullscreenRecoveryTimer = null;
  }
}

function scheduleFullscreenCheck(windowId) {
  clearFullscreenRetry();

  fullscreenRetryTimer = setTimeout(() => {
    fullscreenRetryTimer = null;
    void windowsGet(windowId).then((win) => {
      if (win?.state === "fullscreen") return;
      return requestWindowFullscreen(windowId);
    }).catch(() => {});
  }, FULLSCREEN_CHECK_DELAY_MS);
}

async function enterScreensaverFullscreen(windowId) {
  const state = await requestWindowFullscreen(windowId, { focus: true });
  if (state !== "fullscreen") {
    scheduleFullscreenCheck(windowId);
  }
  return state;
}

function scheduleFullscreenRecovery(windowId) {
  if (windowId == null || !isScreensaverWindowId(windowId)) return;
  if (fullscreenRecoveryTimer != null) return;

  fullscreenRecoveryTimer = setTimeout(() => {
    fullscreenRecoveryTimer = null;
    if (!isScreensaverWindowId(windowId)) return;

    void windowsGet(windowId).then((win) => {
      if (!win || win.state === "fullscreen") return;
      return requestWindowFullscreen(windowId);
    }).catch(() => {});
  }, FULLSCREEN_RECOVERY_DELAY_MS);
}

function setScreensaverInstances(instances) {
  screensaverInstances = instances;
  screensaverWindowId = instances[0]?.windowId ?? null;
  screensaverTabId = instances[0]?.tabId ?? null;
}

function isScreensaverWindowId(windowId) {
  return screensaverInstances.some((instance) => instance.windowId === windowId);
}

function isScreensaverTabId(tabId) {
  return screensaverInstances.some((instance) => instance.tabId === tabId);
}

function isScreensaverUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const screensaver = parsed.searchParams.get("screensaver");
    return (
      (parsed.hostname === "www.planets.ooo" ||
        parsed.hostname === "planets.ooo" ||
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1") &&
      (screensaver === "1" || screensaver === "true")
    );
  } catch {
    return false;
  }
}

function removeScreensaverInstance(match) {
  screensaverInstances = screensaverInstances.filter((instance) => {
    if (match.tabId != null && instance.tabId === match.tabId) return false;
    if (match.windowId != null && instance.windowId === match.windowId) return false;
    return true;
  });
  screensaverWindowId = screensaverInstances[0]?.windowId ?? null;
  screensaverTabId = screensaverInstances[0]?.tabId ?? null;
  if (screensaverInstances.length === 0) {
    clearScreensaverTracking();
  }
}

async function restoreExistingScreensaverInstances() {
  const tabs = await tabsQuery({});
  const instances = tabs
    .filter((tab) => tab.id != null && tab.windowId != null && isScreensaverUrl(tab.url))
    .map((tab, index) => ({
      tabId: tab.id,
      windowId: tab.windowId,
      displayId: `existing-${tab.windowId}`,
      displayName: index === 0 ? "Existing screensaver" : `Existing screensaver ${index + 1}`,
    }));

  if (instances.length === 0) return false;

  setScreensaverInstances(instances);
  for (const instance of instances) {
    await enterScreensaverFullscreen(instance.windowId);
  }
  return true;
}

function clearScreensaverTracking() {
  screensaverTabId = null;
  screensaverWindowId = null;
  screensaverInstances = [];
  screensaverFlightMode = false;
  lastFullscreenRequestAt.clear();
  clearFullscreenRetry();
}

async function restoreScreensaverWindowState(windowId) {
  if (windowId == null) return;
  try {
    const win = await windowsGet(windowId);
    if (!win) return;
    if (win.state === previousWindowState) return;

    // macOS fullscreen Space transitions visibly if we force this immediately.
    if (win.state === "fullscreen") {
      await windowsUpdate(windowId, { state: "normal" });
      if (previousWindowState === "maximized") {
        setTimeout(() => {
          void windowsUpdate(windowId, { state: "maximized" }).catch(() => {});
        }, 700);
      }
      return;
    }

    await windowsUpdate(windowId, { state: previousWindowState || "normal" });
  } catch {
    // Window may already be closed.
  }
}

function buildPlanetsUrl(settings) {
  try {
    const base = settings.siteUrl?.trim() || DEFAULTS.siteUrl;
    const url = new URL(base.includes("://") ? base : `https://${base}`);
    url.searchParams.set("screensaver", "1");
    url.searchParams.set("flightKey", settings.flightKey || DEFAULTS.flightKey);
    url.searchParams.set("exitKey", settings.exitKey || settings.flightKey || DEFAULTS.exitKey);
    return url.toString();
  } catch {
    const url = new URL(DEFAULTS.siteUrl);
    url.searchParams.set("screensaver", "1");
    url.searchParams.set("flightKey", DEFAULTS.flightKey);
    url.searchParams.set("exitKey", DEFAULTS.exitKey);
    return url.toString();
  }
}

function getScreensaverUrl(settings) {
  return buildPlanetsUrl(settings);
}

function displayLabel(display, index) {
  return display.name || `Display ${index + 1}`;
}

async function getSelectedDisplays(settings) {
  const displays = await displaysGetInfo();
  const selectedIds = Array.isArray(settings.displayIds) ? settings.displayIds : [];
  const selected = displays.filter((display) => selectedIds.includes(display.id));

  if (selected.length > 0) return selected;

  const primary = displays.find((display) => display.isPrimary);
  return primary ? [primary] : displays.slice(0, 1);
}

function hasMirroredBounds(displays) {
  if (displays.length <= 1) return false;
  const bounds = new Set(
    displays.map((display) => {
      const b = display.bounds;
      return `${b.left}:${b.top}:${b.width}:${b.height}`;
    }),
  );
  return bounds.size < displays.length;
}

async function getTargetWindow() {
  try {
    return await windowsGetLastFocused({ populate: false, windowTypes: ["normal"] });
  } catch {
    return null;
  }
}

async function focusExistingScreensaver() {
  if (screensaverInstances.length === 0) {
    return restoreExistingScreensaverInstances();
  }

  try {
    await Promise.all(
      screensaverInstances.map(async (instance) => {
        await tabsGet(instance.tabId);
        await enterScreensaverFullscreen(instance.windowId);
      }),
    );
    return true;
  } catch {
    clearScreensaverTracking();
    return restoreExistingScreensaverInstances();
  }
}

async function openScreensaver({ preview = false } = {}) {
  const settings = await getSettings();
  if (!preview && !settings.enabled) {
    const result = { ok: false, error: "Screensaver is disabled." };
    await saveDebug(result);
    return result;
  }

  if (await focusExistingScreensaver()) {
    const result = { ok: true, focused: true, state: "fullscreen" };
    await saveDebug(result);
    return result;
  }

  const url = getScreensaverUrl(settings);
  const displays = await getSelectedDisplays(settings);
  const displayWarning =
    displays.length === 0
      ? "Display selection is unavailable in this Chrome build; using the current display."
      : hasMirroredBounds(displays)
        ? "Selected displays appear mirrored. Use the OS display settings to extend displays before selecting more than one monitor."
        : null;

  try {
    const instances = [];

    if (displays.length === 0) {
      const targetWindow = await getTargetWindow();
      if (targetWindow?.id != null) {
        const tab = await tabsCreate({
          windowId: targetWindow.id,
          url,
          active: true,
        });
        const tabId = tab.id ?? null;
        if (tabId == null) throw new Error("No screensaver tab was created.");

        instances.push({
          windowId: targetWindow.id,
          tabId,
          displayId: "current",
          displayName: "Current display",
        });
      } else {
        const win = await windowsCreate({
          url,
          type: "normal",
          state: "fullscreen",
          focused: true,
        });
        const windowId = win.id ?? null;
        const tabId = win.tabs?.[0]?.id ?? null;
        if (windowId == null || tabId == null) {
          throw new Error("No screensaver window was created.");
        }

        instances.push({
          windowId,
          tabId,
          displayId: "current",
          displayName: "Current display",
        });
      }
    }

    for (const [index, display] of displays.entries()) {
      const bounds = display.bounds;
      const win = await windowsCreate({
        url,
        type: "normal",
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
        focused: index === 0,
      });

      const windowId = win.id ?? null;
      const tabId = win.tabs?.[0]?.id ?? null;
      if (windowId == null || tabId == null) continue;

      instances.push({
        windowId,
        tabId,
        displayId: display.id,
        displayName: displayLabel(display, index),
      });
    }

    if (instances.length === 0) {
      throw new Error("No display windows could be created.");
    }

    setScreensaverInstances(instances);
    screensaverFlightMode = false;
    previousWindowState = "normal";

    for (const instance of instances) {
      await enterScreensaverFullscreen(instance.windowId);
    }

    const result = {
      ok: true,
      url,
      windowIds: instances.map((instance) => instance.windowId),
      tabIds: instances.map((instance) => instance.tabId),
      state: "fullscreen",
      mode: "display-windows",
      source: settings.source,
      displays: instances.map((instance) => instance.displayName),
      warning: displayWarning,
    };
    await saveDebug(result);
    return result;
  } catch (err) {
    clearScreensaverTracking();
    const result = {
      ok: false,
      url,
      error: err instanceof Error ? err.message : String(err),
    };
    await saveDebug(result);
    return result;
  }
}

async function closeScreensaver(fallback = {}) {
  const instances =
    screensaverInstances.length > 0
      ? [...screensaverInstances]
      : [{ tabId: fallback.tabId ?? null, windowId: fallback.windowId ?? null }];

  clearScreensaverTracking();

  for (const instance of instances) {
    if (instance.tabId != null) {
      try {
        await tabsRemove(instance.tabId);
      } catch {
        // It may already be closed.
      }
    }

    if (instance.windowId != null) {
      try {
        const settings = await getSettings();
        if (settings.restoreWindowState) {
          await restoreScreensaverWindowState(instance.windowId);
        }
      } catch {
        // Window may already be closed.
      }
    }
  }

  return { ok: true };
}

chrome.idle.onStateChanged.addListener((state) => {
  if (state === "idle") {
    void openScreensaver();
    return;
  }

  if (state === "active") {
    void getSettings().then((settings) => {
      if (settings.closeOnActive && !screensaverFlightMode) void closeScreensaver();
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (isScreensaverTabId(tabId)) {
    removeScreensaverInstance({ tabId });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!isScreensaverTabId(tabId)) return;
  if (changeInfo.status !== "complete") return;
  // Do not re-request fullscreen on tab completion. The PlanetsOOO app can
  // update during scenic leg changes, and redundant fullscreen requests make
  // Chrome/macOS flash the fullscreen transition and Esc notice again.
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (isScreensaverWindowId(windowId)) {
    removeScreensaverInstance({ windowId });
  }
});

if (chrome.windows.onBoundsChanged) {
  chrome.windows.onBoundsChanged.addListener((win) => {
    if (!isScreensaverWindowId(win.id)) return;
    if (win.state === "fullscreen") return;
    scheduleFullscreenRecovery(win.id);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  void applyIdleInterval();
});

chrome.runtime.onStartup.addListener(() => {
  void applyIdleInterval();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (changes.enabled || changes.idleMinutes) {
    void applyIdleInterval();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "preview") {
    openScreensaver({ preview: true }).then(sendResponse);
    return true;
  }

  if (message?.type === "close") {
    closeScreensaver({
      tabId: _sender?.tab?.id,
      windowId: _sender?.tab?.windowId,
    }).then(sendResponse);
    return true;
  }

  if (message?.type === "screensaver-flight-entered") {
    if (isScreensaverTabId(_sender?.tab?.id)) {
      screensaverFlightMode = true;
    }
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "screensaver-page-ready") {
    const tabId = _sender?.tab?.id;
    const windowId = _sender?.tab?.windowId;
    if (tabId != null && windowId != null && !isScreensaverTabId(tabId)) {
      setScreensaverInstances([
        ...screensaverInstances,
        {
          tabId,
          windowId,
          displayId: `registered-${windowId}`,
          displayName: "Registered screensaver",
        },
      ]);
    }
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "status") {
    Promise.all([getSettings(), chrome.storage.local.get("lastRun")]).then(
      ([settings, local]) => {
        sendResponse({
          ok: true,
          enabled: settings.enabled,
          idleMinutes: settings.idleMinutes,
          source: settings.source,
          siteUrl: settings.siteUrl,
          displayIds: settings.displayIds,
          flightKey: settings.flightKey,
          exitKey: settings.exitKey,
          running: screensaverInstances.length > 0,
          flightMode: screensaverFlightMode,
          lastRun: local.lastRun ?? null,
        });
      },
    );
    return true;
  }
});
