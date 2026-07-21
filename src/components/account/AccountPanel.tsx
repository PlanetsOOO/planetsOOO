"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface MeResponse {
  authenticated: boolean;
  needsVerification?: boolean;
  email?: string;
  user?: {
    id: string;
    email: string;
    emailVerified?: boolean;
    marketingOptIn?: boolean;
  };
  subscription?: {
    status: string | null;
    active: boolean;
    source?: string;
    currentPeriodEnd: number | null;
  } | null;
}

export function AccountPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [marketingSaving, setMarketingSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data: MeResponse) => {
        setMe(data);
        if (!data.authenticated) router.replace("/login?next=/account");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function toggleMarketing(next: boolean) {
    setMarketingSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketingOptIn: next }),
      });
      if (!res.ok) return;
      setMe((prev) =>
        prev?.user
          ? {
              ...prev,
              user: { ...prev.user, marketingOptIn: next },
            }
          : prev,
      );
    } finally {
      setMarketingSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading account…</p>;
  }

  if (!me?.authenticated || !me.user) return null;

  const subscribed = me.subscription?.active ?? false;
  const accessSource = me.subscription?.source;

  return (
    <div className="space-y-6">
      {searchParams.get("subscribed") === "1" ? (
        <p className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          Subscription checkout completed. It may take a moment to activate.
        </p>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-black/40 p-6">
        <h1 className="font-mono text-sm uppercase tracking-[0.3em] text-zinc-400">
          Account
        </h1>
        <p className="mt-3 text-sm text-zinc-300">{me.user.email}</p>
        <p className="mt-1 text-xs text-emerald-200/80">Email verified</p>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-4 text-xs uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
        >
          Sign out
        </button>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/40 p-6">
        <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">
          Email updates
        </h2>
        <p className="mt-3 text-sm leading-7 text-zinc-400">
          Optional product notes from Orbit. Not a paid subscription.
        </p>
        <label className="mt-4 flex items-start gap-3 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={Boolean(me.user.marketingOptIn)}
            disabled={marketingSaving}
            onChange={(e) => void toggleMarketing(e.target.checked)}
            className="mt-1"
          />
          <span>Send me Orbit email updates</span>
        </label>
      </section>

      <section className="rounded-2xl border border-cyan-300/20 bg-cyan-500/5 p-6">
        <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-cyan-200/80">
          Orbit Online
        </h2>
        <p className="mt-3 text-sm leading-7 text-zinc-300">
          {subscribed
            ? accessSource === "admin"
              ? "Complimentary subscribed access is active on this account."
              : "Your subscription is active."
            : "Enter the Online demo after signing in. Paid subscriptions come later."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/online"
            className="rounded-lg bg-cyan-500/20 px-4 py-2 text-sm text-cyan-100 ring-1 ring-cyan-300/30"
          >
            Enter Orbit Online
          </Link>
          {subscribed ? (
            <Link
              href="/?multiplayer=1"
              className="rounded-lg bg-sky-500/20 px-4 py-2 text-sm text-sky-100 ring-1 ring-sky-300/30"
            >
              Open multiplayer explorer
            </Link>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/40 p-6">
        <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">
          Extension Premium
        </h2>
        <p className="mt-3 text-sm leading-7 text-zinc-400">
          One-time Premium unlocks offline flight in the Chrome extension. Purchase
          from the extension popup when you are ready.
        </p>
        <Link
          href="/extension"
          className="mt-4 inline-block text-sm text-sky-200 hover:text-sky-100"
        >
          Get the Orbit Screensaver extension
        </Link>
      </section>
    </div>
  );
}
