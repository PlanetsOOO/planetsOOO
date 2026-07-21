import { getEffectiveSubscriptionForUser } from "@/lib/auth/effectiveSubscription";
import { isEmailVerified } from "@/lib/auth/emailVerification";
import { getOnlineProfile, getUserById } from "@/lib/entitlements/store";
import { getFactionById } from "@/lib/online/factions";

export interface OnlineAccessResult {
  /** May enter Orbit Online (demo or paid). */
  online: boolean;
  /** Logged in but not on a paid / admin Orbit Online subscription. */
  demo: boolean;
  subscriptionActive: boolean;
  needsFaction: boolean;
  factionId: string | null;
  factionName: string | null;
  factionColor: string | null;
  userId?: string;
  email?: string;
  reason?: string;
}

/**
 * PC Online access: verified signed-in users may enter.
 * Admin-whitelist or Stripe subscription → non-demo (subscribed) mode.
 */
export async function canAccessOnline(input: {
  userId?: string | null;
  email?: string | null;
}): Promise<OnlineAccessResult> {
  const userId = input.userId ?? null;
  if (!userId) {
    return {
      online: false,
      demo: false,
      subscriptionActive: false,
      needsFaction: false,
      factionId: null,
      factionName: null,
      factionColor: null,
      reason: "Sign in to planets.ooo to enter Orbit Online.",
    };
  }

  const user = await getUserById(userId);
  if (!user || !isEmailVerified(user)) {
    return {
      online: false,
      demo: false,
      subscriptionActive: false,
      needsFaction: false,
      factionId: null,
      factionName: null,
      factionColor: null,
      userId,
      email: input.email ?? user?.email,
      reason: "Verify your email to enter Orbit Online.",
    };
  }

  const effective = await getEffectiveSubscriptionForUser(userId);
  const subscriptionActive = effective.active;
  const profile = await getOnlineProfile(userId);
  const faction = getFactionById(profile?.factionId);
  const needsFaction = !faction;

  return {
    online: true,
    demo: !subscriptionActive,
    subscriptionActive,
    needsFaction,
    factionId: faction?.id ?? null,
    factionName: faction?.name ?? null,
    factionColor: faction?.color ?? null,
    userId,
    email: user.email,
  };
}
