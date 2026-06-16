import { NextResponse } from "next/server";
import Stripe from "stripe";
import { signPremiumEntitlement } from "@/lib/premium/entitlement";

export const runtime = "nodejs";

const PREMIUM_PRICE_CENTS = 299;
const STRIPE_SESSION_ID_RE = /^cs_(test|live)_[A-Za-z0-9_]+$/;

interface ClaimBody {
  sessionId?: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export async function POST(request: Request) {
  let stripe: Stripe;
  let entitlementSecret: string;
  try {
    stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
    entitlementSecret = requiredEnv("PREMIUM_ENTITLEMENT_SECRET");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Premium not configured";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  let body: ClaimBody;
  try {
    body = (await request.json()) as ClaimBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }
  if (!STRIPE_SESSION_ID_RE.test(sessionId)) {
    return NextResponse.json(
      { error: "sessionId is invalid" },
      { status: 400 },
    );
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to retrieve checkout session.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
  if (
    session.mode !== "payment" ||
    session.payment_status !== "paid" ||
    session.currency !== "usd" ||
    (session.amount_total ?? 0) < PREMIUM_PRICE_CENTS ||
    session.metadata?.product !== "orbit-premium"
  ) {
    return NextResponse.json(
      { error: "Checkout session is not a paid Orbit Premium purchase." },
      { status: 402 },
    );
  }

  const installId = session.metadata?.installId;
  const extensionId = session.metadata?.extensionId;
  if (!installId || !extensionId) {
    return NextResponse.json(
      { error: "Checkout session is missing extension metadata." },
      { status: 400 },
    );
  }

  const entitlement = signPremiumEntitlement(
    {
      product: "orbit-premium",
      plan: "premium",
      installId,
      extensionId,
      stripeSessionId: session.id,
      issuedAt: Date.now(),
    },
    entitlementSecret,
  );

  return NextResponse.json({ entitlement, extensionId, installId });
}
