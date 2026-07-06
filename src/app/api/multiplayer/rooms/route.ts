import { NextResponse } from "next/server";
import {
  createRoom,
  getRoomByInvite,
  joinRoom,
  listPublicRooms,
} from "@/lib/multiplayer/roomStore";
import { getWebSession } from "@/lib/multiplayer/access";
import { getOrCreateProgression, updateProgression } from "@/lib/entitlements/store";
import type { PlayerSyncState } from "@/lib/multiplayer/syncTypes";

export const runtime = "nodejs";

interface CreateBody {
  name?: string;
  visibility?: "public" | "invite";
  state?: Partial<PlayerSyncState>;
}

export async function GET() {
  return NextResponse.json({ rooms: listPublicRooms() });
}

export async function POST(request: Request) {
  const session = await getWebSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const progression = await getOrCreateProgression(
    session.userId,
    session.email.split("@")[0] ?? "Pilot",
  );
  await updateProgression(session.userId, {
    roomJoins: progression.roomJoins + 1,
  });

  const hostState = {
    focusId: body.state?.focusId ?? null,
    position: body.state?.position ?? [0, 0, 0],
    yaw: body.state?.yaw ?? 0,
    pitch: body.state?.pitch ?? 0,
    speedKmPerSec: body.state?.speedKmPerSec ?? 0,
  };

  const room = createRoom({
    hostUserId: session.userId,
    hostDisplayName: progression.displayName,
    name: body.name ?? "Orbit room",
    visibility: body.visibility ?? "public",
    hostState,
  });

  return NextResponse.json({ room });
}
