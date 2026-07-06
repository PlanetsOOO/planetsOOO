import Link from "next/link";
import { ExtensionLinkClient } from "./ExtensionLinkClient";
import { CHROME_EXTENSION_ID_RE, UUID_RE } from "@/lib/premium/validation";

export default async function ExtensionAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ extensionId?: string; installId?: string }>;
}) {
  const params = await searchParams;
  const extensionId = params.extensionId?.trim() ?? "";
  const installId = params.installId?.trim() ?? "";
  const valid =
    CHROME_EXTENSION_ID_RE.test(extensionId) && UUID_RE.test(installId);

  return (
    <main className="min-h-screen bg-[#030508] px-6 py-16 text-zinc-200">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-xs uppercase tracking-[0.25em] text-zinc-600">
          ← Back to explorer
        </Link>
        <h1 className="mt-8 font-mono text-sm uppercase tracking-[0.3em] text-zinc-400">
          Link extension
        </h1>
        {!valid ? (
          <p className="mt-4 text-sm text-zinc-400">
            Open this page from the Orbit extension popup to link your install.
          </p>
        ) : (
          <ExtensionLinkClient extensionId={extensionId} installId={installId} />
        )}
      </div>
    </main>
  );
}
