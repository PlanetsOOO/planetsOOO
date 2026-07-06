"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useExplorer } from "@/context/ExplorerContext";
import { useOptionalMultiplayer } from "@/context/MultiplayerContext";
import { buildMultiplayerSyncPayload } from "@/lib/multiplayer/syncPayload";
import { isExtensionPackaged } from "@/lib/screensaverConfig";
import { RENDER_FRAME_PRIORITY } from "@/lib/renderFramePriority";

interface MultiplayerControllerProps {
  yawRef: React.MutableRefObject<number>;
  pitchRef: React.MutableRefObject<number>;
}

export function MultiplayerController({
  yawRef,
  pitchRef,
}: MultiplayerControllerProps) {
  const multiplayer = useOptionalMultiplayer();
  const {
    discoveryAutopilotActive,
    autoNavigating,
    routeActive,
    navigationActive,
    navTargetId,
    routeWaypoints,
    routeLegIndex,
    selectedId,
    displaySpeedKmPerSec,
    displayLightspeedMultiple,
  } = useExplorer();
  const lastSyncAt = useRef(0);

  useEffect(() => {
    if (!multiplayer?.enabled || !multiplayer.access?.multiplayer) return;
    if (isExtensionPackaged() && !navigator.onLine) return;
  }, [multiplayer?.access?.multiplayer, multiplayer?.enabled]);

  useFrame(() => {
    const room = multiplayer?.room;
    const access = multiplayer?.access;
    if (!room || !access?.multiplayer || !access.userId) return;
    if (isExtensionPackaged() && !navigator.onLine) return;

    const now = performance.now();
    if (now - lastSyncAt.current < 200) return;
    lastSyncAt.current = now;

    const payload = buildMultiplayerSyncPayload({
      telemetry: {
        discoveryAutopilotActive,
        autoNavigating,
        routeActive,
        navigationActive,
        navTargetId,
        routeWaypoints,
        routeLegIndex,
        selectedId,
        displaySpeedKmPerSec,
        displayLightspeedMultiple,
      },
      yaw: yawRef.current,
      pitch: pitchRef.current,
    });

    void fetch(`/api/multiplayer/rooms/${room.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: payload }),
    });
  }, RENDER_FRAME_PRIORITY.overlays);

  return null;
}
