import { NextResponse } from "next/server";
import Stripe from "stripe";
import { requiredEnv } from "@/lib/env/serverSecrets";
import { getWebSession } from "@/lib/multiplayer/access";
import { getUserById, updateUser } from "@/lib/entitlements/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getWebSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let stripe: Stripe;
  try {
    stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe not configured";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const priceId = process.env.STRIPE_MULTIPLAYER_PRICE_ID?.trim();

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: user.id, product: "orbit-multiplayer" },
    });
    customerId = customer.id;
    await updateUser(user.id, { stripeCustomerId: customerId });
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    success_url: `${origin}/account?subscribed=1`,
    cancel_url: `${origin}/multiplayer?canceled=1`,
    metadata: {
      product: "orbit-multiplayer",
      userId: user.id,
    },
    subscription_data: {
      metadata: {
        product: "orbit-multiplayer",
        userId: user.id,
      },
    },
    line_items: priceId
      ? [{ price: priceId, quantity: 1 }]
      : [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: 499,
              recurring: { interval: "month" },
              product_data: {
                name: "Orbit Multiplayer",
                description:
                  "Gamified shared exploration on planets.ooo and the extension.",
              },
            },
          },
        ],
  });

  if (!checkout.url) {
    return NextResponse.json(
      { error: "Stripe did not return a checkout URL." },
      { status: 502 },
    );
  }

  return NextResponse.redirect(checkout.url, 303);
}
