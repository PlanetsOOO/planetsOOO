import type { NavTargetId } from "@/data/navigationTargets";

const HIT_PADDING_PX = 12;

type Entry = {
  navTargetId: NavTargetId;
  element: HTMLDivElement;
};

const entries = new Map<NavTargetId, Entry>();

export function syncBodyLabelPick(
  id: NavTargetId,
  element: HTMLDivElement | null,
  visible: boolean,
): void {
  if (!element || !visible) {
    entries.delete(id);
    return;
  }
  entries.set(id, { navTargetId: id, element });
}

export function removeBodyLabelPick(id: NavTargetId): void {
  entries.delete(id);
}

/** Screen-space pick for pointer-lock flight (reticle at viewport center). */
export function pickBodyLabelAt(x: number, y: number): NavTargetId | null {
  let best: { id: NavTargetId; area: number } | null = null;

  for (const entry of entries.values()) {
    if (!entry.element.isConnected) continue;
    const rect = entry.element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;

    const pad = HIT_PADDING_PX;
    if (
      x < rect.left - pad ||
      x > rect.right + pad ||
      y < rect.top - pad ||
      y > rect.bottom + pad
    ) {
      continue;
    }

    const area = rect.width * rect.height;
    if (!best || area < best.area) {
      best = { id: entry.navTargetId, area };
    }
  }

  return best?.id ?? null;
}
