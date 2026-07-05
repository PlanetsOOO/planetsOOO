import { LegalFooter } from "@/components/LegalFooter";

export default function ExtensionDownloadPage() {
  return (
    <main className="min-h-screen bg-[#030508] px-6 py-10 text-zinc-200">
      <section className="mx-auto flex min-h-[80vh] max-w-2xl flex-col justify-center">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.35em] text-sky-300/60">
          Orbit Screensaver
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
          Get the Orbit Chrome extension
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400">
          Premium checkout is linked to a specific extension install. Open
          Premium from the Orbit extension popup so your unlock can be applied to
          this browser.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-sky-300/20 bg-sky-300/10 text-sky-200"
              aria-hidden="true"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                <path
                  d="M9 3h6v4h4v6h-4v8H9v-8H5V7h4V3Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.25em] text-zinc-500">
                Chrome extension
              </p>
              <p className="mt-2 text-sm leading-7 text-zinc-300">
                The Chrome Web Store listing is coming soon. For local testing,
                reload the unpacked extension from `chrome://extensions`, then
                choose Premium from the extension popup.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled
            className="mt-6 w-full cursor-not-allowed rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-500"
          >
            Chrome Web Store link coming soon
          </button>
        </div>

        <LegalFooter />
      </section>
    </main>
  );
}
