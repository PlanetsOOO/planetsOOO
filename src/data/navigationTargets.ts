import { ISS } from "@/data/iss";
import { MOON } from "@/data/moon";
import { PLANETS, type PlanetId } from "@/data/planets";

/** Planets, Earth's Moon, and LEO trackables. */
export type NavTargetId = PlanetId | "moon" | "iss";

export type NavTargetKind = "planet" | "moon" | "satellite";

export interface NavTarget {
  id: NavTargetId;
  name: string;
  kind: NavTargetKind;
}

export const MOON_TARGET: NavTarget = {
  id: "moon",
  name: MOON.name,
  kind: "moon",
};

export const ISS_TARGET: NavTarget = {
  id: "iss",
  name: ISS.name,
  kind: "satellite",
};

export const NAV_TARGETS: NavTarget[] = [
  ...PLANETS.map((p) => ({
    id: p.id as NavTargetId,
    name: p.name,
    kind: "planet" as const,
  })),
  MOON_TARGET,
  ISS_TARGET,
];

const ALIASES: Record<string, NavTargetId> = {
  sol: "sun",
  moon: "moon",
  luna: "moon",
  "the moon": "moon",
  iss: "iss",
  "international space station": "iss",
  "space station": "iss",
};

export function isNavTargetId(id: string): id is NavTargetId {
  return NAV_TARGETS.some((t) => t.id === id);
}

export function getNavTarget(id: NavTargetId): NavTarget {
  const target = NAV_TARGETS.find((t) => t.id === id);
  if (!target) throw new Error(`Unknown navigation target: ${id}`);
  return target;
}

export function getNavTargetName(id: NavTargetId): string {
  return getNavTarget(id).name;
}

export function isMoonTarget(id: NavTargetId): id is "moon" {
  return id === "moon";
}

export function isIssTarget(id: NavTargetId): id is "iss" {
  return id === "iss";
}

export function isSatelliteTarget(id: NavTargetId): id is "iss" {
  return id === "iss";
}

export function isPlanetTarget(id: NavTargetId): id is PlanetId {
  return !isMoonTarget(id);
}

export function filterNavTargets(query: string): NavTarget[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...NAV_TARGETS];

  const aliasId = ALIASES[q];

  return NAV_TARGETS.filter((target) => {
    if (aliasId && target.id === aliasId) return true;
    if (target.id.toLowerCase().includes(q)) return true;
    if (target.name.toLowerCase().includes(q)) return true;
    return false;
  });
}

export function resolveNavTargetQuery(query: string): NavTarget | null {
  const matches = filterNavTargets(query);
  if (matches.length === 0) return null;

  const q = query.trim().toLowerCase();
  const exact =
    matches.find((t) => t.id === q || t.name.toLowerCase() === q) ??
    matches.find((t) => ALIASES[q] === t.id);
  return exact ?? matches[0];
}

/** @deprecated use filterNavTargets */
export { filterNavTargets as filterPlanets };
/** @deprecated */
export function resolvePlanetQuery(query: string) {
  const t = resolveNavTargetQuery(query);
  if (!t || t.kind !== "planet") return null;
  return PLANETS.find((p) => p.id === t.id) ?? null;
}
