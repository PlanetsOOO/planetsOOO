import { NextResponse } from "next/server";
import type { PlanetId } from "@/data/planets";
import { PLANETS } from "@/data/planets";
import {
  buildGuideLogUserMessage,
  GUIDE_LOG_SYSTEM_PROMPT,
  parseGuideLogLines,
  type GuideLogAiContext,
} from "@/lib/ai/guideLogPrompt";
import { getSnapshotPlanet, loadNasaSnapshot } from "@/lib/nasa/snapshot";

interface LogRequestBody {
  focusId: string;
  focusName: string;
  phase?: GuideLogAiContext["phase"];
}

const VALID_PLANET_IDS = new Set(PLANETS.map((p) => p.id));

export async function POST(request: Request) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "AI guide log not configured",
        hint: "Add XAI_API_KEY to .env.local (https://console.x.ai)",
      },
      { status: 503 },
    );
  }

  let body: LogRequestBody;
  try {
    body = (await request.json()) as LogRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const focusId = body.focusId?.trim();
  const focusName = body.focusName?.trim();
  if (!focusId || !focusName) {
    return NextResponse.json(
      { error: "focusId and focusName are required" },
      { status: 400 },
    );
  }

  let nasa: GuideLogAiContext["nasa"] = null;
  if (VALID_PLANET_IDS.has(focusId as PlanetId)) {
    const snapshot = await loadNasaSnapshot();
    const record = snapshot
      ? getSnapshotPlanet(snapshot, focusId as PlanetId)
      : null;
    if (record) {
      nasa = {
        description: record.description,
        diameterKm: record.diameterKm,
        orbitalPeriod: record.orbitalPeriod,
        siderealDay: record.siderealDay,
        meanTemperature: record.meanTemperature,
        distanceAu: record.distanceAu,
        moons: record.moons,
        massDescription: record.massDescription,
      };
    }
  }

  const model = process.env.XAI_MODEL ?? "grok-4-20-non-reasoning";
  const baseUrl = process.env.XAI_BASE_URL ?? "https://api.x.ai/v1";
  const userMessage = buildGuideLogUserMessage({
    focusId,
    focusName,
    phase: body.phase,
    nasa,
  });

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        max_tokens: 180,
        messages: [
          { role: "system", content: GUIDE_LOG_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: "xAI request failed", status: res.status, detail },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
    const lines = parseGuideLogLines(raw);

    return NextResponse.json({ lines, model });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
