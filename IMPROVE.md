# Self-Improvement Protocol

One file. No registers, no IDs, no weekly forms. Use this when something feels off—or before you start the next feature.

---

## The loop (≈15 minutes)

```
Notice → Change one thing → Check → Keep or drop
```

| Step | Question | Output |
|------|----------|--------|
| **Notice** | What actually bothered me? (UX, accuracy, perf, AI output) | One sentence |
| **Change** | What is the *smallest* fix or experiment? | One PR-sized change |
| **Check** | How do I know it helped? | A quick test you can repeat |
| **Keep or drop** | Did it work? | One line in the log below |

**Rule:** One improvement at a time. Finish the loop before starting the next.

---

## When to run

- **Trigger:** Bug, awkward UX, wrong AI behavior, or “this feels frozen/wrong”
- **Before coding:** Read “Hard rules” + last 2 log entries (2 min)
- **After coding:** If you changed behavior, add a log line (1 min)

No scheduled reviews unless *you* want them. This protocol is event-driven, not calendar-driven.

---

## Hard rules (this project)

These came from real failures—don’t relitigate without a strong reason.

1. **Simulation owns truth** — Planet/object positions from JPL Horizons, Keplerian elements, ISS TLE. Not Grok.
2. **Imagine owns effects only** — Star streaks, dust, motion blur during transit/lightspeed. Never planets, moons, or fixed silhouettes on screen. **Exception:** Earth landing cinematics use real satellite imagery + DEM tiles (simulation owns final surface position); cached per map cell in `public/data/landings/`.
3. **Tours observe, not just fly** — Multi-stop trips should dwell at each body (`tourTiming.ts`), not snap to the next leg.
4. **Ship small** — Prefer a focused diff over a new framework or doc tree.

---

## Repeatable checks (pick one per loop)

Use the same check every time for that category so you build intuition.

| Category | Quick check |
|----------|-------------|
| **Accuracy** | Compare one fact or distance to [Horizons](https://ssd.jpl.nasa.gov/horizons/app.html) or NASA Fact Sheet |
| **Flight / tour** | Run one tour preset end-to-end; note cruise vs observe time |
| **Imagine** | Idle view: no overlay. Autopilot transit: subtle effects only, no body shapes |
| **Perf** | Fly near Jupiter; no sustained frame stutter in devtools |
| **AI guide** | Ask something with a known answer; verify it doesn’t invent live positions |

---

## Asking AI for help (Cursor / Grok)

Paste this shape—it beats ISO templates:

```
Self-improvement loop for PlanetsOOO:

Notice: [one sentence]
Hard rules: simulation owns truth; Imagine effect-only; tours dwell.

Suggest ONE small change (file + approach). No new process docs.
How should I verify it worked?
```

For debugging:

```
Notice: [symptom]
Already tried: [if anything]
Repro: [steps]

Root cause + smallest fix. Respect IMPROVE.md hard rules.
```

---

## Session log

Keep the last ~10 entries. Delete rows that no longer teach you anything.

| Date | Noticed | Changed | Result (keep/drop) |
|------|---------|---------|-------------------|
| 2026-05-22 | Imagine showed fixed planet silhouettes | Effect-only prompts; overlay only in transit | **Keep** |
| 2026-05-22 | Route planner skipped observation | Tour dwell + scenic cruise | **Keep** |
| 2026-05-22 | Asteroid field inaccurate at scale | Removed field | **Keep** |
| 2026-05-22 | Heavy governance docs unused | Removed; this file instead | **Keep** |
| 2026-05-30 | Screensaver fullscreen could bounce during scenic changes | Guarded extension fullscreen recovery; removed tab-complete retry | Check idle preview through one leg change |
| 2026-05-31 | Screensaver flight key could leave scenic retry fighting WASD | Stop scenic retry after flight entry; mark extension flight mode | Check WASD after entering with configured key |
| 2026-05-31 | Publish screensaver options still exposed test internals | Hide source/URL, add display selection, flight idle scenic return | Check selected-display preview + 15s idle return |
| 2026-05-31 | Label key and scenic return felt wrong in screensaver | Let L pass through; resume scenic in-place from current POV | Check L toggle and 15s idle return |
| 2026-06-01 | Flight idle return could be reset by pointer-lock mouse noise | Ignore tiny mousemove events for screensaver flight idle | Check hands-off return after 15s |
| 2026-06-01 | Flight idle scenic return forced an incomplete orbit | Return through scenic transit from current POV | Check same-window transit after 15s |
| 2026-06-01 | Sun scenic orbit was too close and labels were ambiguous | Farther oversized-body standoff; labels only in screensaver flight | Check Sun focus and L in flight |
| 2026-06-01 | Scenic transition could appear as a new screensaver page | Rehydrate existing screensaver tabs before opening new ones | Check object transition without duplicate page |
| 2026-06-01 | Planet hover caused subtle magnification | Removed hover scale; kept hover highlighting | Check cursor hover on bodies |
| 2026-06-02 | Moon had hover-only label in screensaver | Use shared label toggle for Moon and screensaver L key | Check L shows all body labels |
| 2026-06-03 | Extension options were split out and flight exit closed screensaver | Moved settings into popup; exit/idle returns to scenic guard mode | Check popup settings and exit-key return |
| 2026-06-06 | Mouse/trackpad motion should leave screensaver flight cleanly | Meaningful move/wheel returns to scenic; tiny noise ignored | Check pointer-lock jitter and deliberate movement |
| | | | |

---

## What we deliberately *don’t* do

- Issue registers, CAPA forms, or sprint ceremonies unless a problem repeats 3+ times
- Accuracy “scores” without a specific comparison
- Grok-generated ephemeris or planet art
- Production build heroics when `npm run dev` + `tsc` are enough for the current slice

If something keeps breaking after three loops, *then* consider a dedicated issue in GitHub—not before.
