import { NextResponse } from "next/server";
import Stripe from "stripe";
import { requiredEnv } from "@/lib/env/serverSecrets";
import { getWebSession } from "@/lib/multiplayer/access";
import { getUserById } from "@/lib/entitlements/store";

export const runtime = "nodejs";

export async function POST() {
  const session = await getWebSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing profile yet. Subscribe first." },
      { status: 400 },
    );
  }

  let stripe: Stripe;
  try {
    stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe not configured";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.planets.ooo"}/account`,
  });

  return NextResponse.redirect(portal.url, 303);
}
