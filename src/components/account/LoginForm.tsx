"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Unable to authenticate.");
      const next = searchParams.get("next") ?? "/account";
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to authenticate.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-black/40 p-6">
      <h1 className="font-mono text-sm uppercase tracking-[0.3em] text-zinc-400">
        {mode === "login" ? "Sign in" : "Create account"}
      </h1>
      <p className="mt-3 text-sm leading-7 text-zinc-400">
        Use your planets.ooo account for Orbit Multiplayer and extension linking.
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-xs uppercase tracking-wider text-zinc-500">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-zinc-200"
            required
          />
        </label>
        <label className="block text-xs uppercase tracking-wider text-zinc-500">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-zinc-200"
            required
          />
        </label>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-sky-500/20 px-4 py-2 text-sm text-sky-100 ring-1 ring-sky-300/30"
        >
          {loading ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="mt-4 text-sm text-zinc-500 hover:text-zinc-300"
      >
        {mode === "login"
          ? "Need an account? Create one"
          : "Already have an account? Sign in"}
      </button>
      <p className="mt-6 text-xs text-zinc-600">
        <Link href="/multiplayer" className="hover:text-zinc-400">
          Learn about Orbit Multiplayer
        </Link>
      </p>
    </div>
  );
}
