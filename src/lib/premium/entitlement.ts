import { createHmac, timingSafeEqual } from "node:crypto";

export interface PremiumEntitlementPayload {
  product: "orbit-premium";
  plan: "premium";
  installId: string;
  extensionId: string;
  stripeSessionId: string;
  issuedAt: number;
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

function signEncodedPayload(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function isPremiumEntitlementPayload(
  payload: unknown,
): payload is PremiumEntitlementPayload {
  if (typeof payload !== "object" || payload == null) return false;
  const candidate = payload as Partial<PremiumEntitlementPayload>;
  return (
    candidate.product === "orbit-premium" &&
    candidate.plan === "premium" &&
    typeof candidate.installId === "string" &&
    candidate.installId.length > 0 &&
    typeof candidate.extensionId === "string" &&
    candidate.extensionId.length > 0 &&
    typeof candidate.stripeSessionId === "string" &&
    candidate.stripeSessionId.length > 0 &&
    typeof candidate.issuedAt === "number" &&
    Number.isFinite(candidate.issuedAt)
  );
}

export function signPremiumEntitlement(
  payload: PremiumEntitlementPayload,
  secret: string,
): string {
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = signEncodedPayload(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function verifyPremiumEntitlement(
  entitlement: string,
  secret: string,
): PremiumEntitlementPayload | null {
  const parts = entitlement.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signEncodedPayload(encodedPayload, secret);
  const signatureBuffer = decodeBase64Url(signature);
  const expectedBuffer = decodeBase64Url(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload).toString("utf8"));
    return isPremiumEntitlementPayload(payload) ? payload : null;
  } catch {
    return null;
  }
}
