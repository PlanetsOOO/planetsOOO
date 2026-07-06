import { NextResponse } from "next/server";
import { getWebSession } from "@/lib/multiplayer/access";
import { getUserById } from "@/lib/entitlements/store";
import { getActiveSubscriptionForUser } from "@/lib/entitlements/store";
import { isSubscriptionActive } from "@/lib/entitlements/types";

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

  const subscription = await getActiveSubscriptionForUser(user.id);

  return NextResponse.json({
    authenticated: true,
    user: { id: user.id, email: user.email },
    subscription: subscription
      ? {
          status: subscription.status,
          active: isSubscriptionActive(subscription.status),
          currentPeriodEnd: subscription.currentPeriodEnd,
        }
      : null,
  });
}
