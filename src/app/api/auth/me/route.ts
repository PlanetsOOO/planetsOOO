import { NextResponse } from "next/server";
import { getWebSession } from "@/lib/multiplayer/access";
import { getUserById, updateUser } from "@/lib/entitlements/store";
import { getEffectiveSubscriptionForUser } from "@/lib/auth/effectiveSubscription";
import { isEmailVerified } from "@/lib/auth/emailVerification";

export const runtime = "nodejs";

export async function GET() {
  const session = await getWebSession();
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  const emailVerified = isEmailVerified(user);
  if (!emailVerified) {
    return NextResponse.json({
      authenticated: false,
      needsVerification: true,
      email: user.email,
    });
  }

  const subscription = await getEffectiveSubscriptionForUser(user.id);

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      emailVerified: true,
      marketingOptIn: Boolean(user.marketingOptIn),
    },
    subscription: {
      status: subscription.status,
      active: subscription.active,
      source: subscription.source,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
  });
}

export async function PATCH(request: Request) {
  const session = await getWebSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user || !isEmailVerified(user)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { marketingOptIn?: boolean };
  try {
    body = (await request.json()) as { marketingOptIn?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.marketingOptIn !== "boolean") {
    return NextResponse.json(
      { error: "marketingOptIn boolean is required." },
      { status: 400 },
    );
  }

  const updated = await updateUser(user.id, {
    marketingOptIn: body.marketingOptIn,
    marketingOptInAt: body.marketingOptIn ? Date.now() : null,
  });

  return NextResponse.json({
    ok: true,
    marketingOptIn: Boolean(updated?.marketingOptIn),
  });
}
