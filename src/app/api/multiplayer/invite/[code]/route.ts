import { NextResponse } from "next/server";
import { getRoomByInvite } from "@/lib/multiplayer/roomStore";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  const { code } = await context.params;
  const room = getRoomByInvite(code);
  if (!room) {
    return NextResponse.json({ error: "Invite not found." }, { status: 404 });
  }
  return NextResponse.json({ room });
}
