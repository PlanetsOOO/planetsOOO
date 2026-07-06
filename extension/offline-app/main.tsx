import React from "react";
import { createRoot } from "react-dom/client";
import { installThreeClockCompat } from "@/lib/threeClockCompat";
import { ExplorerView } from "@/components/explorer/ExplorerView";

installThreeClockCompat();

type ChromeRuntimeLike = {
  runtime?: {
    sendMessage?: (message: unknown) => void;
  };
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

  const onCanvasReady = () => {
    sendReady();
    // After the offline bundle has painted, try upgrading to the live site if
    // it has come back (openScreensaver may have opened us while unreachable).
    requestOnlineUpgradeWhenReachable();
  };

  if (document.querySelector("canvas")) {
    onCanvasReady();
    return;
  }

  const observer = new MutationObserver(() => {
    if (!document.querySelector("canvas")) return;
    observer.disconnect();
    onCanvasReady();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function requestOnlineUpgradeWhenReachable(): void {
  const requestUpgrade = () => {
    sendRuntimeMessage({ type: "upgrade-offline-screensaver" });
  };

  window.addEventListener("online", requestUpgrade);
  window.setTimeout(requestUpgrade, 1200);
}

function bindExtensionBridge(): void {
  window.addEventListener("orbit-screensaver-flight-mode", (event) => {
    const detail = (event as CustomEvent<{ active?: boolean }>).detail;
    const flightMode = Boolean(detail?.active);
    sendRuntimeMessage({
      type: flightMode
        ? "screensaver-flight-entered"
        : "screensaver-flight-exited",
    });
  });
}

function ExtensionRoot() {
  return <ExplorerView />;
}

ensureScreensaverParams();
document.documentElement.classList.add("screensaver-mode", "offline-react-mode");
document.body.classList.add("screensaver-mode", "offline-react-mode");
bindExtensionBridge();

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root mount node");
}

function showBootError(mount: HTMLElement, message: string): void {
  mount.innerHTML = `
    <main style="display:flex;min-height:100vh;align-items:center;justify-content:center;background:#030508;color:#d4d4d8;padding:2rem;font-family:ui-monospace,Menlo,monospace;">
      <div style="max-width:28rem;text-align:center;">
        <p style="font-size:0.875rem;margin:0 0 0.75rem;">Orbit offline explorer failed to start</p>
        <p style="font-size:0.75rem;color:#71717a;word-break:break-word;margin:0;">${message}</p>
      </div>
    </main>`;
  mount.removeAttribute("aria-busy");
}

try {
  createRoot(root).render(<ExtensionRoot />);
  root.removeAttribute("aria-busy");
  notifyReadyWhenCanvasMounts();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  showBootError(root, message);
  console.error("Orbit offline explorer boot error:", error);
}
