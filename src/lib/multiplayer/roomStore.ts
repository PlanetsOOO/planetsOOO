import { randomBytes } from "node:crypto";
import type {
  MultiplayerRoom,
  PlayerSyncState,
  RoomVisibility,
} from "@/lib/multiplayer/syncTypes";

const rooms = new Map<string, MultiplayerRoom>();
const inviteIndex = new Map<string, string>();
const listeners = new Map<string, Set<(room: MultiplayerRoom) => void>>();

function notify(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  const subs = listeners.get(roomId);
  if (!subs) return;
  for (const listener of subs) {
    listener(structuredClone(room));
  }
}

function randomRoomId(): string {
  return randomBytes(5).toString("hex");
}

function randomInviteCode(): string {
  return randomBytes(4).toString("hex");
}

export function subscribeRoom(
  roomId: string,
  listener: (room: MultiplayerRoom) => void,
): () => void {
  let set = listeners.get(roomId);
  if (!set) {
    set = new Set();
    listeners.set(roomId, set);
  }
  set.add(listener);
  const existing = rooms.get(roomId);
  if (existing) listener(structuredClone(existing));
  return () => {
    set?.delete(listener);
    if (set && set.size === 0) listeners.delete(roomId);
  };
}

export function listPublicRooms(): MultiplayerRoom[] {
  return Array.from(rooms.values())
    .filter((room) => room.visibility === "public")
    .map((room) => structuredClone(room))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getRoom(roomId: string): MultiplayerRoom | null {
  const room = rooms.get(roomId);
  return room ? structuredClone(room) : null;
}

export function getRoomByInvite(inviteCode: string): MultiplayerRoom | null {
  const roomId = inviteIndex.get(inviteCode.toLowerCase());
  if (!roomId) return null;
  return getRoom(roomId);
}

export function createRoom(input: {
  hostUserId: string;
  hostDisplayName: string;
  name: string;
  visibility: RoomVisibility;
  hostState: Omit<PlayerSyncState, "userId" | "displayName" | "updatedAt">;
}): MultiplayerRoom {
  const id = randomRoomId();
  const inviteCode =
    input.visibility === "invite" ? randomInviteCode() : undefined;
  const now = Date.now();
  const room: MultiplayerRoom = {
    id,
    name: input.name.trim() || "Orbit room",
    visibility: input.visibility,
    inviteCode,
    hostUserId: input.hostUserId,
    createdAt: now,
    players: {
      [input.hostUserId]: {
        userId: input.hostUserId,
        displayName: input.hostDisplayName,
        ...input.hostState,
        updatedAt: now,
      },
    },
  };
  rooms.set(id, room);
  if (inviteCode) inviteIndex.set(inviteCode.toLowerCase(), id);
  notify(id);
  return structuredClone(room);
}

export function joinRoom(
  roomId: string,
  player: PlayerSyncState,
): MultiplayerRoom | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.players[player.userId] = { ...player, updatedAt: Date.now() };
  notify(roomId);
  return structuredClone(room);
}

export function leaveRoom(roomId: string, userId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  delete room.players[userId];
  if (Object.keys(room.players).length === 0) {
    if (room.inviteCode) inviteIndex.delete(room.inviteCode.toLowerCase());
    rooms.delete(roomId);
    listeners.delete(roomId);
    return;
  }
  notify(roomId);
}

export function updatePlayerState(
  roomId: string,
  userId: string,
  patch: Partial<PlayerSyncState>,
): MultiplayerRoom | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  const existing = room.players[userId];
  if (!existing) return null;
  room.players[userId] = {
    ...existing,
    ...patch,
    userId,
    updatedAt: Date.now(),
  };
  notify(roomId);
  return structuredClone(room);
}

export function recordDiscovery(userId: string, focusId: string): void {
  for (const room of rooms.values()) {
    if (!room.players[userId]) continue;
    notify(room.id);
    void focusId;
  }
}
