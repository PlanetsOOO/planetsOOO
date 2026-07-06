import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string, salt?: string): {
  hash: string;
  salt: string;
} {
  const passwordSalt = salt ?? randomBytes(16).toString("hex");
  const derived = scryptSync(password, passwordSalt, KEY_LENGTH);
  return {
    hash: derived.toString("hex"),
    salt: passwordSalt,
  };
}

export function verifyPassword(
  password: string,
  hash: string,
  salt: string,
): boolean {
  const derived = scryptSync(password, salt, KEY_LENGTH);
  const hashBuffer = Buffer.from(hash, "hex");
  if (derived.length !== hashBuffer.length) return false;
  return timingSafeEqual(derived, hashBuffer);
}
