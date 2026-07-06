window.addEventListener("error", function (event) {
  var root = document.getElementById("root");
  if (!root || root.childElementCount > 0) return;
  var message = event.message || "Script error";
  root.innerHTML =
    '<main style="display:flex;min-height:100vh;align-items:center;justify-content:center;background:#030508;color:#d4d4d8;padding:2rem;font-family:ui-monospace,Menlo,monospace;"><div style="max-width:28rem;text-align:center;"><p style="font-size:0.875rem;margin:0 0 0.75rem;">Orbit offline explorer failed to start</p><p style="font-size:0.75rem;color:#71717a;word-break:break-word;margin:0;">' +
    message +
    "</p></div></main>";
  root.removeAttribute("aria-busy");
});

window.addEventListener("unhandledrejection", function (event) {
  var reason = event.reason;
  var message =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : "Unhandled promise rejection";
  window.dispatchEvent(new ErrorEvent("error", { message: message }));
});
