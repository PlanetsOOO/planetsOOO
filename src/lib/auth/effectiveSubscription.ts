import { isAdminSubscriptionEmail } from "@/lib/auth/adminEmails";
import { isEmailVerified } from "@/lib/auth/emailVerification";
import {
  getActiveSubscriptionForUser,
  getUserById,
} from "@/lib/entitlements/store";
import {
  isSubscriptionActive,
  type SubscriptionRecord,
  type UserRecord,
} from "@/lib/entitlements/types";

export type SubscriptionSource = "admin" | "stripe" | "none";

export interface EffectiveSubscription {
  active: boolean;
  source: SubscriptionSource;
  status: string | null;
  currentPeriodEnd: number | null;
  /** Stripe row when present (even if admin also applies). */
  stripeSubscription: SubscriptionRecord | null;
  emailVerified: boolean;
  adminWhitelisted: boolean;
}

/**
 * Resolves whether a user has multiplayer / paid-Online access.
 * Verified admin-whitelist emails are treated as subscribed (no Stripe yet).
 */
export async function getEffectiveSubscriptionForUser(
  userId: string,
): Promise<EffectiveSubscription> {
  const user = await getUserById(userId);
  if (!user) {
    return {
      active: false,
      source: "none",
      status: null,
      currentPeriodEnd: null,
      stripeSubscription: null,
      emailVerified: false,
      adminWhitelisted: false,
    };
  }
  return effectiveSubscriptionForUser(user);
}

export async function effectiveSubscriptionForUser(
  user: UserRecord,
): Promise<EffectiveSubscription> {
  const emailVerified = isEmailVerified(user);
  const adminWhitelisted = isAdminSubscriptionEmail(user.email);
  const stripeSubscription = await getActiveSubscriptionForUser(user.id);
  const stripeActive = stripeSubscription
    ? isSubscriptionActive(stripeSubscription.status)
    : false;

  if (emailVerified && adminWhitelisted) {
    return {
      active: true,
      source: "admin",
      status: "active",
      currentPeriodEnd: null,
      stripeSubscription,
      emailVerified,
      adminWhitelisted,
    };
  }

  if (stripeActive && stripeSubscription) {
    return {
      active: true,
      source: "stripe",
      status: stripeSubscription.status,
      currentPeriodEnd: stripeSubscription.currentPeriodEnd,
      stripeSubscription,
      emailVerified,
      adminWhitelisted,
    };
  }

  return {
    active: false,
    source: "none",
    status: stripeSubscription?.status ?? null,
    currentPeriodEnd: stripeSubscription?.currentPeriodEnd ?? null,
    stripeSubscription,
    emailVerified,
    adminWhitelisted,
  };
}
