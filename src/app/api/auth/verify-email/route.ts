import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  signSessionToken,
} from "@/lib/auth/session";
import { verificationMatches } from "@/lib/auth/emailVerification";
import { findUserByVerifyToken } from "@/lib/auth/findUserByVerifyToken";
import { updateUser } from "@/lib/entitlements/store";

export const runtime = "nodejs";

async function completeVerification(token: string) {
  const trimmed = token.trim();
  if (!trimmed) {
    return { error: "Missing verification token.", status: 400 as const };
  }

  const user = await findUserByVerifyToken(trimmed);
  if (!user || !verificationMatches(user, trimmed)) {
    return {
      error: "Invalid or expired verification link.",
      status: 400 as const,
    };
  }

  const updated = await updateUser(user.id, {
    emailVerifiedAt: Date.now(),
    emailVerifyTokenHash: null,
    emailVerifyExpiresAt: null,
  });
  if (!updated) {
    return { error: "Unable to verify account.", status: 500 as const };
  }

  const session = signSessionToken({
    kind: "user-session",
    userId: updated.id,
    email: updated.email,
  });

  return { user: updated, session, status: 200 as const };
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const result = await completeVerification(token);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const response = NextResponse.json({
    ok: true,
    email: result.user.email,
    verified: true,
  });
  response.cookies.set(SESSION_COOKIE, result.session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function POST(request: Request) {
  let body: { token?: string };
  try {
    body = (await request.json()) as { token?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = await completeVerification(body.token ?? "");
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const response = NextResponse.json({
    ok: true,
    email: result.user.email,
    verified: true,
  });
  response.cookies.set(SESSION_COOKIE, result.session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
