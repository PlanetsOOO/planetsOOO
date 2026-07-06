"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MultiplayerAccessResult } from "@/lib/multiplayer/access";
import type { MultiplayerRoom, PlayerSyncState } from "@/lib/multiplayer/syncTypes";
import { isExtensionPackaged } from "@/lib/screensaverConfig";

interface MultiplayerContextValue {
  enabled: boolean;
  access: MultiplayerAccessResult | null;
  room: MultiplayerRoom | null;
  remotePlayers: PlayerSyncState[];
  joinPublicRoom: (roomId: string) => Promise<void>;
  createRoom: (name: string, visibility: "public" | "invite") => Promise<void>;
  leaveRoom: () => Promise<void>;
  refreshAccess: () => Promise<void>;
  setActiveRoom: (room: MultiplayerRoom | null) => void;
}

const MultiplayerContext = createContext<MultiplayerContextValue | null>(null);

async function readExtensionHeaders(): Promise<Record<string, string>> {
  if (!isExtensionPackaged()) return {};
  const chromeApi = (
    globalThis as typeof globalThis & {
      chrome?: {
        storage?: { local?: { get: (keys: object) => Promise<Record<string, string>> } };
        runtime?: { id?: string };
      };
    }
  ).chrome;
  if (!chromeApi?.storage?.local) return {};
  const stored = await chromeApi.storage.local.get({
    premiumEntitlement: "",
    orbitExtensionSession: "",
    premiumInstallId: "",
  });
  const headers: Record<string, string> = {};
  if (stored.premiumEntitlement) {
    headers["x-orbit-premium-entitlement"] = stored.premiumEntitlement;
  }
  if (stored.orbitExtensionSession) {
    headers["x-orbit-extension-session"] = stored.orbitExtensionSession;
  }
  return headers;
}

export function MultiplayerProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const [access, setAccess] = useState<MultiplayerAccessResult | null>(null);
  const [room, setRoom] = useState<MultiplayerRoom | null>(null);

  const refreshAccess = useCallback(async () => {
    if (!enabled) {
      setAccess(null);
      return;
    }
    const headers = await readExtensionHeaders();
    const params = new URLSearchParams({
      surface: isExtensionPackaged() ? "extension" : "web",
    });
    if (isExtensionPackaged()) {
      const chromeApi = (
        globalThis as typeof globalThis & {
          chrome?: {
            storage?: { local?: { get: (keys: object) => Promise<Record<string, string>> } };
            runtime?: { id?: string };
          };
        }
      ).chrome;
      if (chromeApi?.runtime?.id) {
        params.set("extensionId", chromeApi.runtime.id);
      }
      const stored = await chromeApi?.storage?.local?.get({
        premiumInstallId: "",
      });
      if (stored?.premiumInstallId) params.set("installId", stored.premiumInstallId);
    }
    const res = await fetch(`/api/multiplayer/entitlement?${params}`, { headers });
    const data = (await res.json()) as MultiplayerAccessResult;
    setAccess(data);
  }, [enabled]);

  useEffect(() => {
    void refreshAccess();
  }, [refreshAccess]);

  const joinPublicRoom = useCallback(async (roomId: string) => {
    const res = await fetch(`/api/multiplayer/rooms/${roomId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: {} }),
    });
    const data = (await res.json()) as { room?: MultiplayerRoom; error?: string };
    if (!res.ok || !data.room) {
      throw new Error(data.error ?? "Unable to join room.");
    }
    setRoom(data.room);
  }, []);

  const createRoom = useCallback(
    async (name: string, visibility: "public" | "invite") => {
      const res = await fetch("/api/multiplayer/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, visibility, state: {} }),
      });
      const data = (await res.json()) as { room?: MultiplayerRoom; error?: string };
      if (!res.ok || !data.room) {
        throw new Error(data.error ?? "Unable to create room.");
      }
      setRoom(data.room);
    },
    [],
  );

  const leaveRoom = useCallback(async () => {
    if (!room) return;
    await fetch(`/api/multiplayer/rooms/${room.id}`, { method: "DELETE" });
    setRoom(null);
  }, [room]);

  useEffect(() => {
    if (!room) return;
    const source = new EventSource(
      `/api/multiplayer/rooms/${room.id}?stream=1`,
    );
    source.onmessage = (event) => {
      try {
        const nextRoom = JSON.parse(event.data) as MultiplayerRoom;
        setRoom(nextRoom);
      } catch {
        // ignore malformed events
      }
    };
    return () => source.close();
  }, [room?.id]);

  const remotePlayers = useMemo(() => {
    if (!room || !access?.userId) return [];
    return Object.values(room.players).filter(
      (player) => player.userId !== access.userId,
    );
  }, [access?.userId, room]);

  const value = useMemo<MultiplayerContextValue>(
    () => ({
      enabled,
      access,
      room,
      remotePlayers,
      joinPublicRoom,
      createRoom,
      leaveRoom,
      refreshAccess,
      setActiveRoom: setRoom,
    }),
    [
      enabled,
      access,
      room,
      remotePlayers,
      joinPublicRoom,
      createRoom,
      leaveRoom,
      refreshAccess,
    ],
  );

  return (
    <MultiplayerContext.Provider value={value}>
      {children}
    </MultiplayerContext.Provider>
  );
}

export function useMultiplayer(): MultiplayerContextValue {
  const ctx = useContext(MultiplayerContext);
  if (!ctx) {
    throw new Error("useMultiplayer must be used within MultiplayerProvider");
  }
  return ctx;
}

export function useOptionalMultiplayer(): MultiplayerContextValue | null {
  return useContext(MultiplayerContext);
}
