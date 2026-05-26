import type { NavTargetId } from "@/data/navigationTargets";
import type { TransitMode, TransitPhase } from "@/lib/ai/imagineTransitContext";

/** Effect-only scenarios — never depict planets (the 3D scene owns bodies). */
export type ImagineScenario = "transit" | "lightspeed" | "earthVeil";

/** Atmospheric overlay phases for Earth tile / approach blending. */
export type EarthVeilPhase =
  | "approach-layer"
  | "tile-blend"
  | "surface-haze";

export interface ImagineRequest {
  scenario: ImagineScenario;
  targetId?: NavTargetId;
  originTargetId?: NavTargetId;
  /** Scenic tour vs trip planner — affects prompt tone. */
  transitMode?: TransitMode;
  /** Leg segment within a multi-stop route (0-based). */
  routeLegIndex?: number;
  /** Normalized 0–1 progress along the current transit leg. */
  transitProgress?: number;
  /** depart / cruise / approach — drives cache keys and prompt intensity. */
  transitPhase?: TransitPhase;
  /** Display warp multiple for lightspeed effects. */
  lightspeedMultiple?: number;
  /** Earth approach / tile transition assist (effect-only haze). */
  earthVeilPhase?: EarthVeilPhase;
  earthRegionHint?: string;
  earthTileKey?: string;
  approachLayer?: number;
  tileZoom?: number;
  aspectRatio?: "16:9" | "auto";
}

export interface ImagineApiResponse {
  b64: string;
  scenario: ImagineScenario;
  cacheKey: string;
  model: string;
  prompt: string;
}
