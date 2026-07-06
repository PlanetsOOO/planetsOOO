import { NextResponse } from "next/server";
import {
  canAccessMultiplayer,
  getWebSession,
  readExtensionSessionFromHeader,
  readPremiumEntitlementFromHeader,
  resolveUserFromExtensionSession,
} from "@/lib/multiplayer/access";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const surfaceParam = url.searchParams.get("surface");
  const surface =
    surfaceParam === "extension" ? ("extension" as const) : ("web" as const);

  let userId: string | null = null;
  if (surface === "web") {
    const session = await getWebSession();
    userId = session?.userId ?? null;
  } else {
    const extensionSession = readExtensionSessionFromHeader(request);
    const payload = await resolveUserFromExtensionSession(extensionSession);
    userId = payload?.userId ?? null;
  }

  const extensionId = url.searchParams.get("extensionId");
  const installId = url.searchParams.get("installId");
  const premiumEntitlement = readPremiumEntitlementFromHeader(request);

  const access = await canAccessMultiplayer({
    surface,
    userId,
    extensionId,
    installId,
    premiumEntitlement,
  });

  return NextResponse.json(access);
}
