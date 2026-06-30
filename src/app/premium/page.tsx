import { redirect } from "next/navigation";

type PremiumPageSearchParams = Promise<{
  extensionId?: string;
  installId?: string;
  canceled?: string;
}>;

interface PremiumPageProps {
  searchParams: PremiumPageSearchParams;
}

const CHROME_EXTENSION_ID_RE = /^[a-p]{32}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function PremiumPage({ searchParams }: PremiumPageProps) {
  const params = await searchParams;
  const extensionId = params.extensionId ?? "";
  const installId = params.installId ?? "";
  const ready =
    CHROME_EXTENSION_ID_RE.test(extensionId) && UUID_RE.test(installId);

  if (!ready) {
    redirect("/extension?from=premium");
  }

  return (
    <main className="min-h-screen bg-[#030508] px-6 py-10 text-zinc-200">
      <section className="mx-auto flex min-h-[80vh] max-w-2xl flex-col justify-center">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.35em] text-sky-300/60">
          Orbit Screensaver
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
          Unlock Premium flight mode
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400">
          Premium is a one-time $2.99 unlock for extension flight mode. Basic
          keeps the scenic screensaver, offline fallback, display selection, and
          fullscreen behavior.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">
                One-time cost
              </p>
              <p className="mt-2 text-4xl font-semibold text-zinc-50">$2.99</p>
            </div>
            <p className="max-w-xs text-right text-xs leading-5 text-zinc-500">
              Flight key, WASD controls, lightspeed, labels, and speed HUD.
            </p>
          </div>

          {params.canceled && (
            <p className="mt-5 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
              Checkout was canceled. You can try again anytime.
            </p>
          )}

          <form action="/api/premium/checkout" method="post" className="mt-6">
            <input type="hidden" name="extensionId" value={extensionId} />
            <input type="hidden" name="installId" value={installId} />
            <button
              type="submit"
              disabled={!ready}
              className="w-full rounded-xl border border-sky-300/30 bg-sky-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              Continue to secure checkout
            </button>
          </form>

        </div>

        <p className="mt-10 text-center text-xs text-zinc-600">
          Payments processed by Stripe.{" "}
          <a
            href="/privacy"
            className="text-zinc-500 underline underline-offset-2 hover:text-zinc-400"
          >
            Privacy policy
          </a>
        </p>
      </section>
    </main>
  );
}
