import { createHash } from "node:crypto";
import { listUsers } from "@/lib/entitlements/store";
import type { UserRecord } from "@/lib/entitlements/types";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Find a user by raw verification token (hashed lookup). */
export async function findUserByVerifyToken(
  token: string,
): Promise<UserRecord | null> {
  const tokenHash = hashToken(token.trim());
  if (!tokenHash) return null;
  const users = await listUsers();
  return (
    users.find(
      (user) =>
        user.emailVerifyTokenHash === tokenHash &&
        typeof user.emailVerifyExpiresAt === "number" &&
        user.emailVerifyExpiresAt >= Date.now(),
    ) ?? null
  );
}
