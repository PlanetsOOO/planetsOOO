import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { hashPassword } from "@/lib/auth/password";
import {
  buildVerifyEmailUrl,
  issueEmailVerification,
} from "@/lib/auth/emailVerification";
import { sendVerificationEmail } from "@/lib/auth/sendEmail";
import { createUser, getUserByEmail } from "@/lib/entitlements/store";

export const runtime = "nodejs";

interface SignupBody {
  email?: string;
  password?: string;
  marketingOptIn?: boolean;
}

export async function POST(request: Request) {
  try {
    let body: SignupBody;
    try {
      body = (await request.json()) as SignupBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const email = body.email?.trim().toLowerCase() ?? "";
    const password = body.password ?? "";
    const marketingOptIn = Boolean(body.marketingOptIn);
    if (!email || !password || password.length < 8) {
      return NextResponse.json(
        { error: "Email and password (8+ characters) are required." },
        { status: 400 },
      );
    }

    if (await getUserByEmail(email)) {
      return NextResponse.json(
        { error: "Account already exists." },
        { status: 409 },
      );
    }

    const { hash, salt } = hashPassword(password);
    const now = Date.now();
    const user = await createUser({
      id: randomUUID(),
      email,
      passwordHash: hash,
      passwordSalt: salt,
      emailVerifiedAt: null,
      emailVerifyTokenHash: null,
      emailVerifyExpiresAt: null,
      marketingOptIn,
      marketingOptInAt: marketingOptIn ? now : null,
      createdAt: now,
    });

    const issued = await issueEmailVerification(user);
    const verifyUrl = buildVerifyEmailUrl(issued.token);
    const mail = await sendVerificationEmail(user.email, verifyUrl);

    // Never set a session until the email is verified.
    return NextResponse.json({
      ok: true,
      needsVerification: true,
      email: user.email,
      emailSent: mail.sent,
      // One-time link for the browser that just signed up when mail isn't configured.
      ...(mail.sent ? {} : { verifyUrl }),
      message: mail.sent
        ? "Check your email for a verification link."
        : "Verify your email with the link below to activate your account.",
    });
  } catch (err) {
    console.error("[auth/signup]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Unable to create account. Try again.",
      },
      { status: 500 },
    );
  }
}
