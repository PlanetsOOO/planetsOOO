export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete";

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  stripeCustomerId?: string;
  /** Epoch ms when email was verified; null/absent = unverified. */
  emailVerifiedAt?: number | null;
  /** SHA-256 hash of the current email verification token. */
  emailVerifyTokenHash?: string | null;
  emailVerifyExpiresAt?: number | null;
  /** Opt-in for Orbit product email updates (not a paid subscription). */
  marketingOptIn?: boolean;
  marketingOptInAt?: number | null;
  createdAt: number;
}

export interface PremiumPurchaseRecord {
  stripeSessionId: string;
  extensionId: string;
  installId: string;
  /** Current entitled install; updated when Premium is restored after reinstall. */
  activeInstallId: string;
  chromeGaiaId?: string;
  userId?: string;
  claimedAt?: number;
  issuedAt: number;
}

export interface SubscriptionRecord {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  userId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: number;
  updatedAt: number;
}

export interface ExtensionLinkRecord {
  extensionId: string;
  installId: string;
  userId: string;
  linkedAt: number;
}

export interface PlayerProgressionRecord {
  userId: string;
  displayName: string;
  discoveries: number;
  roomJoins: number;
  achievements: string[];
  updatedAt: number;
}

/** Orbit Online profile — faction allegiance for the PC Online demo / subscription. */
export interface OnlineProfileRecord {
  userId: string;
  factionId: string;
  displayName: string;
  /** Epoch ms when faction was chosen (cooldown hooks later). */
  factionChosenAt: number;
  updatedAt: number;
}

export interface EntitlementDatabase {
  users: Record<string, UserRecord>;
  premiumPurchases: Record<string, PremiumPurchaseRecord>;
  subscriptions: Record<string, SubscriptionRecord>;
  extensionLinks: Record<string, ExtensionLinkRecord>;
  progression: Record<string, PlayerProgressionRecord>;
  onlineProfiles: Record<string, OnlineProfileRecord>;
}

export function extensionLinkKey(extensionId: string, installId: string): string {
  return `${extensionId}:${installId}`;
}

export function isSubscriptionActive(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing";
}
