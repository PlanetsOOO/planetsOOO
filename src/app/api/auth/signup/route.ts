import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE,
  signSessionToken,
} from "@/lib/auth/session";
import { createUser, getUserByEmail } from "@/lib/entitlements/store";

export const runtime = "nodejs";

interface SignupBody {
  email?: string;
  password?: string;
}

export async function POST(request: Request) {
  let body: SignupBody;
  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Email and password (8+ characters) are required." },
      { status: 400 },
    );
  }

  if (await getUserByEmail(email)) {
    return NextResponse.json({ error: "Account already exists." }, { status: 409 });
  }

  const { hash, salt } = hashPassword(password);
  const user = await createUser({
    id: randomUUID(),
    email,
    passwordHash: hash,
    passwordSalt: salt,
    createdAt: Date.now(),
  });

  const token = signSessionToken({
    kind: "user-session",
    userId: user.id,
    email: user.email,
  });

  const response = NextResponse.json({ ok: true, userId: user.id, email: user.email });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
