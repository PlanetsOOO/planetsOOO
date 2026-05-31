"use client";

import { useExplorer } from "@/context/ExplorerContext";
import { useGuideLog } from "@/hooks/useGuideLog";
import { useMobileLandscape } from "@/hooks/useMobileLandscape";

export function GuideLog() {
  const { aiEnhanced } = useExplorer();
  const mobileLandscape = useMobileLandscape();
  const lines = useGuideLog(aiEnhanced);

  if (!aiEnhanced || lines.length === 0) return null;

  return (
    <div
      className={`fixed left-5 z-30 pointer-events-none select-none max-w-[min(280px,44vw)] font-mono leading-relaxed ${
        mobileLandscape ? "bottom-14" : "bottom-5"
      }`}
      aria-live="polite"
    >
      <p className="mb-1 text-[8px] uppercase tracking-[0.22em] text-zinc-600/45">
        Guide
      </p>
      <div className="space-y-0.5 text-[9px] text-zinc-600/55">
        {lines.map((line, index) => (
          <p
            key={`${index}-${line.slice(0, 24)}`}
            className={index < lines.length - 3 ? "text-zinc-600/45" : undefined}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
