export type ScreensaverExitGesture = "contextmenu" | "middleclick";

export interface ScreensaverConfig {
  active: boolean;
  /** KeyboardEvent.code for entering flight from scenic autopilot. */
  enterFlightKey: string;
  exitGesture: ScreensaverExitGesture;
}

const DEFAULT_ENTER_FLIGHT_KEY = "Backquote";

/** Synchronous check — use on first client render (extension adds ?screensaver=1). */
export function isScreensaverMode(): boolean {
  if (typeof window === "undefined") return false;
  const value = new URLSearchParams(window.location.search).get("screensaver");
  return value === "1" || value === "true";
}

function readExitGesture(raw: string | null): ScreensaverExitGesture {
  return raw === "middleclick" ? "middleclick" : "contextmenu";
}

/** Parse ?screensaver=1 URL params (extension appends flightKey / exit). */
export function readScreensaverConfig(): ScreensaverConfig {
  if (typeof window === "undefined") {
    return {
      active: false,
      enterFlightKey: DEFAULT_ENTER_FLIGHT_KEY,
      exitGesture: "contextmenu",
    };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    active: isScreensaverMode(),
    enterFlightKey: params.get("flightKey")?.trim() || DEFAULT_ENTER_FLIGHT_KEY,
    exitGesture: readExitGesture(params.get("exit")),
  };
}

export const SCREENSAVER_FLIGHT_KEY_OPTIONS = [
  { code: "Backquote", label: "` (backtick)" },
  { code: "Semicolon", label: "; (semicolon)" },
  { code: "BracketLeft", label: "[ (left bracket)" },
  { code: "Backslash", label: "\\ (backslash)" },
  { code: "F12", label: "F12" },
] as const;

export const SCREENSAVER_EXIT_OPTIONS = [
  { value: "contextmenu", label: "Right-click" },
  { value: "middleclick", label: "Middle-click" },
] as const;
