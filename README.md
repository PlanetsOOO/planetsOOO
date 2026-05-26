# Orbit — Solar System Explorer

A hobbyist 3D solar system explorer built with **Next.js**, **Tailwind CSS**, and **Three.js**. Fly through a stylized solar system with NASA-derived textures and **live planetary facts** from official NASA public APIs.

## Features

- WASD + pointer-lock flight with gradual acceleration and coasting
- **Tab** exits flight mode for normal mouse/keyboard access
- Planet info from **NASA/JPL Horizons** (diameter, rotation, orbit, temperature, mass)
- Supplemental copy and moon counts aligned with **NASA Science** (science.nasa.gov)
- Click a planet for a dismissible fact panel with source links
- Orbit paths and labels toggled from a faint top-right menu (off by default)
- Real-sky backdrop: Hipparcos stars (mag ≤ 6), IAU constellation stick figures, bright DSOs (Messier, LMC/SMC, etc.), Milky Way band — all at true angular scale on a distant celestial sphere (~334 AU)
- **True scale & distance**: 1 scene unit = 1,000 km; JPL Keplerian orbits (eccentricity + inclination); no artificial planet enlargement

## Scale model

| Quantity | Value |
|----------|--------|
| Scene unit | 1,000 km (NASA/JPL heliocentric km) |
| Planet radii | NASA mean equatorial radii |
| Orbits | J2000 osculating elements (NASA/JPL Planetary Fact Sheet) |
| Celestial sphere | ~49×10⁶ units (~334 AU) — stars, DSOs, Milky Way |
| Sub-pixel bodies | Faint marker at **true angular diameter** (not enlarged) |

At true scale most planets appear as points until you fly close — that is physically correct. Toggle **Labels** in the menu to identify distant bodies.

## Quick start

```bash
npm install
npm run textures      # planetary surface maps → public/textures/
npm run sync:celestial # stars, constellations, bright DSOs → public/data/
npm run sync:nasa     # NASA Horizons snapshot → public/data/nasa-snapshot.json
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## NASA data sources

| Data | Source | Usage |
|------|--------|--------|
| Physical properties | [NASA/JPL Horizons API](https://ssd.jpl.nasa.gov/api/horizons.api) | Diameter, mass, rotation, orbital period, temperature |
| Outreach facts & moons | [NASA Science](https://science.nasa.gov/solar-system/) | Descriptions, moon counts, mission lists |
| Semi-major axis (AU) | NASA Planetary Fact Sheet / Horizons | Mean distance from the Sun |
| Surface textures | NASA mission mosaics (visualization) | 2K maps in `public/textures/` |

**API routes**

- `GET /api/planets/[id]` — fetches live Horizons data (cached 24h), falls back to `public/data/nasa-snapshot.json`
- `GET /api/planets` — all bodies

Refresh the local snapshot periodically:

```bash
npm run sync:nasa
```

## Controls

- **Click** the view to enter flight mode · **Tab** to exit
- **W A S D** · **Space / Shift** — thrust
- **Click a planet** — NASA fact panel · **Esc** — close / exit flight

## Tech stack

- Next.js 16 (App Router)
- Tailwind CSS v4
- Three.js · React Three Fiber · Drei

## Accuracy note

3D positions and sizes are **stylized** for exploration, not to scale. Numeric facts in the info panel come from NASA/JPL Horizons and NASA Science pages. Textures are visualization-grade, not for scientific analysis.

## Phase 1 (baseline)

Git tag **`phase-1`** marks the first stable save point: solar system explorer, scenic tour / discovery autopilot, Grok Imagine transit effects, Moon, route planner, free flight — **without** landing/collision or moon-showcase jitter fixes.

**Roll back to Phase 1:**

```bash
git fetch origin   # if using a remote
git checkout phase-1
# or reset current branch: git reset --hard phase-1
```

**Compare against Phase 1:** `git diff phase-1`

## License

MIT. NASA imagery and data remain subject to [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).
