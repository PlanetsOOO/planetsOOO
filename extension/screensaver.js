function closeScreensaver() {
  void chrome.runtime.sendMessage({ type: "close" });
}

window.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  closeScreensaver();
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeScreensaver();
  }
});
