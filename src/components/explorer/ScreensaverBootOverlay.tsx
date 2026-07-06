"use client";

import { useEffect, useState } from "react";
import { useScreensaverMode } from "@/hooks/useScreensaverMode";
import { isExtensionPackaged } from "@/lib/screensaverConfig";

export function ScreensaverBootOverlay() {
  const screensaver = useScreensaverMode();
  const [message, setMessage] = useState("Loading Orbit…");

  useEffect(() => {
    if (!screensaver) return;

    const onError = (event: ErrorEvent) => {
      setMessage(event.message || "Script error");
    };

    window.addEventListener("error", onError);

    let ticks = 0;
    const id = window.setInterval(() => {
      ticks += 1;
      if (document.querySelector("canvas")) {
        setMessage("");
        window.clearInterval(id);
        return;
      }
      if (ticks === 4) setMessage("Loading 3D view…");
      if (ticks === 20) {
        setMessage(
          isExtensionPackaged()
            ? "Still loading — check extension textures in chrome://extensions."
            : "Still loading — confirm planets.ooo is reachable and reload.",
        );
      }
    }, 500);

    return () => {
      window.removeEventListener("error", onError);
      window.clearInterval(id);
    };
  }, [screensaver]);

  if (!screensaver || !message) return null;

  return (
    <p
      className="fixed bottom-5 left-1/2 z-[100] max-w-[90vw] -translate-x-1/2 text-center font-mono text-[10px] text-zinc-600/80 pointer-events-none select-none"
      aria-live="polite"
    >
      {message}
    </p>
  );
}
