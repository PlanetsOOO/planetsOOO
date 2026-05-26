#!/usr/bin/env bash
# Downloads 2K planetary maps for local use (Solar System Scope — visualization-grade).
# NASA mission imagery is cited per-planet in src/data/planets.ts.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/textures"
BASE="https://www.solarsystemscope.com/textures/download"
mkdir -p "$OUT"

files=(
  2k_sun.jpg
  4k_sun.jpg
  8k_sun.jpg
  2k_mercury.jpg
  4k_mercury.jpg
  8k_mercury.jpg
  2k_venus_surface.jpg
  4k_venus_surface.jpg
  8k_venus_surface.jpg
  2k_earth_daymap.jpg
  4k_earth_daymap.jpg
  8k_earth_daymap.jpg
  2k_earth_nightmap.jpg
  2k_earth_clouds.jpg
  2k_moon.jpg
  2k_mars.jpg
  4k_mars.jpg
  8k_mars.jpg
  2k_jupiter.jpg
  4k_jupiter.jpg
  8k_jupiter.jpg
  2k_saturn.jpg
  4k_saturn.jpg
  8k_saturn.jpg
  2k_saturn_ring_alpha.png
  2k_uranus.jpg
  4k_uranus.jpg
  8k_uranus.jpg
  2k_neptune.jpg
  4k_neptune.jpg
  8k_neptune.jpg
  2k_stars.jpg
)

for f in "${files[@]}"; do
  if [[ ! -f "$OUT/$f" ]]; then
    echo "→ $f"
    curl -fsSL "$BASE/$f" -o "$OUT/$f"
  else
    echo "✓ $f"
  fi
done

echo "Done. Textures in $OUT"
