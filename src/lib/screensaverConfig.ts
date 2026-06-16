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

