#!/usr/bin/env node
/**
 * Fetches planetary physical data from NASA/JPL Horizons and writes a local snapshot.
 * Run: npm run sync:nasa
 */
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "public/data/nasa-snapshot.json");

const BODIES = [
  ["sun", "10"],
  ["mercury", "199"],
  ["venus", "299"],
  ["earth", "399"],
  ["mars", "499"],
  ["jupiter", "599"],
  ["saturn", "699"],
  ["uranus", "799"],
  ["neptune", "899"],
];

const SUPPLEMENT = {
  sun: {
    moons: 0,
    description:
      "The Sun is a G-type main-sequence star containing more than 99% of the solar system's mass.",
    missions: "SDO · Parker Solar Probe · SOHO",
    imageryCredit: "NASA Solar Dynamics Observatory (SDO)",
    imageryUrl: "https://www.nasa.gov/mission_pages/sdo/main/index.html",
  },
  mercury: {
    moons: 0,
    description: "Mercury is the smallest planet and closest to the Sun.",
    missions: "MESSENGER · Mariner 10",
    imageryCredit: "NASA/USGS MESSENGER global mosaic",
    imageryUrl: "https://science.nasa.gov/mercury/",
  },
  venus: {
    moons: 0,
    description: "Venus has a thick CO₂ atmosphere and volcanic surface features.",
    missions: "Magellan · VERITAS · DAVINCI",
    imageryCredit: "NASA Magellan radar topography",
    imageryUrl: "https://science.nasa.gov/venus/",
  },
  earth: {
    moons: 1,
    description: "Earth is the only known planet with stable liquid surface water and life.",
    missions: "Earth Observing System · DSCOVR/EPIC",
    imageryCredit: "NASA Blue Marble Next Generation",
    imageryUrl: "https://visibleearth.nasa.gov/",
  },
  mars: {
    moons: 2,
    description: "Mars is a cold desert world studied by orbiters and rovers.",
    missions: "MRO · MAVEN · Perseverance",
    imageryCredit: "NASA/USGS Mars MOLA mosaic",
    imageryUrl: "https://science.nasa.gov/mars/",
  },
  jupiter: {
    moons: 95,
    description: "Jupiter is the largest planet, a gas giant with banded clouds.",
    missions: "Juno · Galileo · Voyager",
    imageryCredit: "NASA/JPL-Caltech/SwRI Juno",
    imageryUrl: "https://science.nasa.gov/jupiter/",
  },
  saturn: {
    moons: 146,
    description: "Saturn is known for its spectacular ring system.",
    missions: "Cassini-Huygens · Voyager",
    imageryCredit: "NASA/JPL-Caltech/SSI Cassini",
    imageryUrl: "https://science.nasa.gov/saturn/",
  },
  uranus: {
    moons: 28,
    description: "Uranus is an ice giant with an extreme axial tilt.",
    missions: "Voyager 2",
    imageryCredit: "NASA/JPL Voyager 2",
    imageryUrl: "https://science.nasa.gov/uranus/",
  },
  neptune: {
    moons: 16,
    description: "Neptune is the windiest planet with a deep blue atmosphere.",
    missions: "Voyager 2",
    imageryCredit: "NASA/JPL Voyager 2",
    imageryUrl: "https://science.nasa.gov/neptune/",
  },
};

const SCIENCE_URL = {
  sun: "https://science.nasa.gov/sun/facts/",
  mercury: "https://science.nasa.gov/mercury/facts/",
  venus: "https://science.nasa.gov/venus/facts/",
  earth: "https://science.nasa.gov/earth/facts/",
  mars: "https://science.nasa.gov/mars/facts/",
  jupiter: "https://science.nasa.gov/jupiter/facts/",
  saturn: "https://science.nasa.gov/saturn/facts/",
  uranus: "https://science.nasa.gov/uranus/facts/",
  neptune: "https://science.nasa.gov/neptune/facts/",
};

