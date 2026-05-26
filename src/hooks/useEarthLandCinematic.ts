"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useExplorer } from "@/context/ExplorerContext";
import { readEarthRegionHintAtLatLon } from "@/lib/landing/locationCell";
import { renderSatelliteDescentVideo } from "@/lib/landing/descentRenderer";
import {
  directionToLatLon,
  earthAltitudeKm,
  earthFixedDirection,
} from "@/lib/earth/geodesy";
import {
  beginEarthLandCinematic,
  completeEarthLandingAtLatLon,
  earthApproachState,
  getEarthBodyRadius,
  getEarthDistanceRatio,
  isEarthLandOfferZone,
  resetEarthApproach,
  resolveEarthBodyPosition,
} from "@/lib/earthApproach";
import {
  clearEarthLandOffer,
  earthLandCinematicState,
  lockEarthLandTarget,
} from "@/lib/earthLandCinematic";
import {
  discoveryAutopilotState,
  isDiscoveryOrbitFocusSettled,
} from "@/lib/discoveryAutopilot";
import { viewerPosition } from "@/lib/viewerState";
import * as THREE from "three";

const _earth = new THREE.Vector3();
const _dir = new THREE.Vector3();

function isEarthLandOfferEligible(autoNavigating: boolean): boolean {
  if (autoNavigating) return false;
  if (discoveryAutopilotState.currentTargetId !== "earth") return false;
  if (!discoveryAutopilotState.active) return false;
  if (!isDiscoveryOrbitFocusSettled()) return false;
  if (earthApproachState.active) return false;
  return true;
}

