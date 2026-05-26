/** Parse NASA/JPL Horizons OBJ_DATA text blocks into structured fields. */

/** Horizons lines often pack multiple fields on one line; keep the primary value. */
function cleanValue(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const primary = trimmed.split(/\s{2,}/)[0]?.trim() ?? trimmed;
  return primary || null;
}

function firstMatch(text: string, pattern: RegExp): string | null {
  const m = text.match(pattern);
  return m ? cleanValue(m[1]) : null;
}

function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const n = parseFloat(value.replace(/[+,~<>]/g, "").split(/\s/)[0]);
  return Number.isFinite(n) ? n : null;
}

export interface ParsedHorizons {
  diameterKm: number | null;
  massDescription: string | null;
  siderealDay: string | null;
  orbitalPeriod: string | null;
  meanTemperature: string | null;
}

export function parseHorizonsObjectData(text: string): ParsedHorizons {
  const radiusPatterns = [
    /Vol\.\s*Mean\s*Radius\s*\(km\)\s*=\s*([^\n]+)/i,
    /Vol\.\s*mean\s*radius,?\s*km\s*=\s*([^\n]+)/i,
    /Equat\.\s*radius\s*\([^)]*\)\s*=\s*([^\n]+)/i,
  ];

  let diameterKm: number | null = null;
  for (const pattern of radiusPatterns) {
    const raw = firstMatch(text, pattern);
    const km = parseNumber(raw);
    if (km) {
      diameterKm = km * 2;
      break;
    }
  }

  const massRaw =
    firstMatch(text, /Mass[^=\n]*=\s*([^\n]+)/i) ??
    firstMatch(text, /Mass,\s*10\^24\s*kg\s*=\s*([^\n]+)/i);
  const massDescription = massRaw ?? null;

  const siderealDayHr = firstMatch(text, /Mean sidereal day,?\s*hr\s*=\s*([^\n]+)/i);
  const siderealRotPeriod = firstMatch(
    text,
    /Sidereal rot\.\s*period\s*=\s*([^\n]+)/i,
  );
  const siderealRotPeriodIII = firstMatch(
    text,
    /Sid\.\s*rot\.\s*period\s*\(III\)\s*=\s*([^\n]+)/i,
  );
  const adoptedSidRot = firstMatch(
    text,
    /Adopted sid\.\s*rot\.\s*per\.\s*=\s*([^\n]+)/i,
  );

  let siderealDay: string | null = null;
  if (siderealDayHr) {
    const hrs = parseNumber(siderealDayHr);
    siderealDay =
      hrs && hrs < 48
        ? `${hrs.toFixed(1)} hours`
        : siderealDayHr;
  } else if (siderealRotPeriodIII) {
    siderealDay = siderealRotPeriodIII;
  } else if (siderealRotPeriod) {
    siderealDay = siderealRotPeriod;
  } else if (adoptedSidRot) {
    siderealDay = adoptedSidRot;
  }

  const orbitYears = firstMatch(
    text,
    /Sidereal orb(?:it)?\.?\s*per(?:iod)?\.?\s*=\s*([0-9.]+)\s*y/i,
  );
  const orbitDays = firstMatch(
    text,
    /Sidereal orb(?:it)?\.?\s*per(?:iod)?\.?\s*=\s*([0-9.]+)\s*d/i,
  );
  const orbitYearsAlt = firstMatch(
    text,
    /Sidereal orb(?:it)?\.?\s*per(?:iod)?\.?\s*=\s*([^\n]+)/i,
  );

  let orbitalPeriod: string | null = null;
  if (orbitYears) {
    const y = parseNumber(orbitYears);
    orbitalPeriod = y
      ? y < 2
        ? `${(y * 365.25).toFixed(0)} Earth days`
        : `${y.toFixed(2)} Earth years`
      : `${orbitYears} years`;
  } else if (orbitDays && !orbitYears) {
    const d = parseNumber(orbitDays);
    orbitalPeriod = d ? `${d.toFixed(1)} Earth days` : orbitDays;
  } else if (orbitYearsAlt) {
    orbitalPeriod = orbitYearsAlt;
  }

  const tempK =
    firstMatch(text, /Mean surface temp[^=\n]*=\s*([^\n]+)/i) ??
    firstMatch(text, /Mean Temperature\s*\(K\)\s*=\s*([^\n]+)/i) ??
    firstMatch(text, /Effective temp,?\s*K\s*=\s*([^\n]+)/i) ??
    firstMatch(text, /Photosphere temp\.,?\s*K\s*=\s*([0-9]+)/i) ??
    firstMatch(text, /Atmos\.\s*temp\.\s*\([^)]*\)\s*=\s*([^\n]+)/i);

  let meanTemperature: string | null = null;
  if (tempK) {
    const k = parseNumber(tempK);
    if (k && k > 200) {
      const c = k - 273.15;
      meanTemperature = `~${Math.round(k)} K (${Math.round(c)} °C)`;
    } else {
      meanTemperature = tempK;
    }
  }

  return {
    diameterKm,
    massDescription,
    siderealDay,
    orbitalPeriod,
    meanTemperature,
  };
}
