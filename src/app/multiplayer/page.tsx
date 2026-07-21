import Link from "next/link";
import { LeaderboardPanel } from "@/components/multiplayer/LeaderboardPanel";

export default function MultiplayerPage() {
  return (
    <main className="min-h-screen bg-[#030508] px-6 py-16 text-zinc-200">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link href="/" className="text-xs uppercase tracking-[0.25em] text-zinc-600">
          ← Back to explorer
        </Link>

        <header>
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-zinc-500">
            Orbit Multiplayer
          </p>
          <h1 className="mt-3 text-3xl font-light text-zinc-100">
            Explore together. Keep simulation truth local.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-400">
            Orbit Online is the PC multiplayer franchise layer (factions, sessions,
            future peace/war). Demos are available after you create a planets.ooo
            account. It is separate from the one-time Premium extension purchase.
          </p>
          <Link
            href="/online"
            className="mt-6 inline-block rounded-lg bg-cyan-500/20 px-4 py-2 text-sm text-cyan-100 ring-1 ring-cyan-300/30"
          >
            Enter Orbit Online demo
          </Link>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-white/10 bg-black/40 p-5">
            <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">
              Premium extension
            </h2>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              One-time purchase. Offline/manual flight, labels, orbit paths, and
              scenic return in the Chrome extension.
            </p>
            <Link href="/premium" className="mt-4 inline-block text-sm text-sky-200">
              Get Premium extension
            </Link>
          </article>
          <article className="rounded-2xl border border-sky-300/20 bg-sky-500/5 p-5">
            <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-sky-200/80">
              Multiplayer subscription
            </h2>
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              Recurring subscription. Shared rooms on the website for all
              subscribers. Extension multiplayer requires Premium plus subscription
              plus linked account.
            </p>
            <Link href="/account" className="mt-4 inline-block text-sm text-sky-100">
              Manage subscription
            </Link>
          </article>
        </section>

        <section className="rounded-2xl border border-white/10 bg-black/40 p-5">
          <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">
            How access works
          </h2>
          <ul className="mt-4 space-y-2 text-sm leading-7 text-zinc-400">
            <li>Web multiplayer: active subscription and planets.ooo login.</li>
            <li>
              Extension multiplayer: Premium entitlement, active subscription, and
              linked install.
            </li>
            <li>Solo Premium flight never requires a subscription.</li>
          </ul>
        </section>

        <LeaderboardPanel />
      </div>
    </main>
  );
}
