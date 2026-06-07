# Orbit Screensaver — MV3 Extension

Chrome screensaver extension for the PlanetsOOO scenic tour.

## What It Does

- Uses `chrome.idle` to detect inactivity.
- Opens the PlanetsOOO scenic tour (`?screensaver=1`) on selected displays.
- Falls back to a packaged offline scenic mode when PlanetsOOO is unreachable,
  then upgrades that tab back to the online tour when internet returns.
- Requests window fullscreen with `chrome.windows.update(windowId, { state: "fullscreen" })`.
- In PlanetsOOO mode, any input closes before flight except the configured
  flight key. After flight starts, the configured exit key closes the tab.
- Flight mode input is treated as intentional control input, not activity that
  closes the screensaver.
- After 15 seconds of idle flight mode, PlanetsOOO returns to scenic tour mode.
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
- `screensaver.html/js/css` — packaged offline scenic fallback
- `popup.html/js/css` — compact settings, preview, and close UI

## Notes

Chrome window fullscreen is controlled by the browser/OS. On macOS, toolbar visibility can still be affected by Chrome's fullscreen toolbar settings.
Chrome can only target displays that the OS exposes as separate displays. If
monitors are mirrored in macOS, change them to extended display in System
Settings before selecting multiple monitors in Orbit.
Chrome's fullscreen notice, including the Esc hint, is browser-owned UI and
cannot be hidden by an extension. The extension avoids unnecessary repeat
fullscreen requests so that notice is shown as little as Chrome allows.

The publish build tries `https://www.planets.ooo/` first. If the site cannot
be reached quickly, the extension opens its packaged offline scenic fallback
and periodically retries the online tour so it can upgrade when connected.