export function useEarthLandOffer(autoNavigating: boolean) {
  const { markScenicChromeActivity, markFlightReticleActivity } = useExplorer();
  const [offerVisible, setOfferVisible] = useState(false);
  const [regionLabel, setRegionLabel] = useState<string | null>(null);
  const wasOfferRef = useRef(false);

  useEffect(() => {
    const tick = () => {
      const cinematic = earthLandCinematicState.phase;
      if (
        cinematic === "generating" ||
        cinematic === "playing" ||
        cinematic === "complete" ||
        earthApproachState.phase === "landed" ||
        earthApproachState.phase === "cinematic"
      ) {
        setOfferVisible(false);
        return;
      }

      if (!isEarthLandOfferEligible(autoNavigating)) {
        clearEarthLandOffer();
        setOfferVisible(false);
        setRegionLabel(null);
        wasOfferRef.current = false;
        return;
      }

      const earth = resolveEarthBodyPosition(_earth);
      if (!earth) {
        setOfferVisible(false);
        return;
      }

      const ratio = getEarthDistanceRatio(viewerPosition, earth);
      if (!isEarthLandOfferZone(ratio)) {
        clearEarthLandOffer();
        setOfferVisible(false);
        setRegionLabel(null);
        wasOfferRef.current = false;
        return;
      }

      earthFixedDirection(viewerPosition, earth, undefined, _dir);
      const { lat, lon } = directionToLatLon(_dir);
      const altitudeKm = earthAltitudeKm(viewerPosition, earth, getEarthBodyRadius());
      const regionHint = readEarthRegionHintAtLatLon(lat, lon);

      lockEarthLandTarget({
        lat,
        lon,
        altitudeKm,
        distanceRatio: ratio,
        regionHint,
      });

      setOfferVisible(true);
      setRegionLabel(regionHint);

      if (!wasOfferRef.current) {
        markScenicChromeActivity();
        markFlightReticleActivity();
      }
      wasOfferRef.current = true;
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [autoNavigating, markFlightReticleActivity, markScenicChromeActivity]);

  return { offerVisible, regionLabel };
}

type LibraryLookup = {
  cached: boolean;
  entry?: { videoPath: string; cellId: string };
};

async function lookupLandingLibrary(lat: number, lon: number): Promise<LibraryLookup> {
  const res = await fetch(
    `/api/landings?body=earth&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
    { signal: AbortSignal.timeout(15_000) },
  );
  if (!res.ok) return { cached: false };
  return (await res.json()) as LibraryLookup;
}

async function saveLandingToLibrary(
  blob: Blob,
  lat: number,
  lon: number,
  regionHint: string,
  durationSec: number,
): Promise<string> {
  const form = new FormData();
  form.append("video", blob, "landing.webm");
  form.append(
    "metadata",
    JSON.stringify({ lat, lon, bodyId: "earth", regionHint, durationSec }),
  );
  const res = await fetch("/api/landings", {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error("Failed to save landing to library");
  const data = (await res.json()) as { entry: { videoPath: string } };
  return data.entry.videoPath;
}

export function useEarthLandCinematic(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const [phase, setPhase] = useState(earthLandCinematicState.phase);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingLabel, setLoadingLabel] = useState<string | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    let raf = 0;
    const sync = () => {
      setPhase(earthLandCinematicState.phase);
      setVideoUrl(earthLandCinematicState.videoUrl);
      setError(earthLandCinematicState.error);
      raf = requestAnimationFrame(sync);
    };
    raf = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current = true;
    if (
      earthLandCinematicState.phase === "generating" ||
      earthLandCinematicState.phase === "playing"
    ) {
      resetCinematic();
    }
  }, []);

  const startLanding = useCallback(async () => {
    const target = earthLandCinematicState.target;
    if (!target || earthLandCinematicState.phase === "generating") return;

    const canvas = canvasRef.current;
    if (!canvas) {
      earthLandCinematicState.phase = "error";
      earthLandCinematicState.error = "Landing renderer unavailable";
      return;
    }

    abortRef.current = false;
    earthLandCinematicState.phase = "generating";
    earthLandCinematicState.error = null;
    earthLandCinematicState.videoUrl = null;
    beginEarthLandCinematic();
    setLoadingLabel("Checking landing library…");

    try {
      const library = await lookupLandingLibrary(target.lat, target.lon);
      if (abortRef.current) return;

      if (library.cached && library.entry?.videoPath) {
        earthLandCinematicState.videoUrl = library.entry.videoPath;
        earthLandCinematicState.phase = "playing";
        setLoadingLabel(null);
        return;
      }

      setLoadingLabel("Loading satellite imagery & terrain…");
      const result = await renderSatelliteDescentVideo(canvas, {
        lat: target.lat,
        lon: target.lon,
        altitudeKm: target.altitudeKm,
      });
      if (abortRef.current) return;

      setLoadingLabel("Saving to landing library…");
      const savedPath = await saveLandingToLibrary(
        result.blob,
        target.lat,
        target.lon,
        target.regionHint,
        result.durationSec,
      );

      earthLandCinematicState.videoUrl = savedPath;
      earthLandCinematicState.phase = "playing";
      setLoadingLabel(null);
    } catch (err) {
      if (abortRef.current) return;
      const message = err instanceof Error ? err.message : "Landing failed";
      earthLandCinematicState.phase = "error";
      earthLandCinematicState.error = message;
      resetEarthApproach();
      setLoadingLabel(null);
    }
  }, [canvasRef]);

  return {
    phase,
    videoUrl,
    error,
    loadingLabel,
    startLanding,
    cancel,
  };
}

export function completeEarthLandCinematic(): void {
  const target = earthLandCinematicState.target;
  const handlers = earthLandCinematicState.cameraHandlers;
  if (!target || !handlers) return;

  completeEarthLandingAtLatLon(
    target.lat,
    target.lon,
    handlers.yawRef,
    handlers.pitchRef,
  );
  earthLandCinematicState.phase = "complete";
}

function resetCinematic(): void {
  earthLandCinematicState.phase = "idle";
  earthLandCinematicState.videoUrl = null;
  earthLandCinematicState.error = null;
  if (earthApproachState.phase === "cinematic") {
    resetEarthApproach();
  }
}
