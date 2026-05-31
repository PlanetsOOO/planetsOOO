"use client";

import { useEffect, useState } from "react";
import { useScreensaverMode } from "@/hooks/useScreensaverMode";

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
          "Still loading — confirm npm run dev is running and the site URL port matches.",
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
