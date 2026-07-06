"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMultiplayer } from "@/context/MultiplayerContext";
import { ExtensionLinkAnchor } from "./ExtensionLinkAnchor";
import { isExtensionPackaged } from "@/lib/screensaverConfig";

export function MultiplayerHud() {
  const { enabled, access, room, createRoom, leaveRoom, joinPublicRoom } =
    useMultiplayer();
  const [rooms, setRooms] = useState<Array<{ id: string; name: string }>>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!enabled || !access?.multiplayer) return;
    void fetch("/api/multiplayer/rooms")
      .then((res) => res.json())
      .then((data: { rooms?: Array<{ id: string; name: string }> }) => {
        setRooms(
          (data.rooms ?? []).map((entry) => ({
            id: entry.id,
            name: entry.name,
          })),
        );
      })
      .catch(() => {});
  }, [access?.multiplayer, enabled, room?.id]);

  if (!enabled) return null;

  if (!access?.multiplayer) {
    return (
      <div className="fixed bottom-5 left-5 z-40 max-w-xs rounded-xl border border-white/10 bg-black/70 p-4 backdrop-blur-md">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">
          Multiplayer
        </p>
        <p className="mt-2 text-xs leading-5 text-zinc-400">
          {access?.reason ??
            (isExtensionPackaged()
              ? "Link your account and subscribe to unlock extension multiplayer."
              : "Subscribe to unlock shared rooms.")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link href="/account" className="text-sky-200 hover:text-sky-100">
            Account
          </Link>
          {isExtensionPackaged() ? (
            <ExtensionLinkAnchor />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-5 left-5 z-40 max-w-sm rounded-xl border border-white/10 bg-black/70 p-4 backdrop-blur-md">
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">
        Multiplayer
      </p>
      {room ? (
        <>
          <p className="mt-2 text-sm text-zinc-200">{room.name}</p>
          <p className="mt-1 text-xs text-zinc-500">
            {Object.keys(room.players).length} pilot
            {Object.keys(room.players).length === 1 ? "" : "s"}
            {room.inviteCode ? ` · invite ${room.inviteCode}` : ""}
          </p>
          <button
            type="button"
            onClick={() => void leaveRoom()}
            className="mt-3 text-xs uppercase tracking-wider text-zinc-400 hover:text-zinc-200"
          >
            Leave room
          </button>
        </>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setError("");
                void createRoom("Public lobby", "public").catch((err) => {
                  setError(
                    err instanceof Error ? err.message : "Unable to create room.",
                  );
                });
              }}
              className="rounded-md bg-sky-500/20 px-3 py-1.5 text-xs text-sky-100 ring-1 ring-sky-300/30"
            >
              Create public room
            </button>
            <button
              type="button"
              onClick={() => {
                setError("");
                void createRoom("Invite room", "invite").catch((err) => {
                  setError(
                    err instanceof Error ? err.message : "Unable to create room.",
                  );
                });
              }}
              className="rounded-md px-3 py-1.5 text-xs text-zinc-300 ring-1 ring-white/10"
            >
              Create invite room
            </button>
          </div>
          {rooms.length > 0 ? (
            <ul className="mt-3 space-y-1 text-xs text-zinc-400">
              {rooms.slice(0, 5).map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setError("");
                      void joinPublicRoom(entry.id).catch((err) => {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Unable to join room.",
                        );
                      });
                    }}
                    className="hover:text-zinc-200"
                  >
                    Join {entry.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
      {error ? <p className="mt-3 text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}
