import type { NavTargetId } from "@/data/navigationTargets";

export type RoomVisibility = "public" | "invite";

export interface PlayerSyncState {
  userId: string;
  displayName: string;
  focusId: NavTargetId | null;
  position: [number, number, number];
  yaw: number;
  pitch: number;
  speedKmPerSec: number;
  updatedAt: number;
}

export interface MultiplayerRoom {
  id: string;
  name: string;
  visibility: RoomVisibility;
  inviteCode?: string;
  hostUserId: string;
  createdAt: number;
  players: Record<string, PlayerSyncState>;
}

export interface MultiplayerSyncPayload {
  focusId: NavTargetId | null;
  position: [number, number, number];
  yaw: number;
  pitch: number;
  speedKmPerSec: number;
}
