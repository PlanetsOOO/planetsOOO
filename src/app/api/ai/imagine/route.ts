import { NextResponse } from "next/server";
import {
  buildImagineCacheKey,
  buildImaginePrompt,
} from "@/lib/ai/imaginePrompts";
import type { ImagineRequest } from "@/lib/ai/imagineTypes";

/**
 * Grok Imagine backdrop generation for cinematic transitions.
 * Requires XAI_API_KEY — https://docs.x.ai/developers/model-capabilities/images/generation
 */
export async function POST(request: Request) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Imagine not configured",
        hint: "Add XAI_API_KEY to .env (https://console.x.ai)",
      },
      { status: 503 },
    );
  }

  let body: ImagineRequest;
  try {
    body = (await request.json()) as ImagineRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.scenario) {
    return NextResponse.json({ error: "scenario is required" }, { status: 400 });
  }

  const model =
    process.env.XAI_IMAGINE_MODEL ?? "grok-imagine-image-quality";
  const baseUrl = process.env.XAI_BASE_URL ?? "https://api.x.ai/v1";
  const prompt = buildImaginePrompt(body);
  const cacheKey = buildImagineCacheKey(body);

  try {
    const res = await fetch(`${baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        aspect_ratio: body.aspectRatio ?? "16:9",
        resolution: "1k",
        response_format: "b64_json",
      }),
      signal: AbortSignal.timeout(40_000),
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: "xAI Imagine request failed", status: res.status, detail },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      data?: { b64_json?: string }[];
    };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json(
        { error: "No image returned from xAI" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      b64,
      scenario: body.scenario,
      cacheKey,
      model,
      prompt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
