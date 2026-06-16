import { NextResponse } from "next/server";
import { verifyPremiumEntitlement } from "@/lib/premium/entitlement";

export const runtime = "nodejs";

interface VerifyBody {
  entitlement?: string;
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
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }

  let body: VerifyBody;
  try {
    body = (await request.json()) as VerifyBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const entitlement = body.entitlement?.trim();
  if (!entitlement) {
    return NextResponse.json(
      { ok: false, error: "entitlement is required" },
      { status: 400 },
    );
  }

  const payload = verifyPremiumEntitlement(entitlement, entitlementSecret);
  if (!payload) {
    return NextResponse.json(
      { ok: false, error: "Invalid entitlement." },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true, payload });
}
