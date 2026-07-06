"use client";

import { useEffect, useState } from "react";

interface LeaderboardEntry {
  userId: string;
  displayName: string;
  discoveries: number;
  roomJoins: number;
  achievements: string[];
}

export function LeaderboardPanel() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    void fetch("/api/multiplayer/leaderboard")
      .then((res) => res.json())
      .then((data: { entries?: LeaderboardEntry[] }) => {
        setEntries(data.entries ?? []);
      })
      .catch(() => {});
  }, []);

  if (entries.length === 0) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 p-5">
      <h2 className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">
        Leaderboard
      </h2>
      <ol className="mt-4 space-y-2 text-sm text-zinc-300">
        {entries.map((entry, index) => (
          <li key={entry.userId} className="flex items-center justify-between gap-4">
            <span>
              {index + 1}. {entry.displayName}
            </span>
            <span className="font-mono text-xs text-zinc-500">
              {entry.discoveries} discoveries
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
