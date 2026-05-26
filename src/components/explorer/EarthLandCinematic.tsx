"use client";

import { useEffect, useRef } from "react";
import { useExplorer } from "@/context/ExplorerContext";
import {
  completeEarthLandCinematic,
  useEarthLandCinematic,
  useEarthLandOffer,
} from "@/hooks/useEarthLandCinematic";
import { earthLandCinematicState } from "@/lib/earthLandCinematic";

const CHROME_FADE_MS = 700;

export function EarthLandCinematic() {
  const {
    autoNavigating,
    scenicChromeVisible,
    flightReticleVisible,
    markScenicChromeActivity,
  } = useExplorer();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { offerVisible, regionLabel } = useEarthLandOffer(autoNavigating);
  const { phase, videoUrl, loadingLabel, error, startLanding, cancel } =
    useEarthLandCinematic(canvasRef);

  const chromeVisible = scenicChromeVisible && flightReticleVisible;
  const showOffer =
    offerVisible &&
    chromeVisible &&
    phase !== "generating" &&
    phase !== "playing";

  useEffect(() => {
    if (phase !== "generating" && phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, cancel]);

  useEffect(() => {
    const video = videoRef.current;
    if (phase !== "playing" || !videoUrl || !video) return;

    video.src = videoUrl;
    video.load();
    void video.play().catch(() => {
      earthLandCinematicState.phase = "error";
      earthLandCinematicState.error = "Video playback failed";
    });
  }, [phase, videoUrl]);

  const onLandClick = () => {
    markScenicChromeActivity();
    void startLanding();
  };

  return (
    <>
      {/* Off-screen canvas — must exist before Land is clicked. */}
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        aria-hidden
        className="pointer-events-none fixed -left-[9999px] top-0 h-px w-px opacity-0 overflow-hidden"
      />

      {offerVisible && phase !== "generating" && phase !== "playing" && (
        <div
          className="pointer-events-none fixed bottom-24 left-1/2 z-40 flex -translate-x-1/2 flex-col items-center gap-2 transition-opacity"
          style={{
            opacity: showOffer ? 1 : 0,
            transitionDuration: `${CHROME_FADE_MS}ms`,
          }}
        >
          {regionLabel && (
            <p className="text-[9px] uppercase tracking-[0.22em] text-zinc-500/80">
              {regionLabel}
            </p>
          )}
          <button
            type="button"
            onClick={onLandClick}
            onMouseEnter={markScenicChromeActivity}
            disabled={!showOffer}
            className="pointer-events-auto rounded-full border border-sky-400/30 bg-sky-950/70 px-8 py-2.5 text-xs font-medium uppercase tracking-[0.28em] text-sky-100 shadow-lg backdrop-blur-md transition hover:border-sky-300/50 hover:bg-sky-900/80 disabled:pointer-events-none"
          >
            Land
          </button>
          {phase === "error" && error && (
            <p className="max-w-xs text-center text-[10px] text-red-400/80">
              {error}
            </p>
          )}
        </div>
      )}

      {(phase === "generating" || phase === "playing" || phase === "error") && (
        <div className="fixed inset-0 z-[50] bg-black">
          {phase === "generating" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50">
              <p className="animate-pulse text-xs uppercase tracking-[0.3em] text-zinc-300">
                {loadingLabel ?? "Rendering descent from satellite data…"}
              </p>
              <p className="max-w-xs text-center text-[10px] text-zinc-500">
                Sentinel-2 imagery + terrain elevation · Escape to cancel
              </p>
            </div>
          )}

          {phase === "playing" && (
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              playsInline
              onEnded={completeEarthLandCinematic}
            />
          )}

          {phase === "error" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70 px-6">
              <div className="max-w-sm rounded-lg border border-red-400/20 bg-black/80 p-5 text-center backdrop-blur-md">
                <p className="text-sm text-red-300/90">{error ?? "Landing failed"}</p>
                <button
                  type="button"
                  onClick={() => {
                    earthLandCinematicState.phase = "idle";
                    earthLandCinematicState.error = null;
                  }}
                  className="mt-4 text-[10px] uppercase tracking-[0.2em] text-zinc-400 hover:text-zinc-200"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
