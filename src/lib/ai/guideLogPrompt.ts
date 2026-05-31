import type { GuideLogPhase } from "@/lib/ai/guideLogContext";
import type { NasaPlanetRecord } from "@/lib/nasa/types";

export const GUIDE_LOG_SYSTEM_PROMPT = `You write 2–3 brief HUD lines for a live solar system explorer.

Rules:
- Plain text only — no markdown, bullets, or labels with colons.
- Each line under 78 characters.
- Use only facts from provided DATA; do not invent precise numbers.
- One interesting fact per line when possible.
- No navigation instructions unless asked (this is a passive log).`;

export interface GuideLogAiContext {
  focusId: string;
  focusName: string;
  phase?: GuideLogPhase;
  nasa?: Pick<
    NasaPlanetRecord,
    | "description"
    | "diameterKm"
    | "orbitalPeriod"
    | "siderealDay"
    | "meanTemperature"
    | "distanceAu"
    | "moons"
    | "massDescription"
  > | null;
}

export function buildGuideLogUserMessage(context: GuideLogAiContext): string {
  const lines = [
    `Object: ${context.focusName} (${context.focusId})`,
  ];
  if (context.phase && context.phase !== "idle") {
    lines.push(`Viewer phase: ${context.phase}`);
  }

  const nasa = context.nasa;
  if (nasa) {
    lines.push("DATA:");
    if (nasa.description) lines.push(`Summary: ${nasa.description}`);
    if (nasa.diameterKm != null) {
      lines.push(`Diameter km: ${nasa.diameterKm}`);
    }
    if (nasa.orbitalPeriod) lines.push(`Orbital period: ${nasa.orbitalPeriod}`);
    if (nasa.siderealDay) lines.push(`Sidereal day: ${nasa.siderealDay}`);
    if (nasa.meanTemperature) {
      lines.push(`Mean temperature: ${nasa.meanTemperature}`);
    }
    if (nasa.distanceAu != null) {
      lines.push(`Distance from Sun AU: ${nasa.distanceAu}`);
    }
    if (nasa.moons != null) lines.push(`Known moons: ${nasa.moons}`);
    if (nasa.massDescription) lines.push(`Mass: ${nasa.massDescription}`);
  } else {
    lines.push("DATA: (none — use one widely known public fact, no numbers unless certain)");
  }

  lines.push("Write 2–3 HUD lines now.");
  return lines.join("\n");
}

export function parseGuideLogLines(raw: string): string[] {
  return raw
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter((line) => line.length > 0 && line.length <= 120)
    .slice(0, 3);
}
