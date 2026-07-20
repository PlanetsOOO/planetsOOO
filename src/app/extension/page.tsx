import { LegalFooter } from "@/components/LegalFooter";
import { ChromeIcon } from "@/components/icons/ChromeIcon";
import { CHROME_WEB_STORE_URL } from "@/lib/chromeWebStore";

export default function ExtensionDownloadPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030508] text-zinc-200">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(56,189,248,0.18), transparent 55%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(14,165,233,0.08), transparent 50%)",
        }}
        aria-hidden
      />

      <section className="relative mx-auto flex min-h-[80vh] max-w-2xl flex-col justify-center px-6 py-10">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.35em] text-sky-300/60">
          Orbit Screensaver
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
          Install from the Chrome Web Store
        </h1>
        <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400">
          Free scenic idle tour on planets.ooo. Premium unlocks offline flight from
          the extension popup. Sign into Chrome so Premium can restore after
          reinstall.
        </p>

        <div className="mt-10 space-y-4">
          <a
            href={CHROME_WEB_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex w-full items-center justify-center gap-3 rounded-xl border border-sky-300/35 bg-sky-400/15 px-5 py-4 text-center text-sm font-semibold text-sky-50 transition hover:border-sky-300/50 hover:bg-sky-400/25"
          >
            <ChromeIcon className="h-6 w-6" />
            Add to Chrome
          </a>
          <p className="text-center text-xs leading-5 text-zinc-600">
            Opens the official Chrome Web Store listing. Chrome installs and updates
            the extension from there — we do not host a separate download file.
          </p>
        </div>

        <ul className="mt-12 space-y-4 text-sm leading-7 text-zinc-400">
          <li>
            <span className="font-medium text-zinc-200">Basic (free)</span> — idle
            screensaver with the scenic solar system tour when online.
          </li>
          <li>
            <span className="font-medium text-zinc-200">Premium ($2.99)</span> —
            offline flight from the popup after checkout on planets.ooo.
          </li>
        </ul>

        <LegalFooter />
      </section>
    </main>
  );
}
