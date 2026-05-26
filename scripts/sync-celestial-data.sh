#!/usr/bin/env bash
# Bright stars (mag ≤ 6) and IAU constellation stick figures from d3-celestial (MIT).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/data"
BASE="https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data"
mkdir -p "$OUT"

files=(
  stars.6.json
  constellations.lines.json
  dsos.bright.json
)

for f in "${files[@]}"; do
  if [[ ! -f "$OUT/$f" ]]; then
    echo "→ $f"
    curl -fsSL "$BASE/$f" -o "$OUT/$f"
  else
    echo "✓ $f"
  fi
done

echo "Done. Celestial data in $OUT"
