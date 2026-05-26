const lastTickMs = new Map<string, number>();

/** Returns true when at least `intervalMs` have elapsed since the last tick for `key`. */
export function shouldRunThrottled(
  key: string,
  intervalMs: number,
  now = Date.now(),
): boolean {
  const last = lastTickMs.get(key) ?? 0;
  if (now - last < intervalMs) return false;
  lastTickMs.set(key, now);
  return true;
}

export function resetThrottledTick(key: string): void {
  lastTickMs.delete(key);
}
