import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const PREMIUM_PRICE_CENTS = 299;
const CHROME_EXTENSION_ID_RE = /^[a-p]{32}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function cleanParam(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function invalidParam(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  let stripe: Stripe;
  try {
    stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe not configured";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const formData = await request.formData();
  const extensionId = cleanParam(formData.get("extensionId"));
  const installId = cleanParam(formData.get("installId"));

  if (!extensionId || !installId) {
    return NextResponse.json(
      { error: "Extension id and install id are required." },
      { status: 400 },
    );
  }
  if (!CHROME_EXTENSION_ID_RE.test(extensionId)) {
    return invalidParam("Extension id is invalid.");
  }
  if (!UUID_RE.test(installId)) {
    return invalidParam("Install id is invalid.");
  }

  const origin = new URL(request.url).origin;
  const successUrl = new URL("/premium/success", origin);
  successUrl.searchParams.set("extensionId", extensionId);
  const successUrlString = `${successUrl.toString()}&session_id={CHECKOUT_SESSION_ID}`;

  const cancelUrl = new URL("/premium", origin);
  cancelUrl.searchParams.set("extensionId", extensionId);
  cancelUrl.searchParams.set("installId", installId);
  cancelUrl.searchParams.set("canceled", "1");

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrlString,
      cancel_url: cancelUrl.toString(),
      metadata: {
        product: "orbit-premium",
        extensionId,
        installId,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: PREMIUM_PRICE_CENTS,
            product_data: {
              name: "Orbit Screensaver Premium",
              description: "One-time unlock for extension flight mode.",
            },
          },
        },
      ],
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unable to create checkout session.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe did not return a checkout URL." },
      { status: 502 },
    );
  }

  return NextResponse.redirect(session.url, 303);
}
