import { NextResponse } from "next/server";
import Stripe from "stripe";
import { requiredEnv } from "@/lib/env/serverSecrets";
import {
  linkPremiumPurchaseToUser,
  upsertSubscription,
} from "@/lib/entitlements/store";
import type { SubscriptionStatus } from "@/lib/entitlements/types";

export const runtime = "nodejs";

function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "unpaid":
    case "incomplete":
      return status;
    default:
      return "incomplete";
  }
}

function subscriptionPeriodEndMs(subscription: Stripe.Subscription): number {
  const itemEnd = subscription.items.data[0]?.current_period_end;
  if (itemEnd) return itemEnd * 1000;
  const legacyEnd = (subscription as Stripe.Subscription & {
    current_period_end?: number;
  }).current_period_end;
  if (legacyEnd) return legacyEnd * 1000;
  return Date.now() + 30 * 24 * 60 * 60 * 1000;
}

async function syncSubscription(
  stripe: Stripe,
  subscription: Stripe.Subscription,
): Promise<void> {
  const userId =
    subscription.metadata.userId ??
    (typeof subscription.customer === "string"
      ? undefined
      : subscription.customer.deleted
        ? undefined
        : subscription.customer.metadata?.userId);

  if (!userId) return;

  await upsertSubscription({
    stripeSubscriptionId: subscription.id,
    stripeCustomerId:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
    userId,
    status: mapStatus(subscription.status),
    currentPeriodEnd: subscriptionPeriodEndMs(subscription),
    updatedAt: Date.now(),
  });
}

export async function POST(request: Request) {
  let stripe: Stripe;
  let webhookSecret: string;
  try {
    stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
    webhookSecret = requiredEnv("STRIPE_WEBHOOK_SECRET");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe not configured";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature." }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid webhook signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (
        session.mode === "payment" &&
        session.metadata?.product === "orbit-premium" &&
        session.metadata.userId &&
        session.id
      ) {
        await linkPremiumPurchaseToUser(
          session.id,
          session.metadata.userId,
        );
      }
      if (session.mode === "subscription" && session.subscription) {
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscription(stripe, subscription);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscription(stripe, subscription);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
