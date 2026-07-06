import { NextResponse } from "next/server";
import { getWebSession } from "@/lib/multiplayer/access";
import {
  getOrCreateProgression,
  updateProgression,
} from "@/lib/entitlements/store";

export const runtime = "nodejs";

interface DiscoveryBody {
  focusId?: string;
}

export async function POST(request: Request) {
  const session = await getWebSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: DiscoveryBody = {};
  try {
    body = (await request.json()) as DiscoveryBody;
  } catch {
    body = {};
  }

  const progression = await getOrCreateProgression(
    session.userId,
    session.email.split("@")[0] ?? "Pilot",
  );

  const achievements = new Set(progression.achievements);
  const discoveries = progression.discoveries + 1;
  if (discoveries >= 1) achievements.add("first-discovery");
  if (discoveries >= 5) achievements.add("scout");
  if (discoveries >= 20) achievements.add("voyager");

  const updated = await updateProgression(session.userId, {
    discoveries,
    achievements: Array.from(achievements),
  });

  void body.focusId;

  return NextResponse.json({ progression: updated });
}
