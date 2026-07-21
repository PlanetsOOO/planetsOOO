"use client";

import { useEffect } from "react";
import { ExplorerProvider, useExplorer } from "@/context/ExplorerContext";
import { useMobileLandscape } from "@/hooks/useMobileLandscape";
import { useScreensaverMode } from "@/hooks/useScreensaverMode";
import {
  showExplorerChrome,
  isExtensionPackaged,
  isMultiplayerMode,
  isOnlineMode,
} from "@/lib/screensaverConfig";
import { MultiplayerProvider } from "@/context/MultiplayerContext";
import { OnlineProvider } from "@/context/OnlineContext";
import { MultiplayerHud } from "./MultiplayerHud";
import { OnlineHud } from "@/components/online/OnlineHud";
import { OnlineFlightBootstrap } from "@/components/online/OnlineFlightBootstrap";
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
  const websiteFlight =
        !isExtensionPackaged() && !isOnlineMode() && navigationActive;

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

function ExplorerShell() {
  const { navigationActive } = useExplorer();
  const mobileLandscape = useMobileLandscape();
  const screensaver = useScreensaverMode();
  const extensionPremium = isExtensionPackaged();
  const multiplayerEnabled = isMultiplayerMode();
  const onlineEnabled = isOnlineMode();
  const fullChrome = showExplorerChrome();
  const showFlightHud = fullChrome && (!screensaver || navigationActive);
  const showFullHud = showFlightHud && !extensionPremium && !onlineEnabled;
  const showWebsiteExplorer = !screensaver && !extensionPremium && !onlineEnabled;
  const showExtensionFlightHud = extensionPremium && navigationActive;
  const showSpeedHud = onlineEnabled
    ? navigationActive
    : extensionPremium
      ? showExtensionFlightHud
      : showFlightHud;
  const hideCursor =
    !mobileLandscape &&
    (screensaver || (navigationActive && !onlineEnabled) || (onlineEnabled && navigationActive));

  return (
    <main
      className={`relative h-screen w-full overflow-hidden bg-[#030508] ${
        hideCursor ? "cursor-none" : "cursor-default"
      }`}
    >
      <SolarSystemCanvas />
      {(showFullHud || onlineEnabled) && <MobileFlightControls />}
      {(showFullHud || showExtensionFlightHud || onlineEnabled) && <FlightReticle />}
      {showFullHud && <UtcClock />}
      {showSpeedHud && <SpeedHud />}
      {showFullHud && <OptionsMenu />}
      {showFullHud && <PlanetPanel />}
      {!screensaver && !onlineEnabled && <GuideLog />}
      {showWebsiteExplorer && showFullHud && <NavigationHint />}
      {showWebsiteExplorer && showFullHud && <ExplorerLegalFooter />}
      {onlineEnabled ? <OnlineHud /> : null}
      {multiplayerEnabled && !onlineEnabled ? <MultiplayerHud /> : null}
    </main>
  );
}

function ExplorerChrome() {
  const screensaver = useScreensaverMode();
  const extensionPremium = isExtensionPackaged();
  const onlineEnabled = isOnlineMode();
  const fullChrome = showExplorerChrome();
  const { navigationActive } = useExplorer();
  const showFlightHud = fullChrome && (!screensaver || navigationActive);
  const showFullHud = showFlightHud && !extensionPremium && !onlineEnabled;

  return (
    <>
      <ScreensaverBootstrap />
      {onlineEnabled ? <OnlineFlightBootstrap /> : null}
      {(showFullHud || onlineEnabled) && <GlobalShortcuts />}
      {fullChrome && !onlineEnabled && <ScenicChromeController />}
      <ExplorerShell />
      <ScreensaverBootOverlay />
    </>
  );
}

export function ExplorerView() {
  const multiplayerEnabled = isMultiplayerMode();
  const onlineEnabled = isOnlineMode();
  const syncEnabled = multiplayerEnabled || onlineEnabled;

  return (
    <ScreensaverBootGate>
      <ExplorerProvider>
        <OnlineProvider enabled={onlineEnabled}>
          <MultiplayerProvider enabled={syncEnabled}>
            <ExplorerChrome />
          </MultiplayerProvider>
        </OnlineProvider>
      </ExplorerProvider>
    </ScreensaverBootGate>
  );
}
