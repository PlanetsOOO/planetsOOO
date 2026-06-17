import React from "react";
import { createRoot } from "react-dom/client";
import { ExplorerView } from "@/components/explorer/ExplorerView";

const LUDICROUS_SPEED_MULTIPLIER = 100;
const DEFAULT_SPEED_TRACKER_DETAIL = {
  active: true,
  speedKmPerSec: 0,
  lightspeedMultiple: 0,
  speedUnit: "kph",
} as const;

type ChromeRuntimeLike = {
  runtime?: {
    sendMessage?: (message: unknown) => void;
  };
};

type SpeedTrackerDetail = {
  active?: boolean;
  speedKmPerSec?: number;
  lightspeedMultiple?: number;
  speedUnit?: "kph" | "mph";
};

function getChromeApi(): ChromeRuntimeLike | undefined {
  return (globalThis as typeof globalThis & { chrome?: ChromeRuntimeLike }).chrome;
}

function sendRuntimeMessage(message: unknown): void {
  try {
    getChromeApi()?.runtime?.sendMessage?.(message);
  } catch {
    // Extension context may be reloading.
  }
}

function ensureScreensaverParams(): void {
  const url = new URL(window.location.href);
  let changed = false;

  if (!url.searchParams.has("screensaver")) {
    url.searchParams.set("screensaver", "1");
    changed = true;
  }
  if (!url.searchParams.has("offline")) {
    url.searchParams.set("offline", "1");
    changed = true;
  }
  if (!url.searchParams.has("flight")) {
    url.searchParams.set("flight", "1");
    changed = true;
  }

  if (changed) {
    window.history.replaceState(null, "", url.toString());
  }
}

function notifyReadyWhenCanvasMounts(): void {
  const sendReady = () => {
    sendRuntimeMessage({ type: "screensaver-page-ready" });
  };

  if (document.querySelector("canvas")) {
    sendReady();
    return;
  }

  const observer = new MutationObserver(() => {
    if (!document.querySelector("canvas")) return;
    observer.disconnect();
    sendReady();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function formatSpeedMultiple(multiple: number): string {
  if (multiple >= 100) return `${Math.round(multiple)}×`;
  if (multiple >= 10) return `${Math.round(multiple)}×`;
  if (multiple >= 1) return `${multiple.toFixed(1)}×`;
  return `${multiple.toFixed(2)}×`;
}

function speedTrackerLines(detail: SpeedTrackerDetail) {
  const multiple = Number(detail.lightspeedMultiple || 0);
  const showCMultiple = multiple >= 0.95;
  const ludicrous = multiple >= LUDICROUS_SPEED_MULTIPLIER * 0.95;

  if (showCMultiple) {
    return {
      mode: ludicrous ? "ludicrous" : "lightspeed",
      heading: ludicrous ? "LUDICROUS" : "LIGHTSPEED",
      value: `${formatSpeedMultiple(multiple)} c`,
    };
  }

  const kmPerSec = Number(detail.speedKmPerSec || 0);
  const speedUnit = detail.speedUnit === "mph" ? "mph" : "kph";
  const value =
    speedUnit === "kph" ? kmPerSec * 3600 : kmPerSec * 2236.9362920544;

  return {
    mode: "normal",
    heading: "",
    value: `${Math.max(0, value).toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })} ${speedUnit === "kph" ? "km/h" : "mph"}`,
  };
}

function ensureSpeedTracker(): HTMLDivElement | null {
  let el = document.getElementById("orbit-extension-speed-tracker") as
    | HTMLDivElement
    | null;
  if (el) return el;
  if (!document.body) return null;

  el = document.createElement("div");
  el.id = "orbit-extension-speed-tracker";
  el.setAttribute("aria-live", "polite");
  Object.assign(el.style, {
    position: "fixed",
    top: "1.25rem",
    right: "3.5rem",
    zIndex: "2147483647",
    color: "rgba(82, 82, 91, 0.8)",
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
    fontSize: "10px",
    fontVariantNumeric: "tabular-nums",
    lineHeight: "1.25",
    opacity: "0",
    pointerEvents: "none",
    textAlign: "right",
    transition: "opacity 240ms ease",
    userSelect: "none",
  });
  document.body.append(el);
  return el;
}

function renderSpeedTracker(detail: SpeedTrackerDetail): void {
  const el = ensureSpeedTracker();
  if (!el) return;

  const lines = speedTrackerLines(detail);
  el.replaceChildren();

  if (lines.heading) {
    const heading = document.createElement("p");
    heading.textContent = lines.heading;
    Object.assign(heading.style, {
      margin: "0 0 2px",
      color:
        lines.mode === "ludicrous"
          ? "rgba(232, 121, 249, 0.95)"
          : "rgba(56, 189, 248, 0.9)",
      letterSpacing: "0.05em",
    });
    el.append(heading);
  }

  const value = document.createElement("p");
  value.textContent = lines.value;
  Object.assign(value.style, {
    margin: "0",
    color:
      lines.mode === "ludicrous"
        ? "rgba(240, 171, 252, 0.8)"
        : lines.mode === "lightspeed"
          ? "rgba(125, 211, 252, 0.75)"
          : "inherit",
  });
  el.append(value);
}

function setSpeedTrackerVisible(
  visible: boolean,
  detail?: SpeedTrackerDetail,
): void {
  const el = ensureSpeedTracker();
  if (!el) return;
  if (detail) renderSpeedTracker(detail);
  el.style.opacity = visible ? "1" : "0";
}

function bindExtensionBridge(): void {
  let flightMode = false;

  window.addEventListener("orbit-screensaver-flight-mode", (event) => {
    const detail = (event as CustomEvent<{ active?: boolean }>).detail;
    flightMode = Boolean(detail?.active);
    sendRuntimeMessage({
      type: flightMode
        ? "screensaver-flight-entered"
        : "screensaver-flight-exited",
    });
    setSpeedTrackerVisible(
      flightMode,
      flightMode ? DEFAULT_SPEED_TRACKER_DETAIL : undefined,
    );
  });

  window.addEventListener("orbit-screensaver-speed", (event) => {
    const detail = (event as CustomEvent<SpeedTrackerDetail>).detail;
    const active = Boolean(detail?.active);
    if (!flightMode || !active) {
      setSpeedTrackerVisible(false);
      return;
    }
    setSpeedTrackerVisible(true, detail);
  });
}

ensureScreensaverParams();
document.documentElement.classList.add("screensaver-mode", "offline-react-mode");
document.body.classList.add("screensaver-mode", "offline-react-mode");
bindExtensionBridge();

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root mount node");
}

createRoot(root).render(
  <React.StrictMode>
    <ExplorerView />
  </React.StrictMode>,
);

root.removeAttribute("aria-busy");
notifyReadyWhenCanvasMounts();
