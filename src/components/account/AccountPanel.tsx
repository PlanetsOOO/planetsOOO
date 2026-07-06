"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

interface MeResponse {
  authenticated: boolean;
  user?: { id: string; email: string };
  subscription?: {
    status: string;
    active: boolean;
    currentPeriodEnd: number;
  } | null;
}

export function AccountPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading account…</p>;
  }

  if (!me?.authenticated || !me.user) return null;

  const subscribed = me.subscription?.active ?? false;

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
          Orbit Multiplayer
        </h2>
        <p className="mt-3 text-sm leading-7 text-zinc-400">
          {subscribed
            ? "Your subscription is active. Join shared rooms on the explorer or through the extension when Premium is linked."
            : "Subscribe for gamified shared exploration on planets.ooo."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {subscribed ? (
            <>
              <Link
                href="/?multiplayer=1"
                className="rounded-lg bg-sky-500/20 px-4 py-2 text-sm text-sky-100 ring-1 ring-sky-300/30"
              >
                Open multiplayer explorer
              </Link>
              <form action="/api/subscription/portal" method="post">
                <button
                  type="submit"
                  className="rounded-lg px-4 py-2 text-sm text-zinc-400 ring-1 ring-white/10"
                >
                  Manage billing
                </button>
              </form>
            </>
          ) : (
            <form action="/api/subscription/checkout" method="post">
              <button
                type="submit"
                className="rounded-lg bg-sky-500/20 px-4 py-2 text-sm text-sky-100 ring-1 ring-sky-300/30"
              >
                Subscribe to Orbit Multiplayer
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/40 p-6">
        <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">
          Extension Premium
        </h2>
        <p className="mt-3 text-sm leading-7 text-zinc-400">
          One-time Premium unlocks offline flight in the extension. Multiplayer in
          the extension also requires an active subscription and account link.
        </p>
        <Link
          href="/premium"
          className="mt-4 inline-block text-sm text-sky-200 hover:text-sky-100"
        >
          Premium extension checkout
        </Link>
      </section>
    </div>
  );
}
