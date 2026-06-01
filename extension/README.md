# Orbit Screensaver — MV3 Extension

Chrome screensaver extension for either the PlanetsOOO scenic tour or a built-in
animation test page.

## What It Does

- Uses `chrome.idle` to detect inactivity.
- Opens the PlanetsOOO scenic tour (`?screensaver=1`) or `screensaver.html`.
- Requests window fullscreen with `chrome.windows.update(windowId, { state: "fullscreen" })`.
- In PlanetsOOO mode, any input closes before flight except the configured
  flight key. After flight starts, the configured exit key closes the tab.
- Flight mode input is treated as intentional control input, not activity that
  closes the screensaver.
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
Chrome's fullscreen notice, including the Esc hint, is browser-owned UI and
cannot be hidden by an extension. The extension avoids unnecessary repeat
fullscreen requests so that notice is shown as little as Chrome allows.

For local PlanetsOOO testing, set the URL to `http://localhost:3000/` and make
sure one Next dev server is running. For production, use
`https://www.planets.ooo/`.
