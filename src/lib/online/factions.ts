/** Orbit Online factions — v1 roster (expand later). */

export interface OrbitFaction {
  id: string;
  name: string;
  tag: string;
  blurb: string;
  /** Accent for HUD / markers (CSS color). */
  color: string;
}

export const ORBIT_FACTIONS: readonly OrbitFaction[] = [
  {
    id: "solari",
    name: "Solari Compact",
    tag: "SOL",
    blurb: "Human-led trade league. Strong in the inner system.",
    color: "#7dd3fc",
  },
  {
    id: "kuiper-veil",
    name: "Kuiper Veil",
    tag: "KUI",
    blurb: "Ice-belt cartels. Excel at long-range logistics.",
    color: "#a5b4fc",
  },
  {
    id: "helios-guard",
    name: "Helios Guard",
    tag: "HEL",
    blurb: "Solar-orbit wardens. Defensive doctrine, hard to dislodge.",
    color: "#fcd34d",
  },
  {
    id: "voidborn",
    name: "Voidborn Clades",
    tag: "VOI",
    blurb: "Adapted to deep space. Fast strikes, fragile holds.",
    color: "#c084fc",
  },
  {
    id: "terra-remnant",
    name: "Terra Remnant",
    tag: "TER",
    blurb: "Earth-loyal flotillas. Balanced builders and scouts.",
    color: "#86efac",
  },
  {
    id: "ring-syndicate",
    name: "Ring Syndicate",
    tag: "RNG",
    blurb: "Gas-giant operators. Resource extraction specialists.",
    color: "#fda4af",
  },
] as const;

export type OrbitFactionId = (typeof ORBIT_FACTIONS)[number]["id"];

export function getFactionById(id: string | null | undefined): OrbitFaction | null {
  if (!id) return null;
  return ORBIT_FACTIONS.find((faction) => faction.id === id) ?? null;
}

export function isOrbitFactionId(id: string): id is OrbitFactionId {
  return ORBIT_FACTIONS.some((faction) => faction.id === id);
}
