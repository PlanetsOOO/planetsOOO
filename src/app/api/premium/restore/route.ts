import { NextResponse } from "next/server";
import {
  getPremiumPurchaseByGaiaId,
  updatePremiumActiveInstall,
} from "@/lib/entitlements/store";
import { verifyGoogleAccessToken } from "@/lib/google/verifyAccessToken";
import { signPremiumEntitlement } from "@/lib/premium/entitlement";
import { optionalEnv } from "@/lib/env/serverSecrets";
import {
  CHROME_EXTENSION_ID_RE,
  CHROME_GAIA_ID_RE,
  UUID_RE,
} from "@/lib/premium/validation";

export const runtime = "nodejs";

interface RestoreBody {
  extensionId?: string;
  installId?: string;
  accessToken?: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export async function POST(request: Request) {
  let entitlementSecret: string;
  try {
    entitlementSecret = requiredEnv("PREMIUM_ENTITLEMENT_SECRET");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Premium not configured";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  let body: RestoreBody;
  try {
    body = (await request.json()) as RestoreBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const extensionId = body.extensionId?.trim() ?? "";
  const installId = body.installId?.trim() ?? "";
  const accessToken = body.accessToken?.trim() ?? "";

  if (!CHROME_EXTENSION_ID_RE.test(extensionId)) {
    return NextResponse.json({ error: "Invalid extension id." }, { status: 400 });
  }
  if (!UUID_RE.test(installId)) {
    return NextResponse.json({ error: "Invalid install id." }, { status: 400 });
  }
  if (!accessToken) {
    return NextResponse.json(
      { error: "Google access token is required." },
      { status: 400 },
    );
  }

  const oauthClientId = optionalEnv("CHROME_EXTENSION_OAUTH_CLIENT_ID");
  if (!oauthClientId) {
    return NextResponse.json(
      { error: "Premium restore is not configured." },
      { status: 503 },
    );
  }

  const tokenInfo = await verifyGoogleAccessToken(accessToken, oauthClientId);
  if (!tokenInfo) {
    return NextResponse.json(
      { error: "Unable to verify Chrome sign-in. Try again." },
      { status: 401 },
    );
  }

  const chromeGaiaId = tokenInfo.userId;
  if (!CHROME_GAIA_ID_RE.test(chromeGaiaId)) {
    return NextResponse.json(
      { error: "Chrome profile id is invalid." },
      { status: 400 },
    );
  }

  const purchase = await getPremiumPurchaseByGaiaId(extensionId, chromeGaiaId);
  if (!purchase?.chromeGaiaId) {
    return NextResponse.json(
      { error: "No Premium purchase found for this Chrome profile." },
      { status: 404 },
    );
  }

  const activeInstallId = purchase.activeInstallId ?? purchase.installId;
  if (activeInstallId !== installId) {
    await updatePremiumActiveInstall(purchase.stripeSessionId, installId);
  }

  const entitlement = signPremiumEntitlement(
    {
      product: "orbit-premium",
      plan: "premium",
      installId,
      extensionId,
      stripeSessionId: purchase.stripeSessionId,
      issuedAt: Date.now(),
    },
    entitlementSecret,
  );

  return NextResponse.json({ ok: true, entitlement, extensionId, installId });
}
