"use client";

import { useExplorer } from "@/context/ExplorerContext";
import { useMobileLandscape } from "@/hooks/useMobileLandscape";
import { useScreensaverMode } from "@/hooks/useScreensaverMode";
import { isExtensionPackaged } from "@/lib/screensaverConfig";

function useBottomChromeVisible(): boolean {
  const screensaver = useScreensaverMode();
  const { navigationActive, discoveryAutopilotActive, scenicChromeVisible } =
    useExplorer();

  if (screensaver || isExtensionPackaged()) return false;
  if (navigationActive) return false;
  if (discoveryAutopilotActive && !scenicChromeVisible) return false;
  return true;
}

export function NavigationHint() {
  const mobileLandscape = useMobileLandscape();
  const visible = useBottomChromeVisible();

  if (!visible) return null;

  if (mobileLandscape) {
    return (
      <p
        className="fixed bottom-[22px] left-1/2 z-30 max-w-[90vw] -translate-x-1/2 text-center text-[11px] tracking-widest uppercase text-zinc-600 pointer-events-none select-none"
        aria-live="polite"
      >
        Left: thrust · drag up to L¹ / L² · Right: steer · Menu to exit
      </p>
    );
  }

  return (
    <p
      className="fixed bottom-[26px] left-1/2 -translate-x-1/2 z-30 text-[12px] tracking-widest uppercase text-zinc-600 pointer-events-none select-none"
      aria-live="polite"
    >
      Click view to fly · Center dot selects · Tab exits flight · Space brake
    </p>
  );
}

export function ExplorerLegalFooter() {
  const mobileLandscape = useMobileLandscape();
  const visible = useBottomChromeVisible();
  const year = new Date().getFullYear();

  if (!visible) return null;

  return (
    <p
      className={`fixed left-1/2 z-30 max-w-[92vw] -translate-x-1/2 text-center text-[10px] leading-5 text-zinc-500/85 pointer-events-auto select-none ${
        mobileLandscape ? "bottom-1" : "bottom-2"
      }`}
    >
      <span className="normal-case tracking-normal">
        © {year} planets.ooo. All rights reserved.
      </span>
      <span className="mx-1.5 text-zinc-600">·</span>
      <a
        href="/privacy"
        className="normal-case tracking-normal text-zinc-500/90 underline decoration-zinc-600/50 underline-offset-2 transition-colors hover:text-zinc-400"
      >
        Privacy policy
      </a>
    </p>
  );
}
