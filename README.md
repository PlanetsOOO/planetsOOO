# Orbit — Solar System Explorer

**Live:** [planets.ooo](https://planets.ooo)

A 3D solar system explorer built with **Next.js**, **Tailwind CSS**, and **Three.js**. Fly through the system with NASA-derived textures, JPL ephemerides, and live planetary facts from official NASA public APIs.

## Features

- WASD + pointer-lock flight with gradual acceleration and coasting
- **Tab** exits flight mode for normal mouse/keyboard access
- Planet info from **NASA/JPL Horizons** (diameter, rotation, orbit, temperature, mass)
- Supplemental copy and moon counts aligned with **NASA Science**
- Scenic discovery tour with autopilot orbit and cinematic chrome
- Route planner and lightspeed transit between bodies
- Earth approach and satellite-based landing cinematics
- Optional AI flight guide and Imagine transit effects (xAI Grok — requires API key)
- Real-sky backdrop: Hipparcos stars (mag ≤ 6), IAU constellation stick figures, bright DSOs, Milky Way band
- **True scale & distance**: 1 scene unit = 1,000 km; JPL Keplerian orbits; sub-pixel bodies at true angular diameter

## Scale model

| Quantity | Value |
|----------|--------|
| Scene unit | 1,000 km (NASA/JPL heliocentric km) |
| Planet radii | NASA mean equatorial radii |
| Orbits | J2000 osculating elements (NASA/JPL Planetary Fact Sheet) |
| Celestial sphere | ~49×10⁶ units (~334 AU) — stars, DSOs, Milky Way |
| Sub-pixel bodies | Faint marker at **true angular diameter** (not enlarged) |

At true scale most planets appear as points until you fly close — that is physically correct. Toggle **Labels** in the menu to identify distant bodies.

## Quick start (local)

```bash
npm install
npm run textures       # planetary surface maps → public/textures/
npm run sync:celestial # stars, constellations, bright DSOs → public/data/
npm run sync:nasa      # NASA Horizons snapshot → public/data/nasa-snapshot.json
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

> **Note:** `localhost:3000` is only for local development. The deployed site is at [planets.ooo](https://planets.ooo).

### Optional: AI features

Copy the example env file and add your xAI key:

```bash
cp .env.example .env
```

Set `XAI_API_KEY` in `.env` for `/api/ai/guide` and `/api/ai/imagine`. The app runs without it; those routes return a helpful error instead.

## Deployment

This app is designed for [Vercel](https://vercel.com):

1. Import the GitHub repository
2. Add `XAI_API_KEY` (and optional `XAI_MODEL`, `XAI_BASE_URL`) under **Environment Variables**
3. Deploy — Next.js is auto-detected
4. Add your custom domain under **Settings → Domains**

Static assets in `public/textures/` and `public/data/` are committed so production builds do not need the sync scripts.

## NASA data sources

| Data | Source | Usage |
|------|--------|--------|
| Physical properties | [NASA/JPL Horizons API](https://ssd.jpl.nasa.gov/api/horizons.api) | Diameter, mass, rotation, orbital period, temperature |
| Outreach facts & moons | [NASA Science](https://science.nasa.gov/solar-system/) | Descriptions, moon counts, mission lists |
| Semi-major axis (AU) | NASA Planetary Fact Sheet / Horizons | Mean distance from the Sun |
| Surface textures | NASA mission mosaics (visualization) | 2K maps in `public/textures/` |

**API routes**

- `GET /api/planets/[id]` — live Horizons data (cached 24h), falls back to `public/data/nasa-snapshot.json`
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

Orbital mechanics and numeric facts come from NASA/JPL Horizons and NASA Science. Textures and some cinematic transitions are visualization-grade, not for scientific analysis.

## License

MIT. NASA imagery and data remain subject to [NASA media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/).
