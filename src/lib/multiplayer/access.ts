import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  signSessionToken,
  verifySessionToken,
  type UserSessionPayload,
} from "@/lib/auth/session";
import {
  getActiveSubscriptionForUser,
  getExtensionLink,
  getPremiumPurchaseByInstall,
} from "@/lib/entitlements/store";
import {
  isSubscriptionActive,
  type SubscriptionRecord,
} from "@/lib/entitlements/types";
import { verifyPremiumEntitlement } from "@/lib/premium/entitlement";

export type MultiplayerSurface = "web" | "extension";

export interface MultiplayerAccessResult {
  multiplayer: boolean;
  subscriptionActive: boolean;
  extensionPremium: boolean;
  linkedAccount: boolean;
  reason?: string;
  userId?: string;
  subscription?: SubscriptionRecord | null;
}

export async function getWebSession(): Promise<UserSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function resolveUserFromExtensionSession(
  sessionToken: string | null | undefined,
): Promise<UserSessionPayload | null> {
  if (!sessionToken) return null;
  const payload = verifySessionToken(sessionToken);
  if (!payload) return null;
  return payload;
}

export async function canAccessMultiplayer(input: {
  surface: MultiplayerSurface;
  userId?: string | null;
  extensionId?: string | null;
  installId?: string | null;
  premiumEntitlement?: string | null;
}): Promise<MultiplayerAccessResult> {
  const userId = input.userId ?? null;
  if (!userId) {
    return {
      multiplayer: false,
      subscriptionActive: false,
      extensionPremium: false,
      linkedAccount: false,
      reason: "Sign in to planets.ooo to access multiplayer.",
    };
  }

  const subscription = await getActiveSubscriptionForUser(userId);
  const subscriptionActive = subscription
    ? isSubscriptionActive(subscription.status)
    : false;

  if (input.surface === "web") {
    return {
      multiplayer: subscriptionActive,
      subscriptionActive,
      extensionPremium: false,
      linkedAccount: true,
      userId,
      subscription,
      reason: subscriptionActive
        ? undefined
        : "An active Orbit Multiplayer subscription is required.",
    };
  }

  const extensionId = input.extensionId?.trim() ?? "";
  const installId = input.installId?.trim() ?? "";
  if (!extensionId || !installId) {
    return {
      multiplayer: false,
      subscriptionActive,
      extensionPremium: false,
      linkedAccount: false,
      userId,
      subscription,
      reason: "Extension install metadata is missing.",
    };
  }

  const link = await getExtensionLink(extensionId, installId);
  const linkedAccount = link?.userId === userId;

  let extensionPremium = false;
  const entitlementSecret = process.env.PREMIUM_ENTITLEMENT_SECRET?.trim();
  if (input.premiumEntitlement && entitlementSecret) {
    const payload = verifyPremiumEntitlement(
      input.premiumEntitlement,
      entitlementSecret,
    );
    extensionPremium =
      payload != null &&
      payload.extensionId === extensionId &&
      payload.installId === installId;
  }
  if (!extensionPremium) {
    const purchase = await getPremiumPurchaseByInstall(extensionId, installId);
    extensionPremium = purchase != null;
  }

  const multiplayer =
    subscriptionActive && linkedAccount && extensionPremium;

  let reason: string | undefined;
  if (!subscriptionActive) {
    reason = "An active Orbit Multiplayer subscription is required.";
  } else if (!linkedAccount) {
    reason = "Link this extension install to your planets.ooo account.";
  } else if (!extensionPremium) {
    reason = "Orbit Premium extension purchase is required for extension multiplayer.";
  }

  return {
    multiplayer,
    subscriptionActive,
    extensionPremium,
    linkedAccount,
    userId,
    subscription,
    reason,
  };
}

export function readPremiumEntitlementFromHeader(
  request: Request,
): string | null {
  const header = request.headers.get("x-orbit-premium-entitlement");
  return header?.trim() || null;
}

export function readExtensionSessionFromHeader(
  request: Request,
): string | null {
  const header = request.headers.get("x-orbit-extension-session");
  return header?.trim() || null;
}

export async function resolveSessionForRequest(
  request: Request,
  surface: MultiplayerSurface,
): Promise<UserSessionPayload | null> {
  if (surface === "web") {
    return getWebSession();
  }
  const extensionSession = readExtensionSessionFromHeader(request);
  return resolveUserFromExtensionSession(extensionSession);
}

export function issueExtensionSessionToken(
  payload: Omit<UserSessionPayload, "kind" | "exp">,
): string {
  return signSessionToken({
    ...payload,
    kind: "extension-session",
  });
}
