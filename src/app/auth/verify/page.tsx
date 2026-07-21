import { Suspense } from "react";
import { VerifyEmailClient } from "./VerifyEmailClient";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = params.token?.trim() ?? "";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#030508] px-6 py-16 text-zinc-200">
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <VerifyEmailClient token={token} />
      </Suspense>
    </main>
  );
}
