# Orbit Screensaver — MV3 Extension

Chrome screensaver extension for either the PlanetsOOO scenic tour or a built-in
animation test page.

## What It Does

- Uses `chrome.idle` to detect inactivity.
- Opens the PlanetsOOO scenic tour (`?screensaver=1`) or `screensaver.html`.
- Requests window fullscreen with `chrome.windows.update(windowId, { state: "fullscreen" })`.
- Closes on activity when enabled. The built-in page also closes on right-click / Escape.
- Idle timeout is configurable in Options.

## Local Install

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this `extension/` folder
5. Use **Preview** from the popup

## Files

- `manifest.json` — Manifest V3 config
- `background.js` — idle detection, fullscreen window control
- `screensaver.html/css/js` — animated fullscreen fallback/test page
- `options.html/js/css` — timeout/settings UI
- `popup.html/js/css` — preview/close/status UI

## Notes

Chrome window fullscreen is controlled by the browser/OS. On macOS, toolbar visibility can still be affected by Chrome's fullscreen toolbar settings.

For local PlanetsOOO testing, set the URL to `http://localhost:3000/` and make
sure one Next dev server is running. For production, use
`https://www.planets.ooo/`.
