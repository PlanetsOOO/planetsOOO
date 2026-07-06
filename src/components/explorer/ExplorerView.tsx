"use client";

import { useEffect } from "react";
import { ExplorerProvider, useExplorer } from "@/context/ExplorerContext";
import { useMobileLandscape } from "@/hooks/useMobileLandscape";
import { useScreensaverMode } from "@/hooks/useScreensaverMode";
import {
  showExplorerChrome,
  isExtensionPackaged,
  isMultiplayerMode,
} from "@/lib/screensaverConfig";
import { MultiplayerProvider } from "@/context/MultiplayerContext";
import { MultiplayerHud } from "./MultiplayerHud";
import SolarSystemCanvas from "@/components/explorer/SolarSystemCanvas";
import { MobileFlightControls } from "./MobileFlightControls";
import { OptionsMenu } from "./OptionsMenu";
import { PlanetPanel } from "./PlanetPanel";
import { SpeedHud } from "./SpeedHud";
import { FlightReticle } from "./FlightReticle";
import { ScenicChromeController } from "./ScenicChromeController";
import { ScreensaverBootstrap } from "./ScreensaverBootstrap";
import { ScreensaverBootOverlay } from "./ScreensaverBootOverlay";
import { ScreensaverBootGate } from "./ScreensaverErrorBoundary";
import { ExplorerLegalFooter, NavigationHint } from "./ExplorerBottomChrome";
import { GuideLog } from "./GuideLog";
import { UtcClock } from "./UtcClock";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

function GlobalShortcuts() {
  const {
    dismissInfo,
    setMenuOpen,
    exitAutopilot,
    navigationActive,
    showLabels,
    setShowLabels,
    showOrbits,
    setShowOrbits,
  } = useExplorer();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const websiteFlight = !isExtensionPackaged() && navigationActive;

      if (
        e.key.toLowerCase() === "l" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isEditableTarget(e.target) &&
        navigationActive
      ) {
        e.preventDefault();
        setShowLabels(!showLabels);
        return;
      }

      if (
        e.key.toLowerCase() === "o" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isEditableTarget(e.target) &&
        navigationActive
      ) {
        if (websiteFlight) return;
        e.preventDefault();
        setShowOrbits(!showOrbits);
        return;
      }

      if (e.key === "Tab") {
        const menuPanel = document.querySelector("[data-explorer-menu]");
        if (menuPanel?.contains(document.activeElement)) return;
        e.preventDefault();
        exitAutopilot();
        return;
      }

      if (e.key !== "Escape") return;
      dismissInfo();
      setMenuOpen(false);
      exitAutopilot();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    dismissInfo,
    setMenuOpen,
    exitAutopilot,
    navigationActive,
    showLabels,
    setShowLabels,
    showOrbits,
    setShowOrbits,
  ]);

  return null;
}

function ExtensionMenuLink() {
  return (
    <a
      href="/extension"
      className="fixed bottom-5 right-5 z-30 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/25 text-zinc-500 backdrop-blur-sm transition hover:border-sky-300/30 hover:text-sky-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-300/50"
      aria-label="Get the Orbit Chrome extension"
      title="Get the Orbit Chrome extension"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
        <path
          d="M9 3h6v4h4v6h-4v8H9v-8H5V7h4V3Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}

function ExplorerShell() {
  const { navigationActive } = useExplorer();
  const mobileLandscape = useMobileLandscape();
  const screensaver = useScreensaverMode();
  const extensionPremium = isExtensionPackaged();
  const multiplayerEnabled = isMultiplayerMode();
  const fullChrome = showExplorerChrome();
  const showFlightHud = fullChrome && (!screensaver || navigationActive);
  const showFullHud = showFlightHud && !extensionPremium;
  const showWebsiteExplorer = !screensaver && !extensionPremium;
  const showExtensionFlightHud = extensionPremium && navigationActive;
  const showSpeedHud = extensionPremium ? showExtensionFlightHud : showFlightHud;

  return (
    <main
      className={`relative h-screen w-full overflow-hidden bg-[#030508] ${
        navigationActive && !mobileLandscape && !screensaver
          ? "cursor-none"
          : "cursor-default"
      }`}
    >
      <SolarSystemCanvas />
      {showFullHud && <MobileFlightControls />}
      {(showFullHud || showExtensionFlightHud) && <FlightReticle />}
      {showFullHud && <UtcClock />}
      {showSpeedHud && <SpeedHud />}
      {showFullHud && <OptionsMenu />}
      {showFullHud && <PlanetPanel />}
      {!screensaver && <GuideLog />}
      {showWebsiteExplorer && showFullHud && <NavigationHint />}
      {showWebsiteExplorer && showFullHud && <ExplorerLegalFooter />}
      {!screensaver && <ExtensionMenuLink />}
      {multiplayerEnabled ? <MultiplayerHud /> : null}
    </main>
  );
}

function ExplorerChrome() {
  const screensaver = useScreensaverMode();
  const extensionPremium = isExtensionPackaged();
  const fullChrome = showExplorerChrome();
  const { navigationActive } = useExplorer();
  const showFlightHud = fullChrome && (!screensaver || navigationActive);
  const showFullHud = showFlightHud && !extensionPremium;

  return (
    <>
      <ScreensaverBootstrap />
      {showFullHud && <GlobalShortcuts />}
      {fullChrome && <ScenicChromeController />}
      <ExplorerShell />
      <ScreensaverBootOverlay />
    </>
  );
}

export function ExplorerView() {
  const multiplayerEnabled = isMultiplayerMode();

  return (
    <ScreensaverBootGate>
      <ExplorerProvider>
        <MultiplayerProvider enabled={multiplayerEnabled}>
          <ExplorerChrome />
        </MultiplayerProvider>
      </ExplorerProvider>
    </ScreensaverBootGate>
  );
}
