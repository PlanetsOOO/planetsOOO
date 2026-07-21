#!/usr/bin/env node
/**
 * Guard the Chrome extension ↔ planets.ooo web contract.
 *
 * Catches the class of deploy bugs where .vercelignore accidentally strips
 * web routes the published extension depends on (e.g. bare "extension/"
 * matching src/app/extension and src/app/auth/extension).
 *
 * Usage: node scripts/verify-extension-web.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function fail(message) {
  errors.push(message);
}

function assertExists(relPath, why) {
  const abs = path.join(root, relPath);
  if (!existsSync(abs)) {
    fail(`Missing ${relPath} (${why})`);
  }
}

/** Paths the packaged extension opens or calls on planets.ooo. */
const WEB_CONTRACT_PATHS = [
  ["src/app/extension/page.tsx", "Chrome Web Store / install landing"],
  ["src/app/auth/extension/page.tsx", "extension account link handoff"],
  ["src/app/premium/page.tsx", "Premium checkout entry (redirects to /extension)"],
  ["src/app/premium/success/page.tsx", "Premium checkout return"],
  ["src/app/privacy/page.tsx", "popup privacy link"],
  ["src/app/api/premium/verify/route.ts", "extension entitlement verify"],
  ["src/app/api/premium/restore/route.ts", "extension Premium restore"],
  ["src/app/api/premium/checkout/route.ts", "Premium Stripe checkout"],
  ["src/app/api/premium/claim/route.ts", "Premium claim after checkout"],
  ["src/app/api/auth/extension/link/route.ts", "extension↔account link API"],
  ["src/lib/screensaverConfig.ts", "hosted ?screensaver=1 / ?flight= contract"],
  ["src/components/explorer/ScreensaverBootstrap.tsx", "orbit-screensaver-* events for content script"],
  ["src/data/astronomy.ts", "must stay deployable (do not vercelignore src/data)"],
];

for (const [rel, why] of WEB_CONTRACT_PATHS) {
  assertExists(rel, why);
}

const screensaverConfig = readFileSync(
  path.join(root, "src/lib/screensaverConfig.ts"),
  "utf8",
);
for (const token of [
  "isScreensaverMode",
  "readScreensaverConfig",
  "isExtensionPackaged",
  "orbit-screensaver-flight-mode",
]) {
  if (token === "orbit-screensaver-flight-mode") {
    const bootstrap = readFileSync(
      path.join(root, "src/components/explorer/ScreensaverBootstrap.tsx"),
      "utf8",
    );
    if (!bootstrap.includes(token)) {
      fail(`ScreensaverBootstrap must dispatch ${token} for planetsContent.js`);
    }
  } else if (!screensaverConfig.includes(token)) {
    fail(`screensaverConfig.ts must export/keep ${token}`);
  }
}

// Root /extension/ is intentionally omitted from Vercel uploads (.vercelignore).
// Vercel may leave an empty extension/ directory after ignore — require real sources.
const backgroundPath = path.join(root, "extension/background.js");
const contentPath = path.join(root, "extension/planetsContent.js");
if (existsSync(backgroundPath) && existsSync(contentPath)) {
  const background = readFileSync(backgroundPath, "utf8");
  for (const needle of [
    "/api/premium/verify",
    "/api/premium/restore",
    "www.planets.ooo",
  ]) {
    if (!background.includes(needle)) {
      fail(`extension/background.js must reference ${needle}`);
    }
  }

  const content = readFileSync(contentPath, "utf8");
  for (const needle of [
    "orbit-screensaver-flight-mode",
    "orbit-screensaver-speed",
    "screensaver",
  ]) {
    if (!content.includes(needle)) {
      fail(`extension/planetsContent.js must listen for / use ${needle}`);
    }
  }
} else {
  console.log(
    "verify-extension-web: skipping packaged extension/ checks (absent; expected on Vercel)",
  );
}

/** .vercelignore must root-anchor dirs that also exist under src/. */
const vercelignorePath = path.join(root, ".vercelignore");
if (!existsSync(vercelignorePath)) {
  fail("Missing .vercelignore");
} else {
  const lines = readFileSync(vercelignorePath, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  const dangerousBare = ["extension/", "data/"];
  for (const bare of dangerousBare) {
    if (lines.includes(bare)) {
      fail(
        `.vercelignore has bare "${bare}" — use "/${bare}" so src/**/${bare.slice(0, -1)} is not stripped from deploys`,
      );
    }
  }

  if (!lines.includes("/extension/")) {
    fail('.vercelignore must include "/extension/" (root Chrome package only)');
  }
  if (!lines.includes("/data/")) {
    fail('.vercelignore must include "/data/" (root data only; keep src/data)');
  }

  // Spot-check: walk a few web paths that must NOT match ignore rules.
  const mustShip = [
    "src/app/extension/page.tsx",
    "src/app/auth/extension/page.tsx",
    "src/data/astronomy.ts",
    "src/app/api/premium/verify/route.ts",
  ];
  for (const rel of mustShip) {
    const segments = rel.split("/");
    if (segments.includes("extension") && lines.includes("extension/")) {
      fail(`${rel} would be ignored by bare extension/`);
    }
    if (segments.includes("data") && lines.includes("data/")) {
      fail(`${rel} would be ignored by bare data/`);
    }
  }
}

if (errors.length) {
  console.error("verify-extension-web failed:\n");
  for (const e of errors) console.error(`  • ${e}`);
  process.exit(1);
}

console.log("verify-extension-web: OK");
console.log("  Web install/Premium/auth routes present");
console.log("  Screensaver URL + CustomEvent contract intact");
console.log("  .vercelignore root-anchors /extension/ and /data/");
