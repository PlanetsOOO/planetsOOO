import { getNavTargetName } from "@/data/navigationTargets";
import type { ImagineRequest, ImagineScenario } from "@/lib/ai/imagineTypes";
import {
  getTransitRegionHint,
  lightspeedBand,
  type TransitPhase,
} from "@/lib/ai/imagineTransitContext";
import { layerLabel } from "@/lib/ai/imagineEarthContext";

const EFFECT_ONLY =
  "Abstract atmospheric effect layer only. NO planets, NO moons, NO sun disc, NO spacecraft, NO rings, NO silhouettes, NO celestial body shapes. Only stars, light, dust, and motion phenomena.";

const STYLE =
  "Photorealistic, physically accurate astronomy, subtle cinematic grade, no text, no UI, no logos, no watermark.";

function phaseMotion(phase: TransitPhase | undefined, progress: number): string {
  switch (phase) {
    case "depart":
      return (
        "Early departure: star trails lengthen from center, zodiacal band brightens aft, " +
        "a few distant asteroid streaks whip past at extreme range as luminous dots, " +
        "forward motion parallax with multiple star depth layers."
      );
    case "cruise":
      return (
        "Mid-transit cruise: sustained radial star streaking, layered parallax — " +
        "near stars as short streaks, far stars as long lines, faint micrometeoroid sparks, " +
        "occasional distant comet tail as a thin luminous streak crossing the field obliquely."
      );
    case "approach":
      return (
        "Final approach: streaks begin to slow and fan outward, subtle forward warm/cool " +
        "ambient glow hinting at destination region without any body silhouette, " +
        "increased fine dust motes catching forward light."
      );
    default:
      if (progress > 0.65) return phaseMotion("approach", progress);
      if (progress > 0.25) return phaseMotion("cruise", progress);
      return phaseMotion("depart", progress);
  }
}

function buildTransitPrompt(req: ImagineRequest): string {
  const origin = req.originTargetId
    ? getNavTargetName(req.originTargetId)
    : "deep space";
  const dest = req.targetId ? getNavTargetName(req.targetId) : "a distant world";
  const originRegion = req.originTargetId
    ? getTransitRegionHint(req.originTargetId)
    : "deep space";
  const destRegion = req.targetId
    ? getTransitRegionHint(req.targetId)
    : "deep space";
  const progress = req.transitProgress ?? 0;
  const pct = Math.round(progress * 100);
  const phase = req.transitPhase;
  const motion = phaseMotion(phase, progress);

  const modeLine =
    req.transitMode === "route"
      ? `Multi-stop observation tour, leg ${(req.routeLegIndex ?? 0) + 1}.`
      : "Scenic autopilot cruise between solar system highlights.";

  const lines = [
    `View from a spacecraft leaving the ${origin} region and approaching the ${dest} region.`,
    modeLine,
    `Leaving: ${originRegion}.`,
    `Approaching: ${destRegion}.`,
    motion,
    `Transit ~${pct}% complete — scale streak length and forward radial blur to match.`,
    "Stars and field objects stream backward along the velocity vector (forward motion parallax).",
    "Include subtle passing space objects only as distant streaks or glints — never as recognizable bodies.",
  ];

  return `${lines.join(" ")} ${EFFECT_ONLY} ${STYLE}`;
}

function buildLightspeedPrompt(req: ImagineRequest): string {
  const target = req.targetId ? getNavTargetName(req.targetId) : null;
  const toward = target ? ` on course toward the ${target} region` : "";
  const region = req.targetId ? getTransitRegionHint(req.targetId) : "deep space";
  const multiple = req.lightspeedMultiple ?? 1;
  const band = lightspeedBand(multiple);

  const intensity =
    band === "extreme"
      ? "extreme Lorentz aberration, star field collapsed into bright radial tunnel, blue-shifted forward cone, heavy chromatic fringe"
      : band === "high"
        ? "strong radial star streaks, pronounced forward blue shift, visible relativistic compression"
        : band === "moderate"
          ? "moderate star streaking into radial lines, subtle aberration at frame edge"
          : "gentle star elongation along velocity vector";

  return [
    `Relativistic lightspeed flight${toward} at ~${Math.max(1, Math.round(multiple))}× effective lightspeed.`,
    `Environment: ${region}.`,
    intensity + ".",
    "Distant objects whip past as luminous streaks aligned with the velocity vector.",
    "Layered star parallax — foreground stars as short bright lines, background as long faint trails.",
    EFFECT_ONLY,
    STYLE,
  ].join(" ");
}

function buildEarthVeilPrompt(req: ImagineRequest): string {
  const phase = req.earthVeilPhase ?? "tile-blend";
  const region = req.earthRegionHint ?? "Earth atmosphere — aerial perspective only";
  const layer = req.approachLayer ?? 0;
  const zoom = req.tileZoom ?? 8;

  const phaseLine =
    phase === "approach-layer"
      ? `Smoothing a descent texture band transition (${layerLabel(layer)}, layer ${layer + 1} of 5). Soft horizon bloom as resolution increases.`
      : phase === "surface-haze"
        ? "Low-altitude aerial haze over terrain — thin mist, gentle light scatter, no ground detail."
        : `Satellite map tile crossfade at zoom ~${zoom}. Very subtle aerial perspective to hide tile seams.`;

  return [
    "Translucent atmospheric overlay for blending Earth imagery transitions in a space explorer.",
    phaseLine,
    `Regional mood only: ${region}.`,
    "Soft blue-white horizon haze, thin high-altitude cloud wisps as abstract streaks, gentle forward light bloom.",
    "NO continents, NO coastlines, NO terrain, NO map tiles, NO planet disc, NO city lights, NO labels.",
    EFFECT_ONLY,
    STYLE,
  ].join(" ");
}

export function buildImagineCacheKey(req: ImagineRequest): string {
  const parts: string[] = [req.scenario];
  if (req.targetId) parts.push(req.targetId);
  if (req.originTargetId) parts.push(`from-${req.originTargetId}`);
  if (req.earthVeilPhase) parts.push(req.earthVeilPhase);
  if (req.approachLayer != null) parts.push(`layer-${req.approachLayer}`);
  if (req.tileZoom != null) parts.push(`zoom-${req.tileZoom}`);
  if (req.earthTileKey) parts.push(`tile-${req.earthTileKey}`);
  if (req.transitMode) parts.push(req.transitMode);
  if (req.routeLegIndex != null) parts.push(`leg-${req.routeLegIndex}`);
  if (req.transitPhase) parts.push(req.transitPhase);
  if (req.lightspeedMultiple != null) {
    parts.push(`ls-${lightspeedBand(req.lightspeedMultiple)}`);
  }
  return parts.join(":");
}

export function buildImaginePrompt(req: ImagineRequest): string {
  switch (req.scenario) {
    case "transit":
      return buildTransitPrompt(req);
    case "lightspeed":
      return buildLightspeedPrompt(req);
    case "earthVeil":
      return buildEarthVeilPrompt(req);
    default:
      return `Deep space star field with subtle motion blur and forward parallax. ${EFFECT_ONLY} ${STYLE}`;
  }
}

export function isEffectScenario(scenario: ImagineScenario): boolean {
  return scenario === "transit" || scenario === "lightspeed" || scenario === "earthVeil";
}

export function scenarioForPhase(
  phase: "idle" | "transit" | "orbit",
  lightspeedIntensity: number,
  autoNavigating: boolean,
): ImagineScenario | null {
  if (lightspeedIntensity > 0.35) return "lightspeed";
  if (autoNavigating && phase === "transit") return "transit";
  if (autoNavigating) return "transit";
  return null;
}
