import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const extensionDir = path.join(root, "extension");
const dataDir = path.join(extensionDir, "data");
const textureDir = path.join(extensionDir, "textures");
const srcDir = path.join(root, "src");

const textures = [
  "2k_sun.jpg",
  "2k_mercury.jpg",
  "2k_venus_surface.jpg",
  "2k_earth_daymap.jpg",
  "2k_earth_clouds.jpg",
  "2k_earth_nightmap.jpg",
  "2k_moon.jpg",
  "2k_stars.jpg",
  "2k_mars.jpg",
  "2k_jupiter.jpg",
  "2k_saturn.jpg",
  "2k_saturn_ring_alpha.png",
  "2k_uranus.jpg",
  "2k_neptune.jpg",
];

const dataFiles = [
  "stars.6.json",
  "constellations.lines.json",
  "dsos.bright.json",
  "nasa-snapshot.json",
  "iss.tle.json",
];

await Promise.all([
  mkdir(textureDir, { recursive: true }),
  mkdir(dataDir, { recursive: true }),
]);

await Promise.all(
  textures.map((name) =>
    copyFile(
      path.join(root, "public", "textures", name),
      path.join(textureDir, name),
    ),
  ),
);

await Promise.all(
  dataFiles.map((name) =>
    copyFile(
      path.join(root, "public", "data", name),
      path.join(dataDir, name),
    ),
  ),
);

const sharedBuildOptions = {
  bundle: true,
  format: "iife",
  target: ["chrome110"],
  minify: true,
  sourcemap: false,
  legalComments: "none",
  // Let the offline bundles reuse the app's pure simulation modules
  // (ephemeris, scale, planet data) via the same `@` path alias as tsconfig.
  alias: { "@": srcDir },
  resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
};

// Basic offline tour: standalone studio-showcase (no shared sim).
await build({
  ...sharedBuildOptions,
  entryPoints: [path.join(extensionDir, "offline-tour", "main.js")],
  outfile: path.join(extensionDir, "screensaver.js"),
});

// Premium offline tour: real to-scale solar system reusing the app's ephemeris.
await build({
  ...sharedBuildOptions,
  entryPoints: [path.join(extensionDir, "offline-tour", "premium.js")],
  outfile: path.join(extensionDir, "screensaver-premium.js"),
});

// Premium React/R3F explorer: shared online scene, packaged for MV3 offline use.
execFileSync(
  "npx",
  [
    "@tailwindcss/cli",
    "-i",
    path.join(extensionDir, "offline-app", "explorer.css"),
    "-o",
    path.join(extensionDir, "screensaver-react.css"),
    "--minify",
  ],
  { cwd: root, stdio: "inherit" },
);

await build({
  ...sharedBuildOptions,
  entryPoints: [path.join(extensionDir, "offline-app", "main.tsx")],
  outfile: path.join(extensionDir, "screensaver-react.js"),
  alias: {
    ...sharedBuildOptions.alias,
    three: path.join(srcDir, "lib/threeExtensionShim.ts"),
    "next/link": path.join(extensionDir, "offline-app", "nextLinkShim.tsx"),
  },
  banner: {
    js: 'if(typeof globalThis.process=="undefined"){globalThis.process={env:{NODE_ENV:"production"}};}',
  },
  define: {
    "process.env.NODE_ENV": "\"production\"",
  },
});

console.log("Built extension offline screensavers (basic, legacy premium, React premium).");
