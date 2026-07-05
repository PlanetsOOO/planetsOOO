import { LegalFooter } from "@/components/LegalFooter";
import { PremiumSuccessClient } from "./PremiumSuccessClient";

type PremiumSuccessSearchParams = Promise<{
  session_id?: string;
  extensionId?: string;
}>;

interface PremiumSuccessPageProps {
  searchParams: PremiumSuccessSearchParams;
}

export default async function PremiumSuccessPage({
  searchParams,
}: PremiumSuccessPageProps) {
  const params = await searchParams;
  const sessionId = params.session_id ?? "";
  const extensionId = params.extensionId ?? "";
  const ready = sessionId.length > 0 && extensionId.length > 0;

  return (
    <main className="min-h-screen bg-[#030508] px-6 py-10 text-zinc-200">
      <section className="mx-auto flex min-h-[80vh] max-w-2xl flex-col justify-center">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.35em] text-sky-300/60">
          Orbit Premium
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
          Completing unlock
        </h1>
        {ready ? (
          <PremiumSuccessClient sessionId={sessionId} extensionId={extensionId} />
        ) : (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-sm leading-7 text-zinc-300">
              This unlock link is missing checkout information. Reopen Premium
              from the Orbit extension popup and try again.
            </p>
          </div>
        )}
        <LegalFooter />
      </section>
    </main>
  );
}
