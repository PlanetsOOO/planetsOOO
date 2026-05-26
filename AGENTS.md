<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# PlanetsOOO — agent instructions

Read `IMPROVE.md` before non-trivial work. Self-improvement = one small change + a repeatable check, not new process docs.

## Project rules

1. **Simulation owns truth** — JPL Horizons, Keplerian elements, ISS TLE (not Grok)
2. **Imagine effect-only** — transit/lightspeed overlays; never celestial body shapes
3. **Minimal diffs** — match patterns in `src/components/explorer/`; tour timing in `src/lib/tourTiming.ts`
4. **No secrets in git** — `.env` stays local
