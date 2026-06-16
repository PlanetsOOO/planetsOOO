import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Package the Chrome extension for distribution.
 *
 * Produces a clean, versioned zip (e.g. dist/orbit-screensaver-2.5.2.zip) that
 * contains only the files Chrome needs to run — never the `offline-tour/`
 * bundle source, README, or other repo files.
 *
 * Usage:
 *   node scripts/package-extension.mjs            # bump patch version, then zip
 *   node scripts/package-extension.mjs --minor    # bump minor (x.Y.0)
 *   node scripts/package-extension.mjs --major     # bump major (X.0.0)
 *   node scripts/package-extension.mjs --no-bump   # keep current version
 *   node scripts/package-extension.mjs --set 3.0.0 # set an explicit version
 *
 * Run the offline build first so the bundles are current (the `package:extension`
 * npm script chains both steps).
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const extensionDir = path.join(root, "extension");
const distDir = path.join(root, "dist");
const manifestPath = path.join(extensionDir, "manifest.json");

// Allowlist of everything that ships. Anything not listed here is excluded.
const INCLUDE = [
  "manifest.json",
  "background.js",
  "planetsContent.js",
  "popup.html",
  "popup.css",
  "popup.js",
  "screensaver.html",
  "screensaver.js",
  "screensaver.css",
  "screensaver-premium.html",
  "screensaver-premium.js",
  "screensaver-react.html",
  "screensaver-react.css",
  "screensaver-react.js",
  "icons",
  "data",
  "textures",
];

function parseVersionArg(argv) {
  if (argv.includes("--no-bump")) return { mode: "none" };
  if (argv.includes("--major")) return { mode: "major" };
  if (argv.includes("--minor")) return { mode: "minor" };
  const setIndex = argv.indexOf("--set");
  if (setIndex !== -1) {
    const value = argv[setIndex + 1];
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
  let [major, minor, patch] = parts;
  if (bump.mode === "major") return `${major + 1}.0.0`;
  if (bump.mode === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

// --- Validate the allowlisted files exist ----------------------------------
const missing = INCLUDE.filter((entry) => !existsSync(path.join(extensionDir, entry)));
if (missing.length > 0) {
  console.error(
    `Cannot package — missing extension files: ${missing.join(", ")}.\n` +
      "Did you run `npm run build:extension-offline` first?",
  );
  process.exit(1);
}

// --- Bump the manifest version ----------------------------------------------
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const bump = parseVersionArg(process.argv.slice(2));
const version = nextVersion(manifest.version, bump);

if (version !== manifest.version) {
  manifest.version = version;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`manifest.json version → ${version}`);
} else {
  console.log(`manifest.json version unchanged (${version})`);
}

// --- Zip the allowlisted files ----------------------------------------------
const slug = (manifest.name || "extension")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");
const zipName = `${slug}-${version}.zip`;
const zipPath = path.join(distDir, zipName);

mkdirSync(distDir, { recursive: true });
if (existsSync(zipPath)) rmSync(zipPath);

// `zip` from extensionDir keeps clean relative paths at the archive root.
execFileSync(
  "zip",
  ["-r", "-X", "-q", zipPath, ...INCLUDE, "-x", "*.DS_Store", "-x", "__MACOSX/*"],
  { cwd: extensionDir, stdio: "inherit" },
);

const sizeMb = (execFileSync("du", ["-k", zipPath]).toString().split("\t")[0] / 1024).toFixed(1);
console.log(`Packaged ${path.relative(root, zipPath)} (${sizeMb} MB)`);
console.log("Upload this zip in the Chrome Web Store dashboard, or load the");
console.log("extension/ folder unpacked for local testing.");
