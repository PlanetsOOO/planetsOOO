"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useOnline } from "@/context/OnlineContext";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { useExplorer } from "@/context/ExplorerContext";
import { FactionPicker } from "./FactionPicker";

/**
 * Orbit Online spacecraft HUD — cockpit chrome distinct from Basic explorer.
 */
export function OnlineHud() {
  const { enabled, access } = useOnline();
  const { room, createRoom, leaveRoom } = useMultiplayer();
  const { navigationActive } = useExplorer();
  const [pointerLocked, setPointerLocked] = useState(false);

  useEffect(() => {
    const sync = () => {
      setPointerLocked(Boolean(document.pointerLockElement));
    };
    sync();
    document.addEventListener("pointerlockchange", sync);
    return () => document.removeEventListener("pointerlockchange", sync);
  }, []);

  if (!enabled) return null;

  if (!access?.online) {
    return (
      <div className="fixed bottom-5 left-5 z-40 max-w-sm rounded-xl border border-amber-300/20 bg-black/75 p-4 backdrop-blur-md">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-amber-200/80">
          Orbit Online
        </p>
        <p className="mt-2 text-xs leading-5 text-zinc-400">
          {access?.reason ?? "Sign in to enter the Online demo."}
        </p>
        <Link
          href="/login?next=/online"
          className="mt-3 inline-block text-xs text-sky-200 hover:text-sky-100"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (access.needsFaction) {
    return <FactionPicker />;
  }

  const statusLabel = access.demo ? "Demo" : "Subscribed";
  const peaceLabel = "Peace";
  const inFlight = pointerLocked || navigationActive;

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {/* Cockpit vignette + corner braces */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 42%, rgba(0,8,16,0.55) 100%)",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-3 rounded-sm border border-cyan-300/10"
        aria-hidden
      />
      <div className="absolute left-6 top-6 h-8 w-8 border-l border-t border-cyan-300/35" />
      <div className="absolute right-6 top-6 h-8 w-8 border-r border-t border-cyan-300/35" />
      <div className="absolute bottom-6 left-6 h-8 w-8 border-b border-l border-cyan-300/35" />
      <div className="absolute bottom-6 right-6 h-8 w-8 border-b border-r border-cyan-300/35" />

      {/* Top spacecraft strip */}
      <div className="pointer-events-auto absolute left-1/2 top-5 flex w-[min(92vw,40rem)] -translate-x-1/2 items-center justify-between gap-3 rounded-full border border-cyan-300/20 bg-black/70 px-4 py-2 backdrop-blur-md">
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.35em] text-cyan-200/70">
            Orbit Online · {statusLabel}
          </p>
          <p className="truncate text-sm text-zinc-100">
            <span
              className="mr-2 inline-block h-2 w-2 rounded-full"
              style={{ background: access.factionColor ?? "#7dd3fc" }}
            />
            {access.factionName}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-zinc-500">
            Sector status
          </p>
          <p className="text-xs text-emerald-200/90">{peaceLabel}</p>
        </div>
      </div>

      {!inFlight ? (
        <div className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 rounded-full border border-cyan-300/25 bg-black/60 px-5 py-2 text-center backdrop-blur-md">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-100/90">
            Click view to board craft
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            WASD · mouse look · Space brake · Tab exits flight
          </p>
        </div>
      ) : null}

      {/* Left systems panel */}
      <div className="pointer-events-auto absolute bottom-5 left-5 max-w-xs rounded-xl border border-cyan-300/15 bg-black/75 p-4 backdrop-blur-md">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
          Craft systems
        </p>
        <dl className="mt-3 space-y-2 text-xs text-zinc-400">
          <div className="flex justify-between gap-4">
            <dt>Flight assist</dt>
            <dd className="text-zinc-200">
              {inFlight ? "Engaged" : "Standby — click to fly"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Response</dt>
            <dd className="text-zinc-200">Spacecraft (tight)</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Empire feed</dt>
            <dd className="text-zinc-500">Standby</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>Quests</dt>
            <dd className="text-zinc-500">Peace-time — soon</dd>
          </div>
        </dl>

        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">
            Session
          </p>
          {room ? (
            <>
              <p className="mt-2 text-sm text-zinc-200">{room.name}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {Object.keys(room.players).length} craft
                {room.inviteCode ? ` · ${room.inviteCode}` : ""}
              </p>
              <button
                type="button"
                onClick={() => void leaveRoom()}
                className="mt-3 text-xs uppercase tracking-wider text-zinc-400 hover:text-zinc-200"
              >
                Leave session
              </button>
            </>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void createRoom("Online lobby", "public")}
                className="rounded-md bg-cyan-500/20 px-3 py-1.5 text-xs text-cyan-100 ring-1 ring-cyan-300/30"
              >
                Launch public session
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
