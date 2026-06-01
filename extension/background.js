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

let screensaverTabId = null;
let screensaverWindowId = null;
let previousWindowState = "normal";
let fullscreenRetryTimer = null;
let fullscreenRecoveryTimer = null;
let lastFullscreenRequestAt = 0;
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
  if (now - lastFullscreenRequestAt < FULLSCREEN_REQUEST_COOLDOWN_MS) {
    return before?.state || "unknown";
  }
  lastFullscreenRequestAt = now;

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
  if (windowId == null || windowId !== screensaverWindowId) return;
  if (fullscreenRecoveryTimer != null) return;

  fullscreenRecoveryTimer = setTimeout(() => {
    fullscreenRecoveryTimer = null;
    if (windowId !== screensaverWindowId) return;

    void windowsGet(windowId).then((win) => {
      if (!win || win.state === "fullscreen") return;
      return requestWindowFullscreen(windowId);
    }).catch(() => {});
  }, FULLSCREEN_RECOVERY_DELAY_MS);
}

function clearScreensaverTracking() {
  screensaverTabId = null;
  screensaverWindowId = null;
  screensaverFlightMode = false;
  lastFullscreenRequestAt = 0;
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
  if (settings.source === "builtin") {
    return chrome.runtime.getURL("screensaver.html");
  }
  return buildPlanetsUrl(settings);
}

async function getTargetWindow() {
  try {
    return await windowsGetLastFocused({ populate: false, windowTypes: ["normal"] });
  } catch {
    return null;
  }
}

async function focusExistingScreensaver() {
  if (screensaverTabId == null || screensaverWindowId == null) return false;

  try {
    await tabsGet(screensaverTabId);
    await enterScreensaverFullscreen(screensaverWindowId);
    return true;
  } catch {
    clearScreensaverTracking();
    return false;
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
  const targetWindow = await getTargetWindow();

  try {
    if (targetWindow?.id != null) {
      screensaverWindowId = targetWindow.id;
      screensaverFlightMode = false;
      previousWindowState = targetWindow.state || "normal";

      const tab = await tabsCreate({
        windowId: targetWindow.id,
        url,
        active: true,
      });
      screensaverTabId = tab.id ?? null;

      const state = await enterScreensaverFullscreen(targetWindow.id);
      const updated = await windowsGet(targetWindow.id);

      const result = {
        ok: true,
        url,
        windowId: targetWindow.id,
        tabId: screensaverTabId,
        state: updated.state || state || "fullscreen",
        mode: "current-window",
        source: settings.source,
      };
      await saveDebug(result);
      return result;
    }

    const win = await windowsCreate({
      url,
      type: "normal",
      state: "fullscreen",
      focused: true,
    });

    screensaverWindowId = win.id ?? null;
    screensaverTabId = win.tabs?.[0]?.id ?? null;
    screensaverFlightMode = false;
    previousWindowState = "normal";
    if (screensaverWindowId != null) {
      scheduleFullscreenCheck(screensaverWindowId);
    }

    const result = {
      ok: true,
      url,
      windowId: screensaverWindowId,
      tabId: screensaverTabId,
      state: win.state || "fullscreen",
      mode: "new-window",
      source: settings.source,
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
  const tabId = screensaverTabId ?? fallback.tabId ?? null;
  const windowId = screensaverWindowId ?? fallback.windowId ?? null;

  clearScreensaverTracking();

  if (tabId != null) {
    try {
      await tabsRemove(tabId);
    } catch {
      // It may already be closed.
    }
  }

  if (windowId != null) {
    try {
      const settings = await getSettings();
      if (settings.restoreWindowState) await restoreScreensaverWindowState(windowId);
    } catch {
      // Window may already be closed.
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
  if (tabId === screensaverTabId) {
    clearScreensaverTracking();
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId !== screensaverTabId) return;
  if (changeInfo.status !== "complete") return;
  // Do not re-request fullscreen on tab completion. The PlanetsOOO app can
  // update during scenic leg changes, and redundant fullscreen requests make
  // Chrome/macOS flash the fullscreen transition and Esc notice again.
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === screensaverWindowId) {
    clearScreensaverTracking();
  }
});

if (chrome.windows.onBoundsChanged) {
  chrome.windows.onBoundsChanged.addListener((win) => {
    if (win.id !== screensaverWindowId) return;
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
    if (_sender?.tab?.id === screensaverTabId) {
      screensaverFlightMode = true;
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
          flightKey: settings.flightKey,
          exitKey: settings.exitKey,
          running: screensaverTabId != null,
          flightMode: screensaverFlightMode,
          lastRun: local.lastRun ?? null,
        });
      },
    );
    return true;
  }
});
