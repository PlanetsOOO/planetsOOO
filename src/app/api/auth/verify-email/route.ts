import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  signSessionToken,
} from "@/lib/auth/session";
import { verifyEmailVerifyToken } from "@/lib/auth/emailVerification";
import { getUserById, updateUser } from "@/lib/entitlements/store";

export const runtime = "nodejs";

async function completeVerification(token: string) {
  const trimmed = token.trim();
  if (!trimmed) {
    return { error: "Missing verification token.", status: 400 as const };
  }

  const payload = verifyEmailVerifyToken(trimmed);
  if (!payload) {
    return {
      error: "Invalid or expired verification link.",
      status: 400 as const,
    };
  }

  const user = await getUserById(payload.userId);
  if (!user || user.email.trim().toLowerCase() !== payload.email) {
    return {
      error:
        "This verification link is valid, but the account could not be found. Please sign up again (accounts need durable storage on Vercel — see SERVICES.txt / BLOB_READ_WRITE_TOKEN).",
      status: 400 as const,
    };
  }

  if (
    typeof user.emailVerifiedAt === "number" &&
    user.emailVerifiedAt > 0
  ) {
    const session = signSessionToken({
      kind: "user-session",
      userId: user.id,
      email: user.email,
    });
    return { user, session, status: 200 as const, alreadyVerified: true };
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
