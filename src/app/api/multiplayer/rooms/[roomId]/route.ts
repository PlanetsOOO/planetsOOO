import { NextResponse } from "next/server";
import {
  getRoom,
  joinRoom,
  leaveRoom,
  updatePlayerState,
} from "@/lib/multiplayer/roomStore";
import { subscribeRoom } from "@/lib/multiplayer/roomStore";
import { getWebSession } from "@/lib/multiplayer/access";
import { getOrCreateProgression, updateProgression } from "@/lib/entitlements/store";
import type { PlayerSyncState } from "@/lib/multiplayer/syncTypes";

export const runtime = "nodejs";

interface JoinBody {
  state?: Partial<PlayerSyncState>;
}

interface StateBody {
  state: Partial<PlayerSyncState>;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const { roomId } = await context.params;
  const url = new URL(request.url);
  if (url.searchParams.get("stream") === "1") {
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const unsubscribe = subscribeRoom(roomId, (room) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(room)}\n\n`),
          );
        });
        const keepAlive = setInterval(() => {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        }, 15000);
        return () => {
          clearInterval(keepAlive);
          unsubscribe();
        };
      },
      cancel() {},
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  const room = getRoom(roomId);
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  return NextResponse.json({ room });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const session = await getWebSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { roomId } = await context.params;
  let body: JoinBody;
  try {
    body = (await request.json()) as JoinBody;
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

  const player: PlayerSyncState = {
    userId: session.userId,
    displayName: progression.displayName,
    focusId: body.state?.focusId ?? null,
    position: body.state?.position ?? [0, 0, 0],
    yaw: body.state?.yaw ?? 0,
    pitch: body.state?.pitch ?? 0,
    speedKmPerSec: body.state?.speedKmPerSec ?? 0,
    updatedAt: Date.now(),
  };

  const room = joinRoom(roomId, player);
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  return NextResponse.json({ room });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const session = await getWebSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { roomId } = await context.params;
  let body: StateBody;
  try {
    body = (await request.json()) as StateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const room = updatePlayerState(roomId, session.userId, body.state ?? {});
  if (!room) {
    return NextResponse.json({ error: "Room or player not found." }, { status: 404 });
  }
  return NextResponse.json({ room });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ roomId: string }> },
) {
  const session = await getWebSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const { roomId } = await context.params;
  leaveRoom(roomId, session.userId);
  return NextResponse.json({ ok: true });
}
