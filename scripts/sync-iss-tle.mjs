#!/usr/bin/env node
/**
 * Fetches the latest ISS TLE from CelesTrak and writes public/data/iss.tle.json
 * Run: npm run sync:iss
 */
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../public/data/iss.tle.json");

const CELESTRAK_URL =
  "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE";

async function main() {
  const res = await fetch(CELESTRAK_URL, {
    headers: { "User-Agent": "PlanetsOOO/1.0 (ISS sync)" },
  });
  if (!res.ok) {
    throw new Error(`CelesTrak HTTP ${res.status}`);
  }

  const text = await res.text();
  const lines = text
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 3) {
    throw new Error("Unexpected TLE format from CelesTrak");
  }

  const payload = {
    name: lines[0],
    noradId: 25544,
    line1: lines[1],
    line2: lines[2],
    fetchedAt: new Date().toISOString(),
    source: CELESTRAK_URL,
  };

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${OUT}`);
  console.log(`Epoch (line 1): ${lines[1].slice(18, 32).trim()}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
