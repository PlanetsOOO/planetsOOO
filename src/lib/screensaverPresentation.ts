/** CSS full-page layout inside the extension window (not OS fullscreen). */
export function activateScreensaverPresentation(): () => void {
  document.documentElement.classList.add("screensaver-mode");
  document.body.classList.add("screensaver-mode");

  return () => {
    document.documentElement.classList.remove("screensaver-mode");
    document.body.classList.remove("screensaver-mode");
  };
}
