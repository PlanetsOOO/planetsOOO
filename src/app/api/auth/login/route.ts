import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  signSessionToken,
} from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import {
  buildVerifyEmailUrl,
  isEmailVerified,
  issueEmailVerification,
} from "@/lib/auth/emailVerification";
import { sendVerificationEmail } from "@/lib/auth/sendEmail";
import { getUserByEmail } from "@/lib/entitlements/store";

export const runtime = "nodejs";

interface LoginBody {
  email?: string;
  password?: string;
}

export async function POST(request: Request) {
  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const user = await getUserByEmail(email);
  if (
    !user ||
    !verifyPassword(password, user.passwordHash, user.passwordSalt)
  ) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  if (!isEmailVerified(user)) {
    const issued = await issueEmailVerification(user);
    const verifyUrl = buildVerifyEmailUrl(issued.token);
    const mail = await sendVerificationEmail(user.email, verifyUrl);
    return NextResponse.json(
      {
        error: "Verify your email before signing in.",
        needsVerification: true,
        emailSent: mail.sent,
        ...(mail.sent ? {} : { verifyUrl }),
      },
      { status: 403 },
    );
  }

  const token = signSessionToken({
    kind: "user-session",
    userId: user.id,
    email: user.email,
  });

  const response = NextResponse.json({
    ok: true,
    userId: user.id,
    email: user.email,
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
