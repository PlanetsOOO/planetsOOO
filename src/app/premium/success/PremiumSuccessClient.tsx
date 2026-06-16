"use client";

import { useEffect, useState } from "react";

type ClaimStatus = "claiming" | "unlocked" | "extension-error" | "error";

interface PremiumSuccessClientProps {
  sessionId: string;
  extensionId: string;
}

interface ClaimResponse {
  entitlement?: string;
  extensionId?: string;
  installId?: string;
  error?: string;
}

interface UnlockResponse {
  ok?: boolean;
  error?: string;
}

type ChromeRuntime = {
  sendMessage?: (
    extensionId: string,
    message: unknown,
    callback: (response?: unknown) => void,
  ) => void;
  lastError?: { message?: string };
};

function chromeRuntime(): ChromeRuntime | null {
  const candidate = globalThis as typeof globalThis & {
    chrome?: { runtime?: ChromeRuntime };
  };
  return candidate.chrome?.runtime ?? null;
}

export function PremiumSuccessClient({
  sessionId,
  extensionId,
}: PremiumSuccessClientProps) {
  const [status, setStatus] = useState<ClaimStatus>("claiming");
  const [detail, setDetail] = useState("Verifying your purchase...");

  useEffect(() => {
    let cancelled = false;

    async function claim() {
      try {
        const res = await fetch("/api/premium/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const data = (await res.json()) as ClaimResponse;
        if (!res.ok || !data.entitlement || !data.extensionId) {
          throw new Error(data.error ?? "Unable to verify purchase.");
        }

        const runtime = chromeRuntime();
        if (!runtime?.sendMessage) {
          if (!cancelled) {
            setStatus("extension-error");
            setDetail("Purchase verified. Reopen the extension to finish unlock.");
          }
          return;
        }

        runtime.sendMessage(
          data.extensionId,
          { type: "premium-entitlement", entitlement: data.entitlement },
          (response) => {
            const message = runtime.lastError?.message;
            const unlock = response as UnlockResponse | undefined;
            if (cancelled) return;
            if (message) {
              setStatus("extension-error");
              setDetail(`Purchase verified, but extension unlock failed: ${message}`);
              return;
            }
            if (!unlock?.ok) {
              setStatus("extension-error");
              setDetail(
                `Purchase verified, but extension unlock failed: ${
                  unlock?.error ?? "Unknown extension error."
                }`,
              );
              return;
            }
            setStatus("unlocked");
            setDetail("Premium unlocked. You can close this tab and reopen Orbit.");
          },
        );
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setDetail(err instanceof Error ? err.message : "Unable to unlock Premium.");
      }
    }

    void claim();

    return () => {
      cancelled = true;
    };
  }, [extensionId, sessionId]);

  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">
        {status === "claiming"
          ? "Verifying"
          : status === "unlocked"
            ? "Unlocked"
            : "Action needed"}
      </p>
      <p className="mt-3 text-sm leading-7 text-zinc-300">{detail}</p>
      {status !== "claiming" && (
        <p className="mt-4 text-xs leading-5 text-zinc-500">
          If the popup is already open, close and reopen it so it can refresh
          your Premium status.
        </p>
      )}
    </div>
  );
}
