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

let screensaverInstances = [];
let fullscreenRetryTimer = null;
let fullscreenRecoveryTimer = null;
const lastFullscreenRequestAt = new Map();
let screensaverFlightMode = false;
let openingScreensaverPromise = null;

const FULLSCREEN_CHECK_DELAY_MS = 3200;
const FULLSCREEN_RECOVERY_DELAY_MS = 450;
const FULLSCREEN_REQUEST_COOLDOWN_MS = 2500;
const ONLINE_PROBE_TIMEOUT_MS = 2500;
const OFFLINE_SCREENSAVER_PAGE = "screensaver.html";
const PREMIUM_VERIFY_PATH = "/api/premium/verify";
const PREMIUM_WINDOW_WIDTH = 420;
const PREMIUM_WINDOW_FALLBACK_HEIGHT = 760;
const PREMIUM_WINDOW_MIN_HEIGHT = 640;

function isPremiumPlan(settings) {
  return settings.plan === "premium";
}

function allowedPremiumSender(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "www.planets.ooo" ||
        parsed.hostname === "planets.ooo")
    );
  } catch {
    return false;
  }
}

function premiumVerifyUrl() {
  return new URL(PREMIUM_VERIFY_PATH, DEFAULTS.siteUrl).toString();
}

function isAllowedPremiumCheckoutUrl(url) {
  if (typeof url !== "string") return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "www.planets.ooo" ||
        parsed.hostname === "planets.ooo") &&
      parsed.pathname === "/premium"
    );
  } catch {
    return false;
  }
}

async function openPremiumCheckoutWindow(url) {
  if (!isAllowedPremiumCheckoutUrl(url)) {
    return { ok: false, error: "Premium checkout URL is not allowed." };
  }

  let focusedWindow = null;
  try {
    focusedWindow = await windowsGetLastFocused();
  } catch {
    // Centering is best-effort; Chrome can still open a focused popup without it.
  }

  const hasFocusedBounds =
    focusedWindow != null &&
    Number.isFinite(focusedWindow.left) &&
    Number.isFinite(focusedWindow.top) &&
    Number.isFinite(focusedWindow.width) &&
    Number.isFinite(focusedWindow.height);
  const height = hasFocusedBounds
    ? Math.max(PREMIUM_WINDOW_MIN_HEIGHT, Math.round(focusedWindow.height))
    : PREMIUM_WINDOW_FALLBACK_HEIGHT;
  const bounds = hasFocusedBounds
    ? {
        left: Math.round(
          focusedWindow.left + focusedWindow.width - PREMIUM_WINDOW_WIDTH,
        ),
        top: Math.round(focusedWindow.top),
      }
    : {};

  const win = await windowsCreate({
    url,
    type: "popup",
    width: PREMIUM_WINDOW_WIDTH,
    height,
    focused: true,
    ...bounds,
  });

  return { ok: true, windowId: win?.id ?? null };
}

async function verifyPremiumEntitlementWithServer(entitlement) {
  const res = await fetch(premiumVerifyUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ entitlement }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok || !data.payload) {
    throw new Error(data?.error || "Invalid entitlement.");
  }
  return data.payload;
}

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

