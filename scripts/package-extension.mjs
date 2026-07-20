import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Package the Chrome extension for distribution.
 *
 * Produces a clean, versioned zip (e.g. dist/orbit-screensaver-2.5.2.zip) that
 * contains only the files Chrome needs to run — never the `offline-tour/`
 * bundle source, README, or other repo files.
 *
 * By default uses `extension/manifest.store.json` (no localhost) for Chrome Web
 * Store uploads. Pass `--dev` to zip `extension/manifest.json` instead.
 *
 * Usage:
 *   node scripts/package-extension.mjs            # store zip (patch bump)
 *   node scripts/package-extension.mjs --dev      # dev zip with localhost
 *   node scripts/package-extension.mjs --minor    # bump minor (x.Y.0)
 *   node scripts/package-extension.mjs --major    # bump major (X.0.0)
 *   node scripts/package-extension.mjs --no-bump  # keep current version
 *   node scripts/package-extension.mjs --set 3.0.0
 *
 * Run the offline build first so the bundles are current (`package:extension`
 * npm script chains both steps).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const extensionDir = path.join(root, "extension");
const distDir = path.join(root, "dist");
const devManifestPath = path.join(extensionDir, "manifest.json");
const storeManifestPath = path.join(extensionDir, "manifest.store.json");

// Allowlist of everything that ships. Anything not listed here is excluded.
const INCLUDE = [
  "manifest.json",
  "background.js",
  "planetsContent.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "premiumIdentity.js",
  "screensaver.html",
  "screensaver.js",
  "screensaver.css",
  "screensaver-premium.html",
  "screensaver-premium.js",
  "screensaver-react.html",
  "screensaver-react.css",
  "screensaver-react.js",
  "offline-app/boot-error.js",
  "icons",
  "data",
  "textures",
];

const argv = process.argv.slice(2);
const packageDev = argv.includes("--dev");

const ADMIN_OVERRIDE_FLAG =
  "const ALLOW_ADMIN_PREMIUM_OVERRIDE = true;";
const ADMIN_OVERRIDE_FLAG_OFF =
  "const ALLOW_ADMIN_PREMIUM_OVERRIDE = false;";

const STORE_JS_TRANSFORMS = new Set(["background.js", "popup.js"]);

function copyExtensionEntry(entry, destPath) {
  const srcPath = path.join(extensionDir, entry);
  if (!packageDev && STORE_JS_TRANSFORMS.has(entry)) {
    const content = readFileSync(srcPath, "utf8");
    if (!content.includes(ADMIN_OVERRIDE_FLAG)) {
      throw new Error(
        `${entry} is missing ALLOW_ADMIN_PREMIUM_OVERRIDE — store strip would fail`,
      );
    }
    writeFileSync(
      destPath,
      content.replace(ADMIN_OVERRIDE_FLAG, ADMIN_OVERRIDE_FLAG_OFF),
    );
    return;
  }
  cpSync(srcPath, destPath, { recursive: true });
}

function parseVersionArg(args) {
  if (args.includes("--no-bump")) return { mode: "none" };
  if (args.includes("--major")) return { mode: "major" };
  if (args.includes("--minor")) return { mode: "minor" };
  const setIndex = args.indexOf("--set");
  if (setIndex !== -1) {
    const value = args[setIndex + 1];
    if (!value || !/^\d+\.\d+\.\d+$/.test(value)) {
      throw new Error("--set requires a version like 3.0.0");
    }
    return { mode: "set", value };
  }
  return { mode: "patch" };
}

