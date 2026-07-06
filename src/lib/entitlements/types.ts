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
  createdAt: number;
}

export interface PremiumPurchaseRecord {
  stripeSessionId: string;
  extensionId: string;
  installId: string;
  userId?: string;
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

export interface EntitlementDatabase {
  users: Record<string, UserRecord>;
  premiumPurchases: Record<string, PremiumPurchaseRecord>;
  subscriptions: Record<string, SubscriptionRecord>;
  extensionLinks: Record<string, ExtensionLinkRecord>;
  progression: Record<string, PlayerProgressionRecord>;
}

export function extensionLinkKey(extensionId: string, installId: string): string {
  return `${extensionId}:${installId}`;
}

export function isSubscriptionActive(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing";
}
