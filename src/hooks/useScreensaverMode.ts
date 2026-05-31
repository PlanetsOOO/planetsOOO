"use client";

import { useSyncExternalStore } from "react";
import { isScreensaverMode } from "@/lib/screensaverConfig";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange);
  return () => window.removeEventListener("popstate", onStoreChange);
}

function getSnapshot() {
  return isScreensaverMode();
}

function getServerSnapshot() {
  return false;
}

/** True when loaded as ?screensaver=1 (Chrome extension fullscreen player). */
export function useScreensaverMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
