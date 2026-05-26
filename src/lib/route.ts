import type { NavTargetId } from "@/data/navigationTargets";

export function buildRouteWaypoints(
  origin: NavTargetId,
  stops: NavTargetId[],
  destination: NavTargetId,
): NavTargetId[] {
  return [origin, ...stops, destination];
}

/** Ordered visit list for a scenic tour (no redundant origin leg). */
export function buildTourWaypoints(visits: NavTargetId[]): NavTargetId[] {
  return [...visits];
}

export function isValidTour(visits: NavTargetId[]): boolean {
  return visits.length >= 2;
}

export function isValidRoute(
  origin: NavTargetId | null,
  destination: NavTargetId | null,
  stops: NavTargetId[],
): boolean {
  if (!origin || !destination) return false;
  if (origin === destination && stops.length === 0) return false;
  return true;
}

export const TOUR_PRESETS: { label: string; visits: NavTargetId[] }[] = [
  {
    label: "Inner worlds",
    visits: ["mercury", "venus", "earth", "mars"],
  },
  {
    label: "Gas giants",
    visits: ["jupiter", "saturn", "uranus", "neptune"],
  },
  {
    label: "Classic grand tour",
    visits: ["earth", "mars", "jupiter", "saturn"],
  },
  {
    label: "Earth & Moon",
    visits: ["earth", "moon"],
  },
];
