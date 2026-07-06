"use client";

import { useEffect, useState } from "react";

type LinkStatus = "loading" | "needs-login" | "linking" | "linked" | "error";

interface ExtensionLinkClientProps {
  extensionId: string;
  installId: string;
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

export function ExtensionLinkClient({
  extensionId,
  installId,
}: ExtensionLinkClientProps) {
  const [status, setStatus] = useState<LinkStatus>("loading");
  const [detail, setDetail] = useState("Checking your session…");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const meRes = await fetch("/api/auth/me");
      const me = (await meRes.json()) as { authenticated?: boolean };
      if (!me.authenticated) {
        if (!cancelled) {
          setStatus("needs-login");
          setDetail("Sign in to link this extension install.");
        }
        return;
      }

      if (!cancelled) {
        setStatus("linking");
        setDetail("Linking extension install…");
      }

      const linkRes = await fetch("/api/auth/extension/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extensionId, installId }),
      });
      const linkData = (await linkRes.json()) as {
        extensionSession?: string;
        error?: string;
      };
      if (!linkRes.ok || !linkData.extensionSession) {
        if (!cancelled) {
          setStatus("error");
          setDetail(linkData.error ?? "Unable to link extension.");
        }
        return;
      }

      const runtime = chromeRuntime();
      if (!runtime?.sendMessage) {
        if (!cancelled) {
          setStatus("error");
          setDetail("Open this page from the extension popup to finish linking.");
        }
        return;
      }

      runtime.sendMessage(
        extensionId,
        {
          type: "extension-auth",
          extensionSession: linkData.extensionSession,
        },
        (response) => {
          const message = runtime.lastError?.message;
          const payload = response as { ok?: boolean; error?: string } | undefined;
          if (cancelled) return;
          if (message || !payload?.ok) {
            setStatus("error");
            setDetail(message ?? payload?.error ?? "Extension link failed.");
            return;
          }
          setStatus("linked");
          setDetail("Extension linked. You can close this tab.");
        },
      );
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [extensionId, installId]);

  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">
        Extension link
      </p>
      <p className="mt-3 text-sm leading-7 text-zinc-300">{detail}</p>
      {status === "needs-login" ? (
        <a
          href={`/login?next=${encodeURIComponent(
            `/auth/extension?extensionId=${extensionId}&installId=${installId}`,
          )}`}
          className="mt-4 inline-block rounded-lg bg-sky-500/20 px-4 py-2 text-sm text-sky-100 ring-1 ring-sky-300/30"
        >
          Sign in to continue
        </a>
      ) : null}
    </div>
  );
}
