"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
  type ReactNode,
} from "react";
import type { PlanetId } from "@/data/planets";
import { isPlanetTarget, type NavTargetId } from "@/data/navigationTargets";
import { markIdleOrbitUserActivity } from "@/lib/idleOrbitState";
import { resetMobileTouchState } from "@/lib/mobileTouchState";
import {
  beginDiscoveryOrbitAtTarget,
  beginSearchFocusAtTarget,
  discoveryAutopilotState,
  pickRandomNavTarget,
  resetDiscoveryAutopilotState,
  markDiscoveryDeparture,
  resetDiscoveryLegLock,
  markExtensionFlightHandoff,
  clearExtensionFlightHandoff,
} from "@/lib/discoveryAutopilot";
import { resetRouteTourState } from "@/lib/routeTour";
import { FLIGHT_RETICLE_IDLE_MS, SCENIC_CHROME_IDLE_MS } from "@/lib/scenicChrome";
import { flightReticleState } from "@/lib/flightReticleState";
import {
  isExtensionPackaged,
  isScreensaverFlightCapable,
  isScreensaverMode,
  isMultiplayerMode,
} from "@/lib/screensaverConfig";
import { activateScreensaverScenicTour } from "@/lib/screensaverScenic";

interface ExplorerState {
  selectedId: PlanetId | null;
  infoOpen: boolean;
  paused: boolean;
  /** Orbit animation time scale */
  speed: number;
  /** Flight speed multiplier (1–5000×) */
  travelSpeed: number;
  speedUnit: "mph" | "kph";
  displaySpeedKmPerSec: number;
  /** Scenic warp speed as multiples of game lightspeed (0 = show km/h). */
  displayLightspeedMultiple: number;
  /** 0–1 lightspeed spool for FOV and HUD. */
  lightspeedIntensity: number;
  lightspeedActive: boolean;
  showOrbits: boolean;
  showLabels: boolean;
  showConstellations: boolean;
  menuOpen: boolean;
  /** Pointer-lock flight mode active */
  navigationActive: boolean;
  /** Smooth fly-to in progress */
  autoNavigating: boolean;
  navTargetId: NavTargetId | null;
  /** Multi-leg route */
  routeActive: boolean;
  routeWaypoints: NavTargetId[];
  routeLegIndex: number;
  /** Random tour autopilot — hops between searchable objects. */
  discoveryAutopilotActive: boolean;
  /** Options menu visibility during scenic tour. */
  scenicChromeVisible: boolean;
  /** Center reticle visibility during pointer-lock flight. */
  flightReticleVisible: boolean;
  /** Live AI guide log (facts + transit telemetry). */
  aiEnhanced: boolean;
}

interface ExplorerContextValue extends ExplorerState {
  /** Open NASA info panel (double-click on planet only) */
  openPlanetInfo: (id: PlanetId) => void;
  navigateToTarget: (id: NavTargetId) => void;
  /** Select body under flight reticle (left-click in pointer-lock). */
  selectReticleTarget: (id: NavTargetId) => void;
  /** @deprecated use navigateToTarget */
  navigateToPlanet: (id: PlanetId) => void;
  startRoute: (waypoints: NavTargetId[]) => void;
  cancelRoute: () => void;
  advanceRouteLeg: () => void;
  clearAutoNavigation: () => void;
  /** Stop transit but keep nav target (discovery orbit dwell). */
  endAutopilotTransit: () => void;
  /** Exit route autopilot at current position and view (WASD during trip). */
  interruptRouteNavigation: () => void;
  /** Cancel label transit in extension flight; stay in manual flight. */
  interruptExtensionFlightTransit: () => void;
  setDiscoveryAutopilotActive: (active: boolean) => void;
  markScenicChromeActivity: () => void;
  markFlightReticleActivity: () => void;
  advanceDiscoveryLeg: () => void;
  /** Skip a stuck target and hop to the next random body. */
  skipDiscoveryTarget: () => void;
  /** Resume scenic transit if autopilot was interrupted mid-leg. */
  resumeDiscoveryTransit: () => void;
  /** Return screensaver flight to scenic transit from the current POV. */
  returnToDiscoveryScenic: (targetId?: NavTargetId | null) => void;
  dismissInfo: () => void;
  setPaused: (paused: boolean) => void;
  setSpeed: (speed: number) => void;
  setTravelSpeed: (speed: number) => void;
  setSpeedUnit: (unit: "mph" | "kph") => void;
  setDisplaySpeedKmPerSec: (v: number) => void;
  setDisplayLightspeedMultiple: (multiple: number) => void;
  setLightspeedIntensity: (intensity: number) => void;
  setLightspeedActive: (active: boolean) => void;
  setShowOrbits: (show: boolean) => void;
  setShowLabels: (show: boolean) => void;
  setShowConstellations: (show: boolean) => void;
  setMenuOpen: (open: boolean) => void;
  setNavigationActive: (active: boolean) => void;
  exitNavigation: () => void;
  /** Exit pointer-lock flight and cancel any autopilot route. */
  exitAutopilot: () => void;
  setAiEnhanced: (enabled: boolean) => void;
}

