import { NextResponse } from "next/server";
import {
  buildAiGuideUserMessage,
  SOLAR_SYSTEM_AI_PROMPT,
  type AiGuideContext,
} from "@/lib/ai/systemPrompt";

interface GuideRequestBody {
  question: string;
  context?: AiGuideContext;
}

/**
 * AI flight assistant — powered by xAI Grok when XAI_API_KEY is set.
 * @see https://docs.x.ai
 */
export async function POST(request: Request) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "AI guide not configured",
        hint: "Add XAI_API_KEY to .env.local (https://console.x.ai)",
      },
      { status: 503 },
    );
  }

  let body: GuideRequestBody;
  try {
    body = (await request.json()) as GuideRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json({ error: "question is required" }, { status: 400 });
  }

  const model = process.env.XAI_MODEL ?? "grok-4-20-non-reasoning";
  const baseUrl = process.env.XAI_BASE_URL ?? "https://api.x.ai/v1";

  const userMessage = buildAiGuideUserMessage(question, body.context ?? {});

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 800,
        messages: [
          { role: "system", content: SOLAR_SYSTEM_AI_PROMPT },
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
    const answer = data.choices?.[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({ answer, model });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
