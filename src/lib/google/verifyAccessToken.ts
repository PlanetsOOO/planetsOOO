export interface GoogleAccessTokenInfo {
  userId: string;
  audience: string;
  expiresIn: number;
}

interface GoogleTokenInfoResponse {
  aud?: string;
  sub?: string;
  user_id?: string;
  expires_in?: string | number;
  error?: string;
  error_description?: string;
}

/** Validate a Chrome extension OAuth access token via Google tokeninfo. */
export async function verifyGoogleAccessToken(
  accessToken: string,
  expectedClientId?: string,
): Promise<GoogleAccessTokenInfo | null> {
  const token = accessToken.trim();
  if (!token) return null;

  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`,
    { cache: "no-store" },
  );
  if (!res.ok) return null;

  const data = (await res.json()) as GoogleTokenInfoResponse;
  if (data.error) return null;

  const userId = (data.sub ?? data.user_id)?.trim();
  if (!userId) return null;

  const audience = data.aud?.trim() ?? "";
  if (expectedClientId && audience !== expectedClientId) return null;

  const expiresIn = Number(data.expires_in);
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) return null;

  return { userId, audience, expiresIn };
}