function nextVersion(current, bump) {
  if (bump.mode === "none") return current;
  if (bump.mode === "set") return bump.value;

  const parts = current.split(".").map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`manifest version "${current}" is not X.Y.Z`);
  }
  const [major, minor, patch] = parts;
  if (bump.mode === "major") return `${major + 1}.0.0`;
  if (bump.mode === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

function writeManifest(filePath, manifest) {
  writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function applyOAuthClientId(manifest) {
  const clientId = process.env.CHROME_EXTENSION_OAUTH_CLIENT_ID?.trim();
  if (!clientId || !manifest.oauth2) return manifest;
  return {
    ...manifest,
    oauth2: {
      ...manifest.oauth2,
      client_id: clientId,
    },
  };
}

// --- Validate inputs and shipped files --------------------------------------
if (!existsSync(storeManifestPath)) {
  console.error("Missing extension/manifest.store.json");
  process.exit(1);
}

const missing = INCLUDE.filter(
  (entry) => entry !== "manifest.json" && !existsSync(path.join(extensionDir, entry)),
);
if (missing.length > 0) {
  console.error(
    `Cannot package — missing extension files: ${missing.join(", ")}.\n` +
      "Did you run `npm run build:extension-offline` first?",
  );
  process.exit(1);
}

// --- Bump version on both manifests (keep them in sync) ---------------------
const devManifest = JSON.parse(readFileSync(devManifestPath, "utf8"));
const storeManifest = JSON.parse(readFileSync(storeManifestPath, "utf8"));
const bump = parseVersionArg(argv);
const version = nextVersion(devManifest.version, bump);

if (version !== devManifest.version) {
  devManifest.version = version;
  storeManifest.version = version;
  writeManifest(devManifestPath, devManifest);
  writeManifest(storeManifestPath, storeManifest);
  console.log(`manifest version → ${version} (dev + store)`);
} else {
  console.log(`manifest version unchanged (${version})`);
}

const packagedManifest = applyOAuthClientId(
  packageDev ? devManifest : storeManifest,
);
const variantLabel = packageDev ? "dev" : "store";

// --- Stage allowlisted files with the chosen manifest -----------------------
const stageDir = path.join(distDir, ".extension-package-staging");
rmSync(stageDir, { recursive: true, force: true });
mkdirSync(stageDir, { recursive: true });

for (const entry of INCLUDE) {
  if (entry === "manifest.json") continue;
  copyExtensionEntry(entry, path.join(stageDir, entry));
}

writeManifest(path.join(stageDir, "manifest.json"), packagedManifest);

if (!packageDev) {
  const oauthId = packagedManifest.oauth2?.client_id ?? "";
  if (
    !oauthId ||
    oauthId.includes("REPLACE_WITH_CHROME_EXTENSION_OAUTH_CLIENT_ID")
  ) {
    console.warn(
      "\n⚠ Store zip OAuth client_id is still a placeholder.\n" +
        "  Premium restore will fail until you package with:\n" +
        "  CHROME_EXTENSION_OAUTH_CLIENT_ID=\"YOUR_ID.apps.googleusercontent.com\" npm run package:extension\n",
    );
  }
}

// --- Zip the staged tree ----------------------------------------------------
const slug = (packagedManifest.name || "extension")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");
const zipName = packageDev
  ? `${slug}-${version}-dev.zip`
  : `${slug}-${version}.zip`;
const zipPath = path.join(distDir, zipName);

mkdirSync(distDir, { recursive: true });
if (existsSync(zipPath)) rmSync(zipPath);

execFileSync(
  "zip",
  ["-r", "-X", "-q", zipPath, ".", "-x", "*.DS_Store", "-x", "__MACOSX/*"],
  { cwd: stageDir, stdio: "inherit" },
);

rmSync(stageDir, { recursive: true, force: true });

const sizeMb = (
  execFileSync("du", ["-k", zipPath]).toString().split("\t")[0] / 1024
).toFixed(1);
console.log(`Packaged ${path.relative(root, zipPath)} (${sizeMb} MB, ${variantLabel})`);
if (packageDev) {
  console.log("Dev zip includes localhost host_permissions for local testing.");
} else {
  console.log("Store zip uses manifest.store.json — upload in the Chrome Web Store dashboard.");
}
console.log("Load extension/ unpacked with manifest.json for day-to-day development.");
