"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Status = "loading" | "ok" | "error";

export function VerifyEmailClient({ token }: { token: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Verifying your email…");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!token) {
        setStatus("error");
        setMessage("Missing verification token.");
        return;
      }
      try {
        const res = await fetch(
          `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
        );
        const data = (await res.json()) as { error?: string; email?: string };
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          setMessage(data.error ?? "Unable to verify email.");
          return;
        }
        setStatus("ok");
        setMessage("Email verified. Taking you to your account…");
        const next = searchParams.get("next") ?? "/account";
        window.setTimeout(() => {
          router.replace(next);
          router.refresh();
        }, 600);
      } catch {
        if (!cancelled) {
          setStatus("error");
          setMessage("Unable to verify email.");
        }
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [token, router, searchParams]);

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-black/40 p-6">
      <h1 className="font-mono text-sm uppercase tracking-[0.3em] text-zinc-400">
        Verify email
      </h1>
      <p
        className={`mt-4 text-sm leading-7 ${
          status === "error" ? "text-rose-300" : "text-zinc-300"
        }`}
      >
        {message}
      </p>
      {status === "error" ? (
        <p className="mt-6 text-xs text-zinc-600">
          <Link href="/login" className="hover:text-zinc-400">
            Back to sign in
          </Link>
        </p>
      ) : null}
    </div>
  );
}
