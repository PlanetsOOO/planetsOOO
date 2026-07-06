# Orbit Screensaver — MV3 Extension

Chrome screensaver extension for the PlanetsOOO scenic tour.

## What It Does

- Uses `chrome.idle` to detect inactivity.
- **Basic:** opens the PlanetsOOO scenic tour (`?screensaver=1&flight=0`) when planets.ooo is reachable; otherwise falls back to packaged `screensaver.html`.
- **Premium:** opens planets.ooo with flight when reachable; otherwise falls back to packaged `screensaver-react.html` offline flight.
- Requests window fullscreen with `chrome.windows.update(windowId, { state: "fullscreen" })`.
- Basic mode prefers the hosted scenic tour on planets.ooo and falls back to packaged offline scenic mode when unreachable.
- Premium mode prefers hosted flight on planets.ooo and falls back to packaged offline React flight when unreachable.
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

- `manifest.json` — Manifest V3 config (dev: includes localhost for `npm run dev`)
- `manifest.store.json` — Chrome Web Store variant (planets.ooo only; no localhost)
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

Basic and Premium both probe planets.ooo first. Offline packaged pages request an online upgrade when connectivity returns.

Regenerate the offline bundle after editing `offline-app/main.tsx` or
`offline-tour/main.js`:

```bash
npm run build:extension-offline
```

Package for Chrome Web Store upload (uses `manifest.store.json`):

```bash
npm run package:extension
```

For a dev zip that retains localhost permissions:

```bash
npm run package:extension:dev
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

## Privacy policy

Store listing and Premium checkout link to:

**https://www.planets.ooo/privacy**

Source: `src/app/privacy/page.tsx` — update `LAST_UPDATED` when practices change.

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
