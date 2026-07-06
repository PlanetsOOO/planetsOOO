"use client";

import { Html } from "@react-three/drei";
import { useOptionalMultiplayer } from "@/context/MultiplayerContext";

export function RemotePlayerMarkers() {
  const multiplayer = useOptionalMultiplayer();
  if (!multiplayer?.room || multiplayer.remotePlayers.length === 0) return null;

  return (
    <>
      {multiplayer.remotePlayers.map((player) => (
        <Html
          key={player.userId}
          position={player.position}
          center
          zIndexRange={[15, 0]}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-200/70 whitespace-nowrap">
            {player.displayName}
            {player.focusId ? ` · ${player.focusId}` : ""}
          </div>
        </Html>
      ))}
    </>
  );
}
