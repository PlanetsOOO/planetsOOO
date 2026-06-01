const stateEl = document.getElementById("state");
const previewBtn = document.getElementById("preview");
const closeBtn = document.getElementById("close");
const optionsBtn = document.getElementById("options");

function formatIdleLabel(minutes) {
  const value = Number(minutes);
  if (value < 1) return `${Math.round(value * 60)} sec`;
  if (Number.isInteger(value)) return `${value} min`;
  return `${value.toFixed(2).replace(/0$/, "")} min`;
}

function formatStatus(status) {
  if (!status?.ok) return "Extension background unavailable — reload extension.";

  const lines = [
    status.enabled ? "Enabled" : "Disabled",
    `Idle: ${formatIdleLabel(status.idleMinutes)}`,
    `Displays: ${status.displayIds?.length || 1}`,
    status.running ? "Screensaver running" : "Waiting for idle…",
  ];

  if (status.siteUrl) {
    if (status.flightKey) lines.push(`Flight: ${status.flightKey}`);
    if (status.exitKey) lines.push(`Exit: ${status.exitKey}`);
    if (status.flightMode) lines.push("Flight mode active");
  }

  const last = status.lastRun;
  if (last?.ok) {
    lines.push(`Last: ${last.state ?? "fullscreen"}`);
    if (last.displays?.length) lines.push(last.displays.join(", "));
    if (last.warning) lines.push(last.warning);
  } else if (last?.error) {
    lines.push(`Last error: ${last.error}`);
  }

  return lines.join("\n");
}

async function refresh() {
  try {
    const status = await chrome.runtime.sendMessage({ type: "status" });
    stateEl.textContent = formatStatus(status);
  } catch (err) {
    stateEl.textContent =
      err instanceof Error ? err.message : "Extension background unavailable.";
  }
}

previewBtn.addEventListener("click", async () => {
  stateEl.textContent = "Opening preview…";
  try {
    const result = await chrome.runtime.sendMessage({ type: "preview" });
    if (result?.ok) {
      stateEl.textContent = [
        `Opened in ${result.state ?? "fullscreen"} mode.`,
        result.url ?? "",
      ]
        .filter(Boolean)
        .join("\n");
      return;
    }
    stateEl.textContent = result?.error ?? "Preview failed.";
  } catch (err) {
    stateEl.textContent = err instanceof Error ? err.message : "Preview failed.";
  }
  await refresh();
});

closeBtn.addEventListener("click", async () => {
  try {
    await chrome.runtime.sendMessage({ type: "close" });
  } catch {
    // ignore
  }
  await refresh();
});

optionsBtn.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
});

void refresh();
