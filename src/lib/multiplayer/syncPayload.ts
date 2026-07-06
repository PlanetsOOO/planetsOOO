import type { NavTargetId } from "@/data/navigationTargets";
import type { GuideLogTelemetryInput } from "@/lib/ai/guideLogContext";
import { viewerPosition } from "@/lib/viewerState";
import type { MultiplayerSyncPayload } from "@/lib/multiplayer/syncTypes";

export function buildMultiplayerSyncPayload(input: {
  telemetry: GuideLogTelemetryInput;
  yaw: number;
  pitch: number;
  focusId?: NavTargetId | null;
}): MultiplayerSyncPayload {
  return {
    focusId:
      input.focusId ??
      input.telemetry.navTargetId ??
      input.telemetry.selectedId,
    position: [
      viewerPosition.x,
      viewerPosition.y,
      viewerPosition.z,
    ],
    yaw: input.yaw,
    pitch: input.pitch,
    speedKmPerSec: input.telemetry.displaySpeedKmPerSec,
  };
}