function windowsRemove(windowId) {
  return promisifyChrome(chrome.windows.remove, windowId);
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
  const local = await chrome.storage.local.get({
    adminPremiumOverride: false,
    premiumEntitlement: "",
  });
  const hasEntitlement =
    typeof local.premiumEntitlement === "string" &&
    local.premiumEntitlement.length > 0;
  const plan =
    local.adminPremiumOverride || (stored.plan === "premium" && hasEntitlement)
      ? "premium"
      : "basic";
  return {
    ...DEFAULTS,
    ...stored,
    plan,
    adminPremiumOverride: Boolean(local.adminPremiumOverride),
  };
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
  screensaverInstances = uniqueScreensaverInstances(instances);
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
    const extensionOrigin = new URL(chrome.runtime.getURL("")).origin;
    if (
      parsed.origin === extensionOrigin &&
      parsed.pathname.endsWith(`/${OFFLINE_SCREENSAVER_PAGE}`)
    ) {
      return true;
    }

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

function uniqueScreensaverInstances(instances) {
  const seenTabs = new Set();
  const seenWindows = new Set();
  const unique = [];

  for (const instance of instances) {
    if (instance.tabId != null) {
      if (seenTabs.has(instance.tabId)) continue;
      seenTabs.add(instance.tabId);
    } else if (instance.windowId != null) {
      if (seenWindows.has(instance.windowId)) continue;
      seenWindows.add(instance.windowId);
    }

    if (instance.windowId != null) {
      seenWindows.add(instance.windowId);
    }
    unique.push(instance);
  }

  return unique;
}

async function queryScreensaverInstances() {
  const tabs = await tabsQuery({});
  return tabs
    .filter((tab) => tab.id != null && tab.windowId != null && isScreensaverUrl(tab.url))
    .map((tab, index) => ({
      tabId: tab.id,
      windowId: tab.windowId,
      displayId: `existing-${tab.windowId}`,
      displayName: index === 0 ? "Existing screensaver" : `Existing screensaver ${index + 1}`,
    }));
}

async function closeInstances(instances) {
  await Promise.all(
    instances.map(async (instance) => {
      try {
        if (instance.windowId != null) {
          await windowsRemove(instance.windowId);
          return;
        }
        if (instance.tabId != null) {
          await tabsRemove(instance.tabId);
        }
      } catch {
        // It may already be closed.
      }
    }),
  );
}

function removeScreensaverInstance(match) {
  screensaverInstances = screensaverInstances.filter((instance) => {
    if (match.tabId != null && instance.tabId === match.tabId) return false;
    if (match.windowId != null && instance.windowId === match.windowId) return false;
    return true;
  });
  if (screensaverInstances.length === 0) {
    clearScreensaverTracking();
  }
}

async function restoreExistingScreensaverInstances(settings = DEFAULTS) {
  const allInstances = uniqueScreensaverInstances(await queryScreensaverInstances());

  if (allInstances.length === 0) return false;

  const instances = settings.allowMultipleDisplays
    ? allInstances
    : allInstances.slice(0, 1);
  const extras = settings.allowMultipleDisplays ? [] : allInstances.slice(1);
  await closeInstances(extras);
  setScreensaverInstances(uniqueScreensaverInstances(instances));
  for (const instance of instances) {
    await enterScreensaverFullscreen(instance.windowId);
  }
  return true;
}

function clearScreensaverTracking() {
  screensaverInstances = [];
  screensaverFlightMode = false;
  lastFullscreenRequestAt.clear();
  clearFullscreenRetry();
}

function buildPlanetsUrl(settings) {
  try {
    const base = settings.siteUrl?.trim() || DEFAULTS.siteUrl;
    const url = new URL(base.includes("://") ? base : `https://${base}`);
    url.searchParams.set("screensaver", "1");
    url.searchParams.set("flight", isPremiumPlan(settings) ? "1" : "0");
    url.searchParams.set("flightKey", settings.flightKey || DEFAULTS.flightKey);
    url.searchParams.set("exitKey", settings.exitKey || settings.flightKey || DEFAULTS.exitKey);
    return url.toString();
  } catch {
    const url = new URL(DEFAULTS.siteUrl);
    url.searchParams.set("screensaver", "1");
    url.searchParams.set("flight", "0");
    url.searchParams.set("flightKey", DEFAULTS.flightKey);
    url.searchParams.set("exitKey", DEFAULTS.exitKey);
    return url.toString();
  }
}

function buildOfflineScreensaverUrl(settings) {
  const url = new URL(chrome.runtime.getURL(OFFLINE_SCREENSAVER_PAGE));
  url.searchParams.set("offline", "1");
  url.searchParams.set("flight", isPremiumPlan(settings) ? "1" : "0");
  url.searchParams.set("flightKey", settings.flightKey || DEFAULTS.flightKey);
  url.searchParams.set("exitKey", settings.exitKey || settings.flightKey || DEFAULTS.exitKey);
  return url.toString();
}

async function onlineScreensaverReachable(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ONLINE_PROBE_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function getScreensaverUrl(settings) {
  const onlineUrl = buildPlanetsUrl(settings);
  if (await onlineScreensaverReachable(onlineUrl)) {
    return {
      url: onlineUrl,
      source: "planets",
      offline: false,
      onlineUrl,
      warning: null,
    };
  }

  return {
    url: buildOfflineScreensaverUrl(settings),
    source: "packaged-offline",
    offline: true,
    onlineUrl,
    warning: "PlanetsOOO is unavailable; using packaged offline scenic mode.",
  };
}

function displayLabel(display, index) {
  return display.name || `Display ${index + 1}`;
}

async function getSelectedDisplays(settings) {
  const displays = await displaysGetInfo();
  const selectedIds = Array.isArray(settings.displayIds) ? settings.displayIds : [];
  const selected = displays.filter((display) => selectedIds.includes(display.id));

  if (selected.length > 0) {
    if (settings.allowMultipleDisplays) return selected;
    const selectedPrimary = selected.find((display) => display.isPrimary);
    return [selectedPrimary ?? selected[0]];
  }

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

async function focusExistingScreensaver(settings = DEFAULTS) {
  if (screensaverInstances.length === 0) {
    return restoreExistingScreensaverInstances(settings);
  }

  try {
    if (!settings.allowMultipleDisplays && screensaverInstances.length > 1) {
      const [primary, ...extras] = screensaverInstances;
      await closeInstances(extras);
      setScreensaverInstances([primary]);
    }
    await Promise.all(
      screensaverInstances.map(async (instance) => {
        await tabsGet(instance.tabId);
        await enterScreensaverFullscreen(instance.windowId);
      }),
    );
    return true;
  } catch {
    clearScreensaverTracking();
    return restoreExistingScreensaverInstances(settings);
  }
}

async function launchScreensaver({ preview = false } = {}) {
  const settings = await getSettings();
  if (!preview && !settings.enabled) {
    const result = { ok: false, error: "Screensaver is disabled." };
    await saveDebug(result);
    return result;
  }

  if (await focusExistingScreensaver(settings)) {
    const result = { ok: true, focused: true, state: "fullscreen" };
    await saveDebug(result);
    return result;
  }

  const screensaverUrl = await getScreensaverUrl(settings);

  if (await focusExistingScreensaver(settings)) {
    const result = {
      ok: true,
      focused: true,
      state: "fullscreen",
      deduped: true,
    };
    await saveDebug(result);
    return result;
  }

  const url = screensaverUrl.url;
  const displays = await getSelectedDisplays(settings);
  const warnings = [];
  const displayWarning =
    displays.length === 0
      ? "Display selection is unavailable in this Chrome build; using the current display."
      : hasMirroredBounds(displays)
        ? "Selected displays appear mirrored. Use the OS display settings to extend displays before selecting more than one monitor."
        : null;
  if (displayWarning) warnings.push(displayWarning);
  if (screensaverUrl.warning) warnings.push(screensaverUrl.warning);

  try {
    const instances = [];

    if (displays.length === 0) {
      const win = await windowsCreate({
        url,
        type: "popup",
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

    for (const [index, display] of displays.entries()) {
      const bounds = display.bounds;
      const win = await windowsCreate({
        url,
        type: "popup",
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
      source: screensaverUrl.source,
      offline: screensaverUrl.offline,
      onlineUrl: screensaverUrl.onlineUrl,
      displays: instances.map((instance) => instance.displayName),
      warning: warnings.join(" ") || null,
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

async function openScreensaver(options = {}) {
  if (openingScreensaverPromise) {
    return openingScreensaverPromise;
  }

  openingScreensaverPromise = launchScreensaver(options).finally(() => {
    openingScreensaverPromise = null;
  });
  return openingScreensaverPromise;
}

async function closeScreensaver(fallback = {}) {
  const discovered = await queryScreensaverInstances().catch(() => []);
  const instances = uniqueScreensaverInstances([
    ...screensaverInstances,
    ...discovered,
    { tabId: fallback.tabId ?? null, windowId: fallback.windowId ?? null },
  ]).filter((instance) => instance.tabId != null || instance.windowId != null);

  clearScreensaverTracking();
  await closeInstances(instances);

  return { ok: true };
}

async function upgradeOfflineScreensaver(tabId) {
  if (tabId == null) {
    return { ok: false, upgraded: false, error: "No active offline screensaver tab." };
  }

  if (!isScreensaverTabId(tabId)) {
    const tab = await tabsGet(tabId).catch(() => null);
    if (tab?.windowId != null && isScreensaverUrl(tab.url)) {
      setScreensaverInstances([
        ...screensaverInstances,
        {
          tabId,
          windowId: tab.windowId,
          displayId: `registered-${tab.windowId}`,
          displayName: "Registered screensaver",
        },
      ]);
    }
  }

  if (!isScreensaverTabId(tabId)) {
    return { ok: false, upgraded: false, error: "No active offline screensaver tab." };
  }

  const settings = await getSettings();
  const onlineUrl = buildPlanetsUrl(settings);
  if (!(await onlineScreensaverReachable(onlineUrl))) {
    return { ok: true, upgraded: false };
  }

  await saveDebug({
    ok: true,
    upgraded: false,
    deferred: true,
    source: "planets",
    url: onlineUrl,
  });
  return { ok: true, upgraded: false, deferred: true, url: onlineUrl };
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

  if (message?.type === "open-premium-checkout") {
    openPremiumCheckoutWindow(message.url).then(
      sendResponse,
      (err) =>
        sendResponse({
          ok: false,
          error:
            err instanceof Error
              ? err.message
              : "Unable to open Premium checkout.",
        }),
    );
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
    const tabId = _sender?.tab?.id;
    const windowId = _sender?.tab?.windowId;
    if (tabId != null && windowId != null && !isScreensaverTabId(tabId)) {
      const senderUrl = _sender?.tab?.url;
      if (isScreensaverUrl(senderUrl)) {
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
    }
    if (isScreensaverTabId(tabId)) {
      screensaverFlightMode = true;
    }
    sendResponse({ ok: true, flightMode: screensaverFlightMode });
    return false;
  }

  if (message?.type === "screensaver-flight-exited") {
    const tabId = _sender?.tab?.id;
    if (isScreensaverTabId(tabId)) {
      screensaverFlightMode = false;
    }
    sendResponse({ ok: true, flightMode: screensaverFlightMode });
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

  if (message?.type === "upgrade-offline-screensaver") {
    upgradeOfflineScreensaver(_sender?.tab?.id).then(sendResponse);
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
          displayIds: settings.displayIds,
          allowMultipleDisplays: settings.allowMultipleDisplays,
          plan: settings.plan,
          adminPremiumOverride: settings.adminPremiumOverride,
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

chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message?.type !== "premium-entitlement") return false;
  if (!allowedPremiumSender(sender.url)) {
    sendResponse({ ok: false, error: "Sender not allowed." });
    return false;
  }

  Promise.resolve()
    .then(async () => {
      const payload = await verifyPremiumEntitlementWithServer(message.entitlement);
      if (
        payload.product !== "orbit-premium" ||
        payload.plan !== "premium" ||
        payload.extensionId !== chrome.runtime.id
      ) {
        throw new Error("Invalid entitlement.");
      }

      const local = await chrome.storage.local.get({ premiumInstallId: "" });
      if (
        local.premiumInstallId &&
        payload.installId !== local.premiumInstallId
      ) {
        throw new Error("Entitlement belongs to a different install.");
      }

      await Promise.all([
        chrome.storage.sync.set({ plan: "premium" }),
        chrome.storage.local.set({
          premiumEntitlement: message.entitlement,
          premiumInstallId: payload.installId,
        }),
      ]);
      sendResponse({ ok: true, plan: "premium" });
    })
    .catch((err) => {
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : "Unable to save entitlement.",
      });
    });
  return true;
});
