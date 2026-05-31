import { ASTRONOMY, KM_PER_UNIT } from "@/data/astronomy";
import { MOON } from "@/data/moon";
import {
  isPlanetTarget,
  type NavTargetId,
} from "@/data/navigationTargets";

export function staticGuideFactLines(focusId: NavTargetId): string[] {
  if (isPlanetTarget(focusId)) {
    const astro = ASTRONOMY[focusId];
    const lines = [
      `Radius · ${Math.round(astro.radiusKm).toLocaleString()} km`,
    ];
    if (astro.orbitalPeriodDays > 0) {
      lines.push(`Orbit · ${astro.orbitalPeriodDays.toFixed(1)} Earth days`);
    }
    if (astro.semiMajorAxisKm > 0) {
      lines.push(
        `Semi-major axis · ${Math.round(astro.semiMajorAxisKm / 1_000_000).toLocaleString()} Mm`,
      );
    }
    return lines.slice(0, 2);
  }

  if (focusId === "moon") {
    return [
      `Radius · ${Math.round(MOON.radius * KM_PER_UNIT).toLocaleString()} km`,
      "Earth's only natural satellite",
    ];
  }

  return [];
}