const AU = {
  sun: 0,
  mercury: 0.387,
  venus: 0.723,
  earth: 1.0,
  mars: 1.524,
  jupiter: 5.203,
  saturn: 9.537,
  uranus: 19.191,
  neptune: 30.069,
};

const NAMES = {
  sun: "Sun",
  mercury: "Mercury",
  venus: "Venus",
  earth: "Earth",
  mars: "Mars",
  jupiter: "Jupiter",
  saturn: "Saturn",
  uranus: "Uranus",
  neptune: "Neptune",
};

function cleanValue(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  const primary = trimmed.split(/\s{2,}/)[0]?.trim() ?? trimmed;
  return primary || null;
}

function parseHorizons(text) {
  const pick = (re) => {
    const m = text.match(re);
    return m ? cleanValue(m[1]) : null;
  };
  const num = (s) => {
    if (!s) return null;
    const n = parseFloat(s.replace(/[+,~<>]/g, "").split(/\s/)[0]);
    return Number.isFinite(n) ? n : null;
  };

  let diameterKm = null;
  for (const re of [
    /Vol\.\s*Mean\s*Radius\s*\(km\)\s*=\s*([^\n]+)/i,
    /Vol\.\s*mean\s*radius,?\s*km\s*=\s*([^\n]+)/i,
  ]) {
    const km = num(pick(re));
    if (km) {
      diameterKm = km * 2;
      break;
    }
  }

  return {
    diameterKm,
    massDescription: pick(/Mass[^=\n]*=\s*([^\n]+)/i),
    siderealDay:
      pick(/Mean sidereal day,?\s*hr\s*=\s*([^\n]+)/i) ??
      pick(/Sidereal rot\.\s*period\s*=\s*([^\n]+)/i) ??
      pick(/Sid\.\s*rot\.\s*period\s*\(III\)\s*=\s*([^\n]+)/i) ??
      pick(/Adopted sid\.\s*rot\.\s*per\.\s*=\s*([^\n]+)/i),
    orbitalPeriod:
      pick(/Sidereal orb(?:it)?\.?\s*per(?:iod)?\.?\s*=\s*([^\n]+)/i),
    meanTemperature:
      pick(/Mean surface temp[^=\n]*=\s*([^\n]+)/i) ??
      pick(/Mean Temperature\s*\(K\)\s*=\s*([^\n]+)/i) ??
      pick(/Effective temp,?\s*K\s*=\s*([0-9]+)/i) ??
      pick(/Atmos\.\s*temp\.\s*\([^)]*\)\s*=\s*([^\n]+)/i),
  };
}

async function fetchBody(id, command) {
  const params = new URLSearchParams({
    format: "json",
    COMMAND: `'${command}'`,
    MAKE_EPHEM: "NO",
    OBJ_DATA: "YES",
  });
  const url = `https://ssd.jpl.nasa.gov/api/horizons.api?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Horizons ${id}: HTTP ${res.status}`);
  const json = await res.json();
  if (!json.result) throw new Error(`Horizons ${id}: no result`);
  return json.result;
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const bodies = {};

  for (const [id, command] of BODIES) {
    process.stdout.write(`→ ${id}… `);
    const text = await fetchBody(id, command);
    const parsed = parseHorizons(text);
    const sup = SUPPLEMENT[id];
    bodies[id] = {
      id,
      name: NAMES[id],
      fetchedAt,
      sources: {
        horizons: {
          name: "NASA/JPL Horizons System",
          url: "https://ssd.jpl.nasa.gov/horizons/",
        },
        science: { name: "NASA Science", url: SCIENCE_URL[id] },
        imagery: { name: sup.imageryCredit, url: sup.imageryUrl },
      },
      ...parsed,
      distanceAu: AU[id],
      moons: sup.moons,
      description: sup.description,
      missions: sup.missions,
      imageryCredit: sup.imageryCredit,
      horizonsId: command,
    };
    console.log("ok");
  }

  const snapshot = {
    version: 1,
    generatedAt: fetchedAt,
    provider: "NASA/JPL Horizons System",
    bodies,
  };

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(snapshot, null, 2));
  console.log(`\nWrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
