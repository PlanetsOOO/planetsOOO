import { NextResponse } from "next/server";
import {
  buildVerifyEmailUrl,
  isEmailVerified,
  issueEmailVerification,
} from "@/lib/auth/emailVerification";
import { sendVerificationEmail } from "@/lib/auth/sendEmail";
import { getUserByEmail } from "@/lib/entitlements/store";
import { verifyPassword } from "@/lib/auth/password";

export const runtime = "nodejs";

interface ResendBody {
  email?: string;
  password?: string;
}

/** Resend verification — requires email + password so tokens aren't spammable. */
export async function POST(request: Request) {
  let body: ResendBody;
  try {
    body = (await request.json()) as ResendBody;
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

  if (isEmailVerified(user)) {
    return NextResponse.json({ ok: true, alreadyVerified: true });
  }

  const issued = await issueEmailVerification(user);
  const verifyUrl = buildVerifyEmailUrl(issued.token);
  const mail = await sendVerificationEmail(user.email, verifyUrl);

  return NextResponse.json({
    ok: true,
    emailSent: mail.sent,
    ...(mail.sent ? {} : { verifyUrl }),
    message: mail.sent
      ? "Check your email for a verification link."
      : "Verify your email with the link below.",
  });
}
