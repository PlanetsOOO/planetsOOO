# Orbit Screensaver — MV3 Extension

Chrome screensaver extension for the PlanetsOOO scenic tour.

## What It Does

- Uses `chrome.idle` to detect inactivity.
- Opens the PlanetsOOO scenic tour (`?screensaver=1`) on the selected display.
- Falls back to a packaged offline scenic mode when PlanetsOOO is unreachable,
  without replacing an active fullscreen tab mid-session.
- Requests window fullscreen with `chrome.windows.update(windowId, { state: "fullscreen" })`.
- Basic mode includes scenic/offline screensaver access but disables flight mode.
- Premium mode enables flight key, exit flight, and flight controls.
- In PlanetsOOO mode, any input closes before flight except the configured
  flight key. After flight starts, the configured exit key closes the tab.
- Flight mode input is treated as intentional control input, not activity that
  closes the screensaver.
- During extension-launched flight mode, a faint top-right speed tracker is
  rendered by the extension content script.
- After 15 seconds of idle flight mode, PlanetsOOO returns to scenic tour mode.
- Idle timeout is configurable in the popup.

## Local Install

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this `extension/` folder
5. Use **Preview** from the popup

## Files

- `manifest.json` — Manifest V3 config
- `background.js` — idle detection, fullscreen window control
- `screensaver.html/js/css` — packaged offline Three.js all-planets scenic fallback
- `offline-tour/main.js` — source for the bundled offline mini-scene
- `textures/` — low-resolution local planet textures used offline
- `popup.html/js/css` — compact settings, preview, and close UI

## Notes

Chrome window fullscreen is controlled by the browser/OS. On macOS, toolbar visibility can still be affected by Chrome's fullscreen toolbar settings.
Chrome can only target displays that the OS exposes as separate displays. If
monitors are mirrored in macOS, change them to extended display in System
Settings before selecting multiple monitors in Orbit.
Orbit uses one selected display by default. Enable **Use all selected displays**
only when you intentionally want one screensaver window per display.
Chrome's fullscreen notice, including the Esc hint, is browser-owned UI and
cannot be hidden by an extension. The extension avoids unnecessary repeat
fullscreen requests so that notice is shown as little as Chrome allows.

The publish build tries `https://www.planets.ooo/` first. If the site cannot
be reached quickly, the extension opens its packaged offline scenic fallback.
It does not replace an active offline screensaver tab when connectivity returns.
The offline fallback is a silent bundled Three.js mini-scene with local
low-resolution planet textures. It starts on a random tour body, shows one
focused body at a time, then uses a slow 30-second handoff where the current
body exits screen right before the next body enters from screen left. It does
not include the full Next.js app, NASA APIs, AI routes,
Earth terrain tiles, or high-resolution texture tiers.

Regenerate the offline bundle after editing `offline-tour/main.js`:

```bash
npm run build:extension-offline
```

## Admin Premium Override

For local testing before payments are wired, set this in the extension service
worker console. This is a local testing hook, not the payment unlock path:

```js
chrome.storage.local.set({ adminPremiumOverride: true })
```

Clear it to test Basic:

```js
chrome.storage.local.set({ adminPremiumOverride: false })
chrome.storage.sync.set({ plan: "basic" })
```

After changing the override, reopen the popup and run Preview again.

## Premium Payment Setup

Premium checkout uses Stripe Checkout for a one-time `$2.99` payment. The web
app needs these Vercel env vars:

```bash
STRIPE_SECRET_KEY=sk_live_...
PREMIUM_ENTITLEMENT_SECRET=<random long secret>
```

The extension popup opens `/premium` with the current extension id and a local
install id. After checkout, `/premium/success` verifies the Stripe session on
the server and sends the entitlement back to the extension.
