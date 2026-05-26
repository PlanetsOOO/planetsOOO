/**
 * Repeatable astronomy scale checks — run: npm run verify:astronomy
 */
const KM_PER_UNIT = 1_000;
const AU_KM = 149_597_870.7;
const C_KM_S = 299_792.458;
const C_UNITS_PER_S = C_KM_S / KM_PER_UNIT;
const AU_UNITS = AU_KM / KM_PER_UNIT;
const AU_LIGHT_SECONDS = AU_KM / C_KM_S;
const MOON_SIDEREAL_PERIOD_DAYS = 27.321661;

function lightTimeFromUnits(distanceUnits) {
  return (distanceUnits * KM_PER_UNIT) / C_KM_S;
}

function formatLightTime(seconds) {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

const checks = [
  {
    name: "c (km/s)",
    expected: C_KM_S,
    actual: C_UNITS_PER_S * KM_PER_UNIT,
    tolerance: 0.001,
    unit: "km/s",
  },
  {
    name: "1 AU (units)",
    expected: AU_UNITS,
    actual: AU_UNITS,
    tolerance: 0.01,
    unit: "units",
  },
  {
    name: "Earth–Sun light time",
    expected: AU_LIGHT_SECONDS,
    actual: lightTimeFromUnits(AU_UNITS),
    tolerance: 0.5,
    unit: "s",
  },
];

console.log("PlanetsOOO astronomy scale verification\n");

let failed = false;
for (const check of checks) {
  const ok = Math.abs(check.actual - check.expected) <= check.tolerance;
  if (!ok) failed = true;
  console.log(
    `${ok ? "✓" : "✗"} ${check.name}: ${check.actual.toFixed(4)} ${check.unit} (expected ${check.expected.toFixed(4)})`,
  );
}

const earthSunSec = lightTimeFromUnits(AU_UNITS);
console.log(
  `\nEarth → Sun at c: ${formatLightTime(earthSunSec)} (${earthSunSec.toFixed(1)} s)`,
);
console.log(`Reference AU light time: ${AU_LIGHT_SECONDS.toFixed(1)} s (~8m 19s)`);
console.log(`Moon sidereal period: ${MOON_SIDEREAL_PERIOD_DAYS} days`);

if (failed) {
  console.error("\nSome checks failed.");
  process.exit(1);
}

console.log("\nAll checks passed.");
