import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — Orbit",
  description:
    "How Orbit (planets.ooo) and the Orbit Screensaver Chrome extension handle data, Premium checkout, simulation disclaimers, and local storage.",
};

const LAST_UPDATED = "July 17, 2026";
const CONTACT_EMAIL = "privacy@planets.ooo";

function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-10 scroll-mt-8">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-100">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-zinc-400">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#030508] px-6 py-10 text-zinc-200">
      <article className="mx-auto max-w-2xl pb-16">
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.35em] text-sky-300/60">
          Orbit · planets.ooo
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
          Privacy Policy &amp; Disclaimer
        </h1>
        <p className="mt-4 text-sm text-zinc-500">Last updated: {LAST_UPDATED}</p>
        <p className="mt-6 text-sm leading-7 text-zinc-400">
          This page describes how the Orbit solar system explorer website (
          <a
            href="https://www.planets.ooo"
            className="text-sky-300/90 underline decoration-sky-300/30 underline-offset-2 hover:text-sky-200"
          >
            planets.ooo
          </a>
          ) and the <strong className="font-medium text-zinc-300">Orbit Screensaver</strong>{" "}
          Chrome extension collect, use, and store information. Orbit does not
          require a user account to explore or use the screensaver.
        </p>

        <Section title="Summary">
          <p>
            The screensaver extension stores your preferences and Premium unlock
            locally in Chrome. Premium checkout is processed by Stripe on
            planets.ooo; we do not receive or store card numbers. The website
            may call public NASA/JPL APIs for planetary facts. Optional AI
            features on the website send prompts to xAI only when you use them
            and only if the site operator has configured an API key.
          </p>
          <p>
            We do not sell personal information. We do not use advertising or
            social-media trackers in the extension or on the core explorer.
          </p>
        </Section>

        <Section id="simulation-disclaimer" title="Simulation & content disclaimer">
          <p>
            Orbit is an <strong className="font-medium text-zinc-300">educational hobbyist simulation</strong>{" "}
            for visualizing the solar system. Positions, distances, speeds, and
            visual effects are simplified or stylized for exploration — they are
            not certified for navigation, aviation, maritime use, astronomy
            research, or any safety-critical purpose.
          </p>
          <p>
            Planetary imagery, ephemeris data, and mission facts may be
            approximate, outdated, or incomplete. NASA and JPL data sources are
            credited where applicable;{" "}
            <strong className="font-medium text-zinc-300">NASA does not endorse this product</strong>.
          </p>
          <p>
            &quot;Imagine&quot; transit and lightspeed effects are visual overlays only
            and do not represent physically accurate travel or relativistic
            physics. Use your own judgment and consult authoritative sources
            for real-world decisions.
          </p>
        </Section>

        <Section title="Who we are (data controller)">
          <p>
            The operator of planets.ooo and the Orbit Screensaver extension
            (&quot;we,&quot; &quot;us&quot;) is responsible for the processing described in this
            policy. For privacy questions or requests, contact{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-sky-300/90 underline decoration-sky-300/30 underline-offset-2 hover:text-sky-200"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>

        <Section title="Chrome extension (Orbit Screensaver)">
          <p>Data stored locally on your device via Chrome extension storage:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-zinc-300">Settings</strong> — idle timeout,
              enabled state, display selection, flight/exit key choices (
              <code className="text-zinc-300">chrome.storage.sync</code>)
            </li>
            <li>
              <strong className="text-zinc-300">Premium status</strong> — a
              signed unlock token and a per-install identifier (
              <code className="text-zinc-300">chrome.storage.local</code>)
            </li>
            <li>
              <strong className="text-zinc-300">Debug metadata</strong> — last
              screensaver run status (local only, for troubleshooting)
            </li>
          </ul>
          <p>
            This data stays on your device unless you use Premium checkout (see
            below). Uninstalling the extension removes locally stored extension
            data. Chrome may sync settings across signed-in devices if you have
            Chrome Sync enabled for extensions.
          </p>
          <p>
            With your permission, the extension uses Chrome{" "}
            <code className="text-zinc-300">identity</code> /{" "}
            <code className="text-zinc-300">identity.email</code> and Google
            OAuth (<code className="text-zinc-300">openid</code>,{" "}
            <code className="text-zinc-300">email</code>,{" "}
            <code className="text-zinc-300">profile</code>) to bind Premium to
            your signed-in Chrome profile and restore it after reinstall. On
            restore, the extension sends a short-lived Google access token to
            planets.ooo so we can verify the Chrome profile; we validate the
            token with Google and do not store the access token.
          </p>
          <p>
            The extension requests permission to detect idle state, read tab
            information for screensaver windows, access display layout, and load
            content from planets.ooo when the online scenic tour is used.
          </p>
        </Section>

        <Section title="Premium purchase (Stripe)">
          <p>
            Premium is a one-time purchase completed on planets.ooo through{" "}
            <a
              href="https://stripe.com/privacy"
              className="text-sky-300/90 underline decoration-sky-300/30 underline-offset-2 hover:text-sky-200"
              rel="noopener noreferrer"
              target="_blank"
            >
              Stripe Checkout
            </a>
            . When you buy Premium, we send Stripe:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Your Chrome extension ID</li>
            <li>A random install ID generated by the extension</li>
            <li>
              Your Chrome profile identifier (GAIA id) when you purchase or
              restore Premium — stored with the purchase record so we can
              re-issue an unlock after reinstall on the same Chrome profile;
              contact support to transfer ownership if you change Chrome accounts
            </li>
            <li>Product metadata (Orbit Premium)</li>
          </ul>
          <p>
            Stripe processes payment and may collect billing details according
            to its own privacy policy. We receive confirmation that payment
            succeeded and issue a signed entitlement token bound to your
            extension ID and install ID. We do not store full payment card
            numbers on planets.ooo.
          </p>
        </Section>

        <Section title="Website (planets.ooo explorer)">
          <p>
            The web explorer runs in your browser. Standard hosting logs (IP
            address, user agent, request time) may be retained briefly by our
            hosting provider for security and reliability.
          </p>
          <p>
            <strong className="text-zinc-300">NASA / JPL data</strong> — Server
            routes may fetch public planetary data from NASA/JPL Horizons and
            related NASA sources. These requests use planet identifiers, not
            personal information about you.
          </p>
          <p>
            <strong className="text-zinc-300">Optional AI guide & Imagine</strong>{" "}
            — If enabled by the site operator, flight-guide and transit-effect
            features send your prompts and limited flight context to xAI&apos;s API.
            Do not enter passwords or sensitive personal data into AI prompts.
            AI features are optional and not required for the screensaver.
          </p>
          <p>
            <strong className="text-zinc-300">Browser storage</strong> — The
            website does not use third-party advertising cookies on the core
            explorer.
          </p>
        </Section>

        <Section title="Legal bases (EEA & UK)">
          <p>
            Where GDPR or UK GDPR applies, we rely on the following bases:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-zinc-300">Contract</strong> — processing
              needed to complete Premium checkout and deliver your unlock
            </li>
            <li>
              <strong className="text-zinc-300">Legitimate interests</strong> —
              operating and securing the website, preventing abuse, and
              maintaining extension functionality (balanced against your rights)
            </li>
            <li>
              <strong className="text-zinc-300">Consent</strong> — optional AI
              features when you actively use them; you may stop by not using those
              features
            </li>
          </ul>
        </Section>

        <Section title="Retention">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Extension settings and Premium tokens — until you uninstall the
              extension or clear extension data
            </li>
            <li>
              Premium purchase records — as long as needed to honor your unlock
              and meet tax/accounting obligations
            </li>
            <li>
              Hosting logs — typically days to weeks, per our hosting provider&apos;s
              defaults
            </li>
            <li>
              AI prompts — processed by xAI per their policy; we do not intend to
              build long-term profiles from optional AI use
            </li>
          </ul>
        </Section>

        <Section title="What we do not collect">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              No requirement to create an account to use the screensaver or buy
              Premium (optional planets.ooo login is only for multiplayer features)
            </li>
            <li>No sale of personal information</li>
            <li>
              No advertising trackers in the extension package we distribute
            </li>
            <li>
              No collection of browsing history outside planets.ooo screensaver
              pages and the extension&apos;s own pages
            </li>
          </ul>
        </Section>

        <Section title="Third-party services">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-zinc-300">Google</strong> — Chrome
              extension APIs, Web Store distribution, and OAuth token
              verification for Premium restore
            </li>
            <li>
              <strong className="text-zinc-300">Stripe</strong> — payment processing
            </li>
            <li>
              <strong className="text-zinc-300">Vercel</strong> — website hosting
            </li>
            <li>
              <strong className="text-zinc-300">NASA / JPL</strong> — public
              ephemeris and science data
            </li>
            <li>
              <strong className="text-zinc-300">xAI</strong> — optional AI features
              on the website only, when configured
            </li>
          </ul>
          <p>
            Some providers may process data in the United States or other
            countries. Where required, we rely on appropriate safeguards such as
            standard contractual clauses offered by those providers.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            Depending on where you live, you may have rights to access, correct,
            delete, or restrict certain processing of personal information, and
            to object or withdraw consent where processing is consent-based.
          </p>
          <p>
            <strong className="font-medium text-zinc-300">California (CCPA/CPRA)</strong>{" "}
            — We do not sell or share personal information for cross-context
            behavioral advertising. California residents may request disclosure
            or deletion by emailing{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-sky-300/90 underline decoration-sky-300/30 underline-offset-2 hover:text-sky-200"
            >
              {CONTACT_EMAIL}
            </a>
            . We will not discriminate against you for exercising these rights.
          </p>
          <p>
            <strong className="font-medium text-zinc-300">EEA & UK</strong> — You
            may lodge a complaint with your local supervisory authority. We
            encourage you to contact us first so we can try to resolve your
            concern.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Orbit is not directed at children under 13 (or 16 where applicable).
            We do not knowingly collect personal information from children.
          </p>
        </Section>

        <Section title="Your choices">
          <ul className="list-disc space-y-2 pl-5">
            <li>Disable or uninstall the extension at any time in Chrome</li>
            <li>Adjust screensaver settings in the extension popup</li>
            <li>Decline Premium purchase — Basic scenic mode remains available</li>
            <li>Disable Chrome Sync for extensions if you do not want settings synced</li>
            <li>Clear site data in your browser if you want to reset local website preferences</li>
          </ul>
        </Section>

        <Section title="Changes">
          <p>
            We may update this policy when features or legal requirements change.
            The &quot;Last updated&quot; date at the top will reflect the latest
            revision. Continued use after changes constitutes acceptance of the
            updated policy.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy, the simulation disclaimer, or your data:{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-sky-300/90 underline decoration-sky-300/30 underline-offset-2 hover:text-sky-200"
            >
              {CONTACT_EMAIL}
            </a>
            . You can also reach us through the Chrome Web Store listing support
            channel once published.
          </p>
        </Section>

        <p className="mt-12 border-t border-white/10 pt-8 text-xs leading-6 text-zinc-600">
          NASA imagery and mission data used in Orbit remain subject to{" "}
          <a
            href="https://www.nasa.gov/nasa-brand-center/images-and-media/"
            className="text-zinc-500 underline underline-offset-2 hover:text-zinc-400"
            rel="noopener noreferrer"
            target="_blank"
          >
            NASA media guidelines
          </a>
          . NASA does not endorse this product.
        </p>

        <p className="mt-6 text-center text-xs text-zinc-600">
          <Link
            href="/"
            className="text-zinc-500 underline underline-offset-2 hover:text-zinc-400"
          >
            Back to explorer
          </Link>
        </p>
      </article>
    </main>
  );
}
