import { createHash, randomBytes } from "node:crypto";
import { updateUser } from "@/lib/entitlements/store";
import type { UserRecord } from "@/lib/entitlements/types";

const VERIFY_TTL_MS = 1000 * 60 * 60 * 24; // 24h

export function hashEmailVerifyToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createEmailVerifyToken(): {
  token: string;
  tokenHash: string;
  expiresAt: number;
} {
  const token = randomBytes(32).toString("base64url");
  return {
    token,
    tokenHash: hashEmailVerifyToken(token),
    expiresAt: Date.now() + VERIFY_TTL_MS,
  };
}

export function isEmailVerified(user: UserRecord): boolean {
  return typeof user.emailVerifiedAt === "number" && user.emailVerifiedAt > 0;
}

export async function issueEmailVerification(
  user: UserRecord,
): Promise<{ token: string; expiresAt: number }> {
  const issued = createEmailVerifyToken();
  await updateUser(user.id, {
    emailVerifyTokenHash: issued.tokenHash,
    emailVerifyExpiresAt: issued.expiresAt,
    emailVerifiedAt: null,
  });
  return { token: issued.token, expiresAt: issued.expiresAt };
}

export function verificationMatches(user: UserRecord, token: string): boolean {
  if (!user.emailVerifyTokenHash || !user.emailVerifyExpiresAt) return false;
  if (user.emailVerifyExpiresAt < Date.now()) return false;
  return user.emailVerifyTokenHash === hashEmailVerifyToken(token);
}

export function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function buildVerifyEmailUrl(token: string): string {
  const url = new URL("/auth/verify", `${siteOrigin()}/`);
  url.searchParams.set("token", token);
  return url.toString();
}
