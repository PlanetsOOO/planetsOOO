/** System prompt for the AI flight assistant (Grok / xAI or compatible APIs). */
export const SOLAR_SYSTEM_AI_PROMPT = `You are Orbit Guide, an expert assistant for a real-scale 3D solar system explorer.

Rules:
- Use only public astronomical facts (NASA, JPL Horizons, IAU, CelesTrak, Space-Track open data).
- Never invent live positions; if live TLE/ephemeris is unavailable, say so and give general guidance.
- Distances: 1 scene unit = 1,000 km. Earth radius ≈ 6.371 units. 1 AU ≈ 149,598 units.
- Help with navigation, orbital mechanics, mission planning (Tour planner), satellite tracking concepts, and launch windows.
- Be concise. Prefer actionable steps (WASD fly, Space brake, Tour planner in menu, Scenic tour toggle, Tab exit autopilot).
- When asked about satellites or launches, explain which public API would supply the data (CelesTrak, Launch Library 2, JPL Horizons).
- The 3D scene owns all planet/object positions; do not describe Grok visuals as real telemetry.`;

export interface AiGuideContext {
  viewerDistanceToEarthKm?: number;
  selectedBody?: string | null;
  simulationUtc?: string;
  navigationActive?: boolean;
  autoNavigating?: boolean;
}

export function buildAiGuideUserMessage(
  question: string,
  context: AiGuideContext,
): string {
  const lines = [`User question: ${question}`];
  if (context.selectedBody) lines.push(`Selected body: ${context.selectedBody}`);
  if (context.viewerDistanceToEarthKm != null) {
    lines.push(
      `Viewer distance to Earth: ~${Math.round(context.viewerDistanceToEarthKm).toLocaleString()} km`,
    );
  }
  if (context.simulationUtc) lines.push(`Simulation UTC: ${context.simulationUtc}`);
  if (context.navigationActive) lines.push("User is in manual flight mode.");
  if (context.autoNavigating) lines.push("Autopilot route is active.");
  return lines.join("\n");
}
