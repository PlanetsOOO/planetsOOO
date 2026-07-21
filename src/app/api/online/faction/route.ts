import { NextResponse } from "next/server";
import { getWebSession } from "@/lib/multiplayer/access";
import {
  getOnlineProfile,
  getUserById,
  upsertOnlineProfile,
} from "@/lib/entitlements/store";
import { canAccessOnline } from "@/lib/online/access";
import {
  ORBIT_FACTIONS,
  getFactionById,
  isOrbitFactionId,
} from "@/lib/online/factions";

export const runtime = "nodejs";

interface FactionBody {
  factionId?: string;
}

export async function GET() {
  const session = await getWebSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const profile = await getOnlineProfile(session.userId);
  return NextResponse.json({
    factions: ORBIT_FACTIONS,
    profile,
    faction: getFactionById(profile?.factionId) ?? null,
  });
}

export async function POST(request: Request) {
  const session = await getWebSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const access = await canAccessOnline({
    userId: session.userId,
    email: session.email,
  });
  if (!access.online) {
    return NextResponse.json(
      { error: access.reason ?? "Orbit Online access denied." },
      { status: 403 },
    );
  }

  let body: FactionBody;
  try {
    body = (await request.json()) as FactionBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const factionId = body.factionId?.trim() ?? "";
  if (!isOrbitFactionId(factionId)) {
    return NextResponse.json({ error: "Invalid faction." }, { status: 400 });
  }

  const existing = await getOnlineProfile(session.userId);
  if (existing?.factionId && existing.factionId !== factionId) {
    return NextResponse.json(
      {
        error:
          "Faction already chosen for this account. Season resets will allow changes later.",
      },
      { status: 409 },
    );
  }

  const user = await getUserById(session.userId);
  const displayName =
    existing?.displayName ||
    user?.email?.split("@")[0] ||
    "Pilot";
  const now = Date.now();
  const profile = await upsertOnlineProfile({
    userId: session.userId,
    factionId,
    displayName,
    factionChosenAt: existing?.factionChosenAt ?? now,
    updatedAt: now,
  });

  return NextResponse.json({
    ok: true,
    profile,
    faction: getFactionById(factionId),
  });
}
