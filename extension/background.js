const DEFAULTS = {
  enabled: true,
  idleMinutes: 5,
  source: "planets",
  siteUrl: "https://www.planets.ooo/",
  flightKey: "Backquote",
  exitGesture: "contextmenu",
  closeOnActive: false,
  restoreWindowState: true,
};

let screensaverTabId = null;
let screensaverWindowId = null;
let previousWindowState = "normal";
let fullscreenRetryTimer = null;

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

async function requestWindowFullscreen(windowId) {
  await windowsUpdate(windowId, { focused: true });
  await windowsUpdate(windowId, { state: "fullscreen" });
  const updated = await windowsGet(windowId);
  return updated.state || "fullscreen";
}

function scheduleFullscreenRetries(windowId) {
  if (fullscreenRetryTimer != null) {
    clearInterval(fullscreenRetryTimer);
    fullscreenRetryTimer = null;
  }

  let attempts = 0;
  fullscreenRetryTimer = setInterval(() => {
    attempts += 1;
    void requestWindowFullscreen(windowId).catch(() => {});
    if (attempts >= 8) {
      clearInterval(fullscreenRetryTimer);
      fullscreenRetryTimer = null;
    }
  }, 500);
}

function buildPlanetsUrl(settings) {
  try {
    const base = settings.siteUrl?.trim() || DEFAULTS.siteUrl;
    const url = new URL(base.includes("://") ? base : `https://${base}`);
    url.searchParams.set("screensaver", "1");
    url.searchParams.set("flightKey", settings.flightKey || DEFAULTS.flightKey);
    url.searchParams.set("exit", settings.exitGesture || DEFAULTS.exitGesture);
    return url.toString();
  } catch {
    const url = new URL(DEFAULTS.siteUrl);
    url.searchParams.set("screensaver", "1");
    url.searchParams.set("flightKey", DEFAULTS.flightKey);
    url.searchParams.set("exit", DEFAULTS.exitGesture);
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
    await requestWindowFullscreen(screensaverWindowId);
    scheduleFullscreenRetries(screensaverWindowId);
    return true;
  } catch {
    screensaverTabId = null;
    screensaverWindowId = null;
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
      previousWindowState = targetWindow.state || "normal";

      const tab = await tabsCreate({
        windowId: targetWindow.id,
        url,
        active: true,
      });
      screensaverTabId = tab.id ?? null;

      const state = await requestWindowFullscreen(targetWindow.id);
      scheduleFullscreenRetries(targetWindow.id);
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
    previousWindowState = "normal";
    if (screensaverWindowId != null) {
      scheduleFullscreenRetries(screensaverWindowId);
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
    screensaverTabId = null;
    screensaverWindowId = null;
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

  screensaverTabId = null;
  screensaverWindowId = null;
  if (fullscreenRetryTimer != null) {
    clearInterval(fullscreenRetryTimer);
    fullscreenRetryTimer = null;
  }

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
      if (settings.restoreWindowState) {
        await windowsUpdate(windowId, { state: previousWindowState || "normal" });
      }
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
      if (settings.closeOnActive) void closeScreensaver();
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === screensaverTabId) {
    screensaverTabId = null;
    screensaverWindowId = null;
    if (fullscreenRetryTimer != null) {
      clearInterval(fullscreenRetryTimer);
      fullscreenRetryTimer = null;
    }
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId !== screensaverTabId) return;
  if (changeInfo.status !== "complete") return;
  if (screensaverWindowId == null) return;
  void requestWindowFullscreen(screensaverWindowId).catch(() => {});
  scheduleFullscreenRetries(screensaverWindowId);
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === screensaverWindowId) {
    screensaverTabId = null;
    screensaverWindowId = null;
    if (fullscreenRetryTimer != null) {
      clearInterval(fullscreenRetryTimer);
      fullscreenRetryTimer = null;
    }
  }
});

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
          exitGesture: settings.exitGesture,
          running: screensaverTabId != null,
          lastRun: local.lastRun ?? null,
        });
      },
    );
    return true;
  }
});
