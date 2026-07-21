import { createHmac, timingSafeEqual } from "node:crypto";
import { authSecret } from "@/lib/env/serverSecrets";
import type { UserRecord } from "@/lib/entitlements/types";

const VERIFY_TTL_MS = 1000 * 60 * 60 * 24; // 24h

export interface EmailVerifyPayload {
  purpose: "email-verify";
  userId: string;
  email: string;
  exp: number;
}

function base64Url(input: string): string {
  return Buffer.from(input)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function decodeBase64Url(input: string): Buffer {
  const padded = input.padEnd(
    input.length + ((4 - (input.length % 4)) % 4),
    "=",
  );
  return Buffer.from(
    padded.replaceAll("-", "+").replaceAll("_", "/"),
    "base64",
  );
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function isVerifyPayload(value: unknown): value is EmailVerifyPayload {
  if (typeof value !== "object" || value == null) return false;
  const c = value as Partial<EmailVerifyPayload>;
  return (
    c.purpose === "email-verify" &&
    typeof c.userId === "string" &&
    c.userId.length > 0 &&
    typeof c.email === "string" &&
    typeof c.exp === "number" &&
    Number.isFinite(c.exp)
  );
}

/**
 * Stateless signed verification token.
 * Survives Vercel multi-instance deploys (does not depend on /tmp token hashes).
 */
export function signEmailVerifyToken(
  user: Pick<UserRecord, "id" | "email">,
  secret = authSecret(),
): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + VERIFY_TTL_MS;
  const payload: EmailVerifyPayload = {
    purpose: "email-verify",
    userId: user.id,
    email: user.email.trim().toLowerCase(),
    exp: expiresAt,
  };
  const encodedPayload = base64Url(JSON.stringify(payload));
  return {
    token: `${encodedPayload}.${sign(encodedPayload, secret)}`,
    expiresAt,
  };
}

export function verifyEmailVerifyToken(
  token: string,
  secret = authSecret(),
): EmailVerifyPayload | null {
  const parts = token.trim().split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return null;

  const expected = sign(encodedPayload, secret);
  const signatureBuffer = decodeBase64Url(signature);
  const expectedBuffer = decodeBase64Url(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      decodeBase64Url(encodedPayload).toString("utf8"),
    ) as unknown;
    if (!isVerifyPayload(payload)) return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function isEmailVerified(user: UserRecord): boolean {
  return typeof user.emailVerifiedAt === "number" && user.emailVerifiedAt > 0;
}

export async function issueEmailVerification(
  user: UserRecord,
): Promise<{ token: string; expiresAt: number }> {
  // Prefer signed tokens; optionally stamp expiry on the user record when durable store works.
  const issued = signEmailVerifyToken(user);
  try {
    const { updateUser } = await import("@/lib/entitlements/store");
    await updateUser(user.id, {
      emailVerifyTokenHash: null,
      emailVerifyExpiresAt: issued.expiresAt,
      emailVerifiedAt: null,
    });
  } catch {
    // Store may be unavailable; signed token still works for verification.
  }
  return issued;
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
