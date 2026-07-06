import { createHmac, timingSafeEqual } from "node:crypto";
import { authSecret } from "@/lib/env/serverSecrets";

export type SessionTokenKind = "user-session" | "extension-session";

export interface UserSessionPayload {
  kind: SessionTokenKind;
  userId: string;
  email: string;
  extensionId?: string;
  installId?: string;
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
  return Buffer.from(padded.replaceAll("-", "+").replaceAll("_", "/"), "base64");
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function isPayload(value: unknown): value is UserSessionPayload {
  if (typeof value !== "object" || value == null) return false;
  const candidate = value as Partial<UserSessionPayload>;
  return (
    (candidate.kind === "user-session" ||
      candidate.kind === "extension-session") &&
    typeof candidate.userId === "string" &&
    candidate.userId.length > 0 &&
    typeof candidate.email === "string" &&
    typeof candidate.exp === "number" &&
    Number.isFinite(candidate.exp)
  );
}

export function signSessionToken(
  payload: Omit<UserSessionPayload, "exp"> & { exp?: number },
  secret = authSecret(),
): string {
  const fullPayload: UserSessionPayload = {
    ...payload,
    exp: payload.exp ?? Date.now() + 1000 * 60 * 60 * 24 * 30,
  };
  const encodedPayload = base64Url(JSON.stringify(fullPayload));
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifySessionToken(
  token: string,
  secret = authSecret(),
): UserSessionPayload | null {
  const parts = token.split(".");
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
    const payload = JSON.parse(decodeBase64Url(encodedPayload).toString("utf8"));
    if (!isPayload(payload)) return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "orbit_session";
