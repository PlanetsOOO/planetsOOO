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
| 2026-06-06 | Mouse/trackpad motion should not interrupt screensaver flight | Move/wheel exits scenic only; flight treats it as activity | Check scenic exit and flight pointer controls |
| 2026-06-07 | Offline fallback looked unlike the scenic tour | Packaged all-planets loop with online upgrade probe | Check offline preview then reconnect |
| 2026-06-08 | Offline fallback had placeholder artifacts and overlap | Sequential shadow-aware POV handoffs | Check offline preview through Sun-to-Neptune loop |
| 2026-06-08 | Extension flight needed quiet telemetry and readable labels | Extension speed overlay; overlap-only label staggering | Check extension flight + L labels |
| 2026-06-08 | Extension needs clear Basic vs Premium behavior | Basic gates flight; Premium link and controls list | Check popup + flight key in Basic |
| 2026-06-09 | Premium needed a payment path before accounts exist | Stripe Checkout + extension entitlement handoff | Check test checkout unlocks Premium |
| 2026-06-14 | Premium needed unique offline value | Packaged offline flight controls behind Premium gate | Check offline preview with Premium flight key |
| 2026-06-14 | Screensaver close could reveal a second stale window | Query and close every matching screensaver tab | Check one input closes all screensaver windows |
| 2026-06-16 | Premium offline ludicrous speed was not physical `100× c` | Reused canonical web `c` / ludicrous constants | Check offline Premium Shift+W+F HUD reaches `100× c` |
| 2026-06-16 | Trackpad look followed camera roll/bank | Counter-rotate look deltas by roll; handle wheel for two-finger trackpad | Bank with arrows, pan trackpad — look stays screen-aligned |
| 2026-06-16 | Reticle showed during scenic transit and Tab browse | Limit crosshair to pointer-lock manual flight only | Transit/scenic: no dot; click-to-fly: dot visible |
| 2026-06-16 | Extension needed native-grade stability and security | Sender validation, CSP, HEAD probe, pause WebGL when hidden | Preview/close only from trusted extension/screensaver paths |
| 2026-06-16 | three.js r183 deprecation spam in extension console | R3F `shadows="percentage"` + Clock compat shim before Canvas | chrome://extensions console stays clean on Preview |
| 2026-06-16 | **Milestone: Premium extension flight** | Pointer-lock flight, L-toggle labels, reticle label travel, transit look (click) + WASD interrupt, exit key/idle only | Reload extension; run 7-item flight checklist |
| 2026-07-06 | Offline React screensaver blank + exit dead | `process` polyfill + `next/link` shim in offline bundle; CSP-safe boot-error.js | `node scripts/verify-extension-react.mjs` after `npm run build:extension-offline` |
| 2026-07-19 | Need Online spine separate from Basic | `/online` login gate, factions, Online HUD, `?online=1` | Sign in → `/online` → pick faction → HUD + session |
| 2026-07-19 | Online needed spacecraft flight feel | Online FOV/thrust/look, cockpit HUD, no scenic autopilot | `/online` → click view → tighter flight |
| 2026-07-20 | Vercel ignore stripped `/extension` + `src/data` | Root-anchor `/extension/` `/data/`; `verify:extension-web` | `npm run verify:extension-web`; curl `/extension` |
| 2026-07-21 | Basic idle input didn’t close; page threw sendMessage without extId | Hosted close uses `extId`; content listeners sync | Store Basic idle: move/click closes window |
| 2026-07-21 | Need verified login + admin multiplayer without Stripe | Email verify + `ADMIN_SUBSCRIPTION_EMAILS` effective sub | Sign up contact@ → verify link → `/online` subscribed |

---

## What we deliberately *don’t* do

- Issue registers, CAPA forms, or sprint ceremonies unless a problem repeats 3+ times
- Accuracy “scores” without a specific comparison
- Grok-generated ephemeris or planet art
- Production build heroics when `npm run dev` + `tsc` are enough for the current slice

If something keeps breaking after three loops, *then* consider a dedicated issue in GitHub—not before.
