#!/usr/bin/env node
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const extensionDir = path.join(root, "extension");
const chrome =
  process.env.CHROME_BIN ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function extensionIdFromPath(dir) {
  const hash = crypto.createHash("sha256").update(path.resolve(dir)).digest();
  return [...hash.subarray(0, 16)]
    .map((b) => String.fromCharCode(97 + (b >> 4)) + String.fromCharCode(97 + (b & 15)))
    .join("");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const extId = extensionIdFromPath(extensionDir);
const userDataDir = mkdtempSync(path.join(tmpdir(), "orbit-ext-cdp-"));
const debugPort = 9333;
const targetUrl = `chrome-extension://${extId}/screensaver-react.html?screensaver=1&offline=1&flight=1`;

const proc = spawn(
  chrome,
  [
    `--user-data-dir=${userDataDir}`,
    `--disable-extensions-except=${extensionDir}`,
    `--load-extension=${extensionDir}`,
    `--remote-debugging-port=${debugPort}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--no-sandbox",
    targetUrl,
  ],
  { stdio: "ignore" },
);

await sleep(12000);

let result = { error: "no target" };

try {
  const listRes = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
  const targets = await listRes.json();
  const page = targets.find((t) => t.url?.includes("screensaver-react"));

  if (!page?.webSocketDebuggerUrl) {
    result = {
      error: "screensaver-react tab missing",
      extId,
      targetUrl,
      targets: targets.map((t) => ({ type: t.type, url: t.url })),
    };
  } else {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    const consoleMessages = [];
    const pageErrors = [];

    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve);
      ws.addEventListener("error", reject);
    });

    let id = 1;
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const msgId = id++;
        const onMessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.method === "Runtime.consoleAPICalled") {
            consoleMessages.push({
              type: data.params.type,
              text: data.params.args
                ?.map((a) => a.value ?? a.description ?? "")
                .join(" "),
            });
          }
          if (data.method === "Runtime.exceptionThrown") {
            pageErrors.push(data.params.exceptionDetails);
          }
          if (data.id === msgId) {
            ws.removeEventListener("message", onMessage);
            if (data.error) reject(new Error(JSON.stringify(data.error)));
            else resolve(data.result);
          }
        };
        ws.addEventListener("message", onMessage);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });

    await send("Runtime.enable");
    const evalResult = await send("Runtime.evaluate", {
      expression: `({
        title: document.title,
        href: location.href,
        canvas: !!document.querySelector('canvas'),
        rootLen: document.getElementById('root')?.innerHTML?.length || 0,
        bodyText: document.body?.innerText?.slice(0, 600) || '',
        scripts: Array.from(document.scripts).map(s => s.src)
      })`,
      returnByValue: true,
    });

    result = {
      extId,
      pageUrl: page.url,
      ...(evalResult.result?.value ?? {}),
      consoleMessages: consoleMessages.slice(0, 30),
      pageErrors: pageErrors.slice(0, 10),
    };
    ws.close();
  }
} catch (err) {
  result = { error: String(err), extId, targetUrl };
}

proc.kill("SIGTERM");
console.log(JSON.stringify(result, null, 2));
