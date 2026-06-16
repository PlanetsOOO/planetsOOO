import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const extensionDir = path.join(root, "extension");
const textureDir = path.join(extensionDir, "textures");

const textures = [
  "2k_sun.jpg",
  "2k_mercury.jpg",
  "2k_venus_surface.jpg",
  "2k_earth_daymap.jpg",
  "2k_earth_clouds.jpg",
  "2k_mars.jpg",
  "2k_jupiter.jpg",
  "2k_saturn.jpg",
  "2k_saturn_ring_alpha.png",
  "2k_uranus.jpg",
  "2k_neptune.jpg",
];

await mkdir(textureDir, { recursive: true });

await Promise.all(
  textures.map((name) =>
    copyFile(
      path.join(root, "public", "textures", name),
      path.join(textureDir, name),
    ),
  ),
);

await build({
  entryPoints: [path.join(extensionDir, "offline-tour", "main.js")],
  outfile: path.join(extensionDir, "screensaver.js"),
  bundle: true,
  format: "iife",
  target: ["chrome110"],
  minify: true,
  sourcemap: false,
  legalComments: "none",
});

console.log("Built extension offline Three.js screensaver.");