const ExplorerContext = createContext<ExplorerContextValue | null>(null);

export function ExplorerProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<PlanetId | null>("earth");
  const [infoOpen, setInfoOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [travelSpeed, setTravelSpeed] = useState(250);
  const [speedUnit, setSpeedUnit] = useState<"mph" | "kph">("kph");
  const [displaySpeedKmPerSec, setDisplaySpeedKmPerSec] = useState(0);
  const [displayLightspeedMultiple, setDisplayLightspeedMultiple] =
    useState(0);
  const [lightspeedIntensity, setLightspeedIntensity] = useState(0);
  const [lightspeedActive, setLightspeedActive] = useState(false);
  const [showOrbits, setShowOrbits] = useState(false);
  const [showLabels, setShowLabels] = useState(false);
  const [showConstellations, setShowConstellations] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navigationActive, setNavigationActive] = useState(false);
  const [autoNavigating, setAutoNavigating] = useState(false);
  const [navTargetId, setNavTargetId] = useState<NavTargetId | null>(null);
  const [routeActive, setRouteActive] = useState(false);
  const [routeWaypoints, setRouteWaypoints] = useState<NavTargetId[]>([]);
  const [routeLegIndex, setRouteLegIndex] = useState(0);
  const [discoveryAutopilotActive, setDiscoveryAutopilotActiveState] =
    useState(() =>
      typeof window !== "undefined" ? isScreensaverMode() : false,
    );
  const [scenicChromeVisible, setScenicChromeVisible] = useState(true);
  const [flightReticleVisible, setFlightReticleVisible] = useState(true);
  const [aiEnhanced, setAiEnhanced] = useState(false);
  const routeRef = useRef<NavTargetId[]>([]);
  const scenicChromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const flightReticleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const discoveryAutopilotActiveRef = useRef(discoveryAutopilotActive);
  const navigationActiveRef = useRef(navigationActive);
  const autoNavigatingRef = useRef(autoNavigating);

  useEffect(() => {
    discoveryAutopilotActiveRef.current = discoveryAutopilotActive;
  }, [discoveryAutopilotActive]);

  useEffect(() => {
    navigationActiveRef.current = navigationActive;
  }, [navigationActive]);

  useEffect(() => {
    autoNavigatingRef.current = autoNavigating;
  }, [autoNavigating]);

  useLayoutEffect(() => {
    if (!isScreensaverMode()) return;
    if (!activateScreensaverScenicTour()) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setDiscoveryAutopilotActiveState(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const clearFlightReticleTimer = useCallback(() => {
    if (flightReticleTimerRef.current) {
      clearTimeout(flightReticleTimerRef.current);
      flightReticleTimerRef.current = null;
    }
  }, []);

  const scheduleFlightReticleHide = useCallback(() => {
    clearFlightReticleTimer();
    flightReticleTimerRef.current = setTimeout(() => {
      setFlightReticleVisible(false);
    }, FLIGHT_RETICLE_IDLE_MS);
  }, [clearFlightReticleTimer]);

  const markFlightReticleActivity = useCallback(() => {
    if (
      !navigationActiveRef.current ||
      discoveryAutopilotActiveRef.current ||
      autoNavigatingRef.current
    ) {
      return;
    }
    setFlightReticleVisible(true);
    scheduleFlightReticleHide();
  }, [scheduleFlightReticleHide]);

  const clearScenicChromeTimer = useCallback(() => {
    if (scenicChromeTimerRef.current) {
      clearTimeout(scenicChromeTimerRef.current);
      scenicChromeTimerRef.current = null;
    }
  }, []);

  const scheduleScenicChromeHide = useCallback(() => {
    clearScenicChromeTimer();
    scenicChromeTimerRef.current = setTimeout(() => {
      setScenicChromeVisible(false);
    }, SCENIC_CHROME_IDLE_MS);
  }, [clearScenicChromeTimer]);

  const markScenicChromeActivity = useCallback(() => {
    const scenicActive =
      discoveryAutopilotActiveRef.current || discoveryAutopilotState.active;
    if (!scenicActive) {
      setScenicChromeVisible(true);
      clearScenicChromeTimer();
      return;
    }
    setScenicChromeVisible(true);
    scheduleScenicChromeHide();
  }, [clearScenicChromeTimer, scheduleScenicChromeHide]);

  useEffect(
    () => () => {
      clearScenicChromeTimer();
      clearFlightReticleTimer();
    },
    [clearScenicChromeTimer, clearFlightReticleTimer],
  );

  const setNavigationActiveWrapped = useCallback(
    (active: boolean) => {
      navigationActiveRef.current = active;
      setNavigationActive(active);
      if (active) {
        markFlightReticleActivity();
      } else {
        clearFlightReticleTimer();
        setFlightReticleVisible(true);
      }
    },
    [clearFlightReticleTimer, markFlightReticleActivity],
  );

  const exitNavigation = useCallback(() => {
    setNavigationActiveWrapped(false);
    resetMobileTouchState();
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [setNavigationActiveWrapped]);

  const clearAutoNavigation = useCallback(() => {
    setAutoNavigating(false);
    setNavTargetId(null);
  }, []);

  const endAutopilotTransit = useCallback(() => {
    setAutoNavigating(false);
  }, []);

  const stopDiscoveryAutopilot = useCallback(() => {
    resetDiscoveryAutopilotState();
    setDiscoveryAutopilotActiveState(false);
    setDisplayLightspeedMultiple(0);
    clearScenicChromeTimer();
    setScenicChromeVisible(true);
    if (!navigationActiveRef.current) {
      clearFlightReticleTimer();
      setFlightReticleVisible(true);
    }
  }, [clearFlightReticleTimer, clearScenicChromeTimer]);

  const launchAutopilotLeg = useCallback((id: NavTargetId) => {
    setNavTargetId(id);
    setAutoNavigating(true);
    if (isPlanetTarget(id)) setSelectedId(id);
  }, []);

  const advanceDiscoveryLeg = useCallback(() => {
    if (!discoveryAutopilotState.active) return;
    if (discoveryAutopilotState.searchFocusLocked) return;
    const next =
      discoveryAutopilotState.queuedTargetId ??
      pickRandomNavTarget(discoveryAutopilotState.currentTargetId);
    discoveryAutopilotState.phase = "transit";
    discoveryAutopilotState.currentTargetId = next;
    discoveryAutopilotState.queuedTargetId = null;
    discoveryAutopilotState.orbitStartedMs = 0;
    discoveryAutopilotState.departStartedMs = 0;
    discoveryAutopilotState.focusLookBlend = 0;
    resetDiscoveryLegLock();
    markDiscoveryDeparture();
    launchAutopilotLeg(next);
  }, [launchAutopilotLeg]);

  const skipDiscoveryTarget = useCallback(() => {
    if (!discoveryAutopilotState.active) return;
    endAutopilotTransit();
    advanceDiscoveryLeg();
  }, [advanceDiscoveryLeg, endAutopilotTransit]);

  const resumeDiscoveryTransit = useCallback(() => {
    if (!discoveryAutopilotState.active) return;
    if (discoveryAutopilotState.phase !== "transit") return;
    const target = discoveryAutopilotState.currentTargetId;
    if (!target) return;
    setNavTargetId(target);
    setAutoNavigating(true);
  }, []);

  const returnToDiscoveryScenic = useCallback(
    (targetId?: NavTargetId | null) => {
      routeRef.current = [];
      setRouteActive(false);
      setRouteWaypoints([]);
      setRouteLegIndex(0);
      setMenuOpen(false);

      const target =
        targetId ??
        discoveryAutopilotState.queuedTargetId ??
        pickRandomNavTarget(discoveryAutopilotState.currentTargetId);

      discoveryAutopilotState.active = true;
      discoveryAutopilotState.phase = "transit";
      discoveryAutopilotState.currentTargetId = target;
      discoveryAutopilotState.queuedTargetId = null;
      discoveryAutopilotState.searchFocusLocked = false;
      clearExtensionFlightHandoff();
      discoveryAutopilotState.orbitStartedMs = 0;
      discoveryAutopilotState.departStartedMs = 0;
      discoveryAutopilotState.focusLookBlend = 0;
      discoveryAutopilotState.focusTargetId = target;
      discoveryAutopilotState.focusHandedOff = false;
      resetDiscoveryLegLock();
      markDiscoveryDeparture();

      setDiscoveryAutopilotActiveState(true);
      launchAutopilotLeg(target);
      markScenicChromeActivity();
      markFlightReticleActivity();
    },
    [
      launchAutopilotLeg,
      markFlightReticleActivity,
      markScenicChromeActivity,
      setMenuOpen,
    ],
  );

  const setDiscoveryAutopilotActive = useCallback(
    (active: boolean) => {
      if (active) {
        if (
          discoveryAutopilotState.active &&
          discoveryAutopilotState.phase === "orbit" &&
          discoveryAutopilotState.currentTargetId
        ) {
          setDiscoveryAutopilotActiveState(true);
          return;
        }

        routeRef.current = [];
        setRouteActive(false);
        setRouteWaypoints([]);
        setRouteLegIndex(0);
        clearAutoNavigation();
        setMenuOpen(false);
        markIdleOrbitUserActivity();

        const target = pickRandomNavTarget();
        discoveryAutopilotState.active = true;
        setDiscoveryAutopilotActiveState(true);
        beginDiscoveryOrbitAtTarget(target);
        if (isPlanetTarget(target)) setSelectedId(target);
        markScenicChromeActivity();
        markFlightReticleActivity();
        return;
      }

      stopDiscoveryAutopilot();
      clearAutoNavigation();
    },
    [
      clearAutoNavigation,
      markScenicChromeActivity,
      markFlightReticleActivity,
      setMenuOpen,
      stopDiscoveryAutopilot,
    ],
  );

  const exitAutopilot = useCallback(() => {
    stopDiscoveryAutopilot();
    resetRouteTourState();
    routeRef.current = [];
    setRouteActive(false);
    setRouteWaypoints([]);
    setRouteLegIndex(0);
    clearAutoNavigation();
    exitNavigation();
  }, [clearAutoNavigation, exitNavigation, stopDiscoveryAutopilot]);

  const openPlanetInfo = useCallback((id: PlanetId) => {
    setSelectedId(id);
    setInfoOpen(true);
  }, []);

  const dismissInfo = useCallback(() => {
    setInfoOpen(false);
    setSelectedId(null);
  }, []);

  const cancelRoute = useCallback(() => {
    routeRef.current = [];
    setRouteActive(false);
    setRouteWaypoints([]);
    setRouteLegIndex(0);
    resetRouteTourState();
    clearAutoNavigation();
  }, [clearAutoNavigation]);

  const advanceRouteLeg = useCallback(() => {
    setRouteLegIndex((idx) => {
      const next = idx + 1;
      const wps = routeRef.current;
      if (next < wps.length) {
        const nextId = wps[next];
        setNavTargetId(nextId);
        if (isPlanetTarget(nextId)) {
          setSelectedId(nextId);
        }
        setAutoNavigating(true);
        return next;
      }
      routeRef.current = [];
      setRouteActive(false);
      setRouteWaypoints([]);
      clearAutoNavigation();
      return 0;
    });
  }, [clearAutoNavigation]);

  const startRoute = useCallback(
    (waypoints: NavTargetId[]) => {
      if (waypoints.length < 2) return;
      stopDiscoveryAutopilot();
      resetRouteTourState();
      setMenuOpen(false);
      markIdleOrbitUserActivity();
      routeRef.current = waypoints;
      setRouteWaypoints(waypoints);
      setRouteLegIndex(0);
      setRouteActive(true);
      setNavTargetId(waypoints[0]);
      setAutoNavigating(true);
      const first = waypoints[0];
      if (isPlanetTarget(first)) setSelectedId(first);
    },
    [setMenuOpen, stopDiscoveryAutopilot],
  );

  const interruptRouteNavigation = useCallback(() => {
    routeRef.current = [];
    setRouteActive(false);
    setRouteWaypoints([]);
    setRouteLegIndex(0);
    clearAutoNavigation();
    markIdleOrbitUserActivity();
  }, [clearAutoNavigation]);

  const interruptExtensionFlightTransit = useCallback(() => {
    discoveryAutopilotState.searchFocusLocked = false;
    clearExtensionFlightHandoff();
    resetDiscoveryLegLock();
    resetDiscoveryAutopilotState();
    setDiscoveryAutopilotActiveState(false);
    setDisplayLightspeedMultiple(0);
    endAutopilotTransit();
    setNavTargetId(null);
    markIdleOrbitUserActivity();
  }, [endAutopilotTransit]);

  const navigateToTarget = useCallback(
    (id: NavTargetId) => {
      const wasScreensaverFlight =
        isScreensaverFlightCapable() && navigationActiveRef.current;

      cancelRoute();
      setMenuOpen(false);
      markIdleOrbitUserActivity();
      beginSearchFocusAtTarget(id);
      setDiscoveryAutopilotActiveState(true);
      markScenicChromeActivity();
      if (discoveryAutopilotState.phase === "transit") {
        launchAutopilotLeg(id);
      } else {
        endAutopilotTransit();
        setNavTargetId(id);
      }
      if (isPlanetTarget(id)) setSelectedId(id);

      if (typeof window !== "undefined" && isMultiplayerMode()) {
        void fetch("/api/multiplayer/progression/discovery", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ focusId: id }),
        });
      }

      if (wasScreensaverFlight) {
        markExtensionFlightHandoff();
        if (document.pointerLockElement) {
          document.exitPointerLock();
        }
        window.dispatchEvent(new CustomEvent("orbit-extension-flight-navigate"));
      }
    },
    [
      cancelRoute,
      endAutopilotTransit,
      launchAutopilotLeg,
      markScenicChromeActivity,
      setMenuOpen,
    ],
  );

  const selectReticleTarget = useCallback(
    (id: NavTargetId) => {
      markIdleOrbitUserActivity();
      if (
        (isScreensaverFlightCapable() && navigationActiveRef.current) ||
        flightReticleState.viaLabel
      ) {
        navigateToTarget(id);
        return;
      }
      if (id === "moon") {
        navigateToTarget(id);
        return;
      }
      setSelectedId(id);
    },
    [navigateToTarget],
  );

  const navigateToPlanet = useCallback(
    (id: PlanetId) => navigateToTarget(id),
    [navigateToTarget],
  );

  const value = useMemo<ExplorerContextValue>(
    () => ({
      selectedId,
      infoOpen,
      paused,
      speed,
      travelSpeed,
      speedUnit,
      displaySpeedKmPerSec,
      displayLightspeedMultiple,
      lightspeedIntensity,
      lightspeedActive,
      showOrbits,
      showLabels,
      showConstellations,
      menuOpen,
      navigationActive,
      autoNavigating,
      navTargetId,
      routeActive,
      routeWaypoints,
      routeLegIndex,
      discoveryAutopilotActive,
      scenicChromeVisible,
      flightReticleVisible,
      aiEnhanced,
      openPlanetInfo,
      navigateToTarget,
      selectReticleTarget,
      navigateToPlanet,
      startRoute,
      cancelRoute,
      advanceRouteLeg,
      clearAutoNavigation,
      endAutopilotTransit,
      interruptRouteNavigation,
      interruptExtensionFlightTransit,
      setDiscoveryAutopilotActive,
      markScenicChromeActivity,
      markFlightReticleActivity,
      advanceDiscoveryLeg,
      skipDiscoveryTarget,
      resumeDiscoveryTransit,
      returnToDiscoveryScenic,
      dismissInfo,
      setPaused,
      setSpeed,
      setTravelSpeed,
      setSpeedUnit,
      setDisplaySpeedKmPerSec,
      setDisplayLightspeedMultiple,
      setLightspeedIntensity,
      setLightspeedActive,
      setShowOrbits,
      setShowLabels,
      setShowConstellations,
      setMenuOpen,
      setNavigationActive: setNavigationActiveWrapped,
      exitNavigation,
      exitAutopilot,
      setAiEnhanced,
    }),
    [
      selectedId,
      infoOpen,
      paused,
      speed,
      travelSpeed,
      speedUnit,
      displaySpeedKmPerSec,
      displayLightspeedMultiple,
      lightspeedIntensity,
      lightspeedActive,
      showOrbits,
      showLabels,
      showConstellations,
      menuOpen,
      navigationActive,
      autoNavigating,
      navTargetId,
      routeActive,
      routeWaypoints,
      routeLegIndex,
      discoveryAutopilotActive,
      scenicChromeVisible,
      flightReticleVisible,
      aiEnhanced,
      openPlanetInfo,
      navigateToTarget,
      selectReticleTarget,
      navigateToPlanet,
      startRoute,
      cancelRoute,
      advanceRouteLeg,
      clearAutoNavigation,
      endAutopilotTransit,
      interruptRouteNavigation,
      interruptExtensionFlightTransit,
      setDiscoveryAutopilotActive,
      markScenicChromeActivity,
      markFlightReticleActivity,
      advanceDiscoveryLeg,
      skipDiscoveryTarget,
      resumeDiscoveryTransit,
      returnToDiscoveryScenic,
      dismissInfo,
      exitNavigation,
      exitAutopilot,
      setNavigationActiveWrapped,
    ],
  );

  return (
    <ExplorerContext.Provider value={value}>{children}</ExplorerContext.Provider>
  );
}

export function useExplorer() {
  const ctx = useContext(ExplorerContext);
  if (!ctx) throw new Error("useExplorer must be used within ExplorerProvider");
  return ctx;
}
