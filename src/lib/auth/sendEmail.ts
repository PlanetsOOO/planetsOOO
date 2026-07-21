import { optionalEnv } from "@/lib/env/serverSecrets";

export function hasTransactionalEmail(): boolean {
  return Boolean(optionalEnv("RESEND_API_KEY"));
}

/**
 * Send a transactional email via Resend when configured.
 * Returns false when no provider is configured (caller may expose a one-time link).
 */
export async function sendTransactionalEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = optionalEnv("RESEND_API_KEY");
  if (!apiKey) {
    console.info(
      `[auth/email] RESEND_API_KEY unset — skip send to ${input.to}: ${input.subject}`,
    );
    return { sent: false };
  }

  const from =
    optionalEnv("AUTH_EMAIL_FROM") ?? "Orbit <noreply@planets.ooo>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html ?? `<p>${input.text.replaceAll("\n", "<br/>")}</p>`,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[auth/email] Resend failed: ${res.status} ${detail}`);
      return { sent: false, error: "Unable to send verification email." };
    }
    return { sent: true };
  } catch (err) {
    console.error("[auth/email] Resend error", err);
    return { sent: false, error: "Unable to send verification email." };
  }
}

export async function sendVerificationEmail(
  to: string,
  verifyUrl: string,
): Promise<{ sent: boolean; error?: string }> {
  return sendTransactionalEmail({
    to,
    subject: "Verify your planets.ooo email",
    text: [
      "Welcome to Orbit / planets.ooo.",
      "",
      "Verify your email to activate your account:",
      verifyUrl,
      "",
      "This link expires in 24 hours. If you did not create an account, ignore this message.",
    ].join("\n"),
  });
}
