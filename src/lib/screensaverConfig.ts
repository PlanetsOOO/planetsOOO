import { CHROME_EXTENSION_ID } from "@/lib/chromeWebStore";

export interface ScreensaverConfig {
  active: boolean;
  /** Extension capability gate: basic mode disables flight entry. */
  flightEnabled: boolean;
  /** KeyboardEvent.code for entering flight from scenic autopilot. */
  enterFlightKey: string;
  /** KeyboardEvent.code for leaving flight/screensaver. */
  exitKey: string;
}

const DEFAULT_ENTER_FLIGHT_KEY = "Backquote";
const DEFAULT_EXIT_KEY = DEFAULT_ENTER_FLIGHT_KEY;

/** Synchronous check — use on first client render (extension adds ?screensaver=1). */
export function isScreensaverMode(): boolean {
  if (typeof window === "undefined") return false;
  const value = new URLSearchParams(window.location.search).get("screensaver");
  return value === "1" || value === "true";
}

/** Packaged Premium explorer running from chrome-extension:// (not planets.ooo). */
export function isExtensionPackaged(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.protocol === "chrome-extension:";
}

/**
 * Premium screensaver with manual flight (?screensaver=1&flight=1).
 * True for extension-hosted planets.ooo tabs and packaged offline React.
 */
export function isScreensaverFlightCapable(): boolean {
  if (typeof window === "undefined") return false;
  if (!isScreensaverMode()) return false;
  return readScreensaverConfig().flightEnabled;
}

/** Screensaver manual flight active (extension online, packaged offline, or same URL params). */
export function isExtensionScreensaverFlight(navigationActive: boolean): boolean {
  return isScreensaverFlightCapable() && navigationActive;
}

/** Multiplayer requested via ?multiplayer=1 on web or extension when online. */
export function isMultiplayerMode(): boolean {
  if (typeof window === "undefined") return false;
  const value = new URLSearchParams(window.location.search).get("multiplayer");
  return value === "1" || value === "true";
}

/**
 * Orbit Online PC demo / subscription mode (?online=1).
 * Separate from Basic explorer and from legacy ?multiplayer=1.
 */
export function isOnlineMode(): boolean {
  if (typeof window === "undefined") return false;
  const value = new URLSearchParams(window.location.search).get("online");
  return value === "1" || value === "true";
}

/** Full explorer UI (HUD, menu, panels) — web app, or packaged Premium extension. */
export function showExplorerChrome(): boolean {
  return !isScreensaverMode() || isExtensionPackaged();
}

/** Parse ?screensaver=1 URL params (extension appends flightKey / exitKey). */
export function readScreensaverConfig(): ScreensaverConfig {
  if (typeof window === "undefined") {
    return {
      active: false,
      flightEnabled: false,
      enterFlightKey: DEFAULT_ENTER_FLIGHT_KEY,
      exitKey: DEFAULT_EXIT_KEY,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const flightParam = params.get("flight");
  return {
    active: isScreensaverMode(),
    flightEnabled: flightParam == null || flightParam === "1" || flightParam === "true",
    enterFlightKey: params.get("flightKey")?.trim() || DEFAULT_ENTER_FLIGHT_KEY,
    exitKey: params.get("exitKey")?.trim() || params.get("flightKey")?.trim() || DEFAULT_EXIT_KEY,
  };
}

export const SCREENSAVER_FLIGHT_KEY_OPTIONS = [
  { code: "Backquote", label: "` (backtick)" },
  { code: "Semicolon", label: "; (semicolon)" },
  { code: "BracketLeft", label: "[ (left bracket)" },
  { code: "BracketRight", label: "] (right bracket)" },
  { code: "Backslash", label: "\\ (backslash)" },
  { code: "Quote", label: "' (quote)" },
  { code: "Comma", label: ", (comma)" },
  { code: "Period", label: ". (period)" },
  { code: "Slash", label: "/ (slash)" },
  { code: "Minus", label: "- (minus)" },
  { code: "Equal", label: "= (equals)" },
  { code: "Digit0", label: "0" },
  { code: "Digit9", label: "9" },
  { code: "F12", label: "F12" },
] as const;

type ChromeRuntimeSendMessage = {
  id?: string;
  lastError?: { message?: string };
  sendMessage?: (...args: unknown[]) => void;
};

function chromeRuntime(): ChromeRuntimeSendMessage | null {
  if (typeof globalThis === "undefined") return null;
  const candidate = globalThis as typeof globalThis & {
    chrome?: { runtime?: ChromeRuntimeSendMessage };
  };
  return candidate.chrome?.runtime ?? null;
}

/**
 * Extension id for messaging from the hosted screensaver page.
 * Prefer ?extId= (set by the extension when opening the tab); fall back to
 * chrome.runtime.id on chrome-extension:// pages, then the published store id.
 */
export function resolveScreensaverExtensionId(): string {
  if (typeof window === "undefined") return "";
  const fromQuery = new URLSearchParams(window.location.search)
    .get("extId")
    ?.trim();
  if (fromQuery) return fromQuery;
  const runtimeId = chromeRuntime()?.id?.trim();
  if (runtimeId) return runtimeId;
  // Published Orbit Screensaver (dev unpacked ids differ; prefer ?extId=).
  return CHROME_EXTENSION_ID;
}

/**
 * Notify the extension service worker. Hosted pages (externally_connectable)
 * must pass the extension id; extension pages use the implicit id.
 */
export function sendScreensaverExtensionMessage(message: unknown): void {
  const runtime = chromeRuntime();
  if (!runtime?.sendMessage) return;
  try {
    if (isExtensionPackaged()) {
      runtime.sendMessage(message);
      return;
    }
    const extensionId = resolveScreensaverExtensionId();
    if (!extensionId) return;
    runtime.sendMessage(extensionId, message);
  } catch {
    // Page may lack externally_connectable access, or the extension reloaded.
  }
}
