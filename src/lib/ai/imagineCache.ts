import type { ImagineRequest } from "@/lib/ai/imagineTypes";
import { buildImagineCacheKey } from "@/lib/ai/imaginePrompts";

const memory = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

export function getCachedImagine(cacheKey: string): string | undefined {
  return memory.get(cacheKey);
}

export function setCachedImagine(cacheKey: string, dataUrl: string): void {
  memory.set(cacheKey, dataUrl);
}

export function getInflightImagine(
  cacheKey: string,
): Promise<string | null> | undefined {
  return inflight.get(cacheKey);
}

export function setInflightImagine(
  cacheKey: string,
  promise: Promise<string | null>,
): void {
  inflight.set(cacheKey, promise);
  promise.finally(() => {
    if (inflight.get(cacheKey) === promise) inflight.delete(cacheKey);
  });
}

export async function fetchImagineImage(
  req: ImagineRequest,
): Promise<string | null> {
  const cacheKey = buildImagineCacheKey(req);
  const cached = getCachedImagine(cacheKey);
  if (cached) return cached;

  const pending = getInflightImagine(cacheKey);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const res = await fetch("/api/ai/imagine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) return null;

      const data = (await res.json()) as { b64?: string };
      if (!data.b64) return null;

      const dataUrl = `data:image/jpeg;base64,${data.b64}`;
      setCachedImagine(cacheKey, dataUrl);
      return dataUrl;
    } catch {
      return null;
    }
  })();

  setInflightImagine(cacheKey, promise);
  return promise;
}
