/**
 * لقطات شاشة عبر Chrome DevTools Protocol — بلا Playwright.
 * الاستخدام: node scripts/shot.mjs <url> <out.png> [token] [seedJson]
 * إن مُرِّر token يُحفظ في sessionStorage قبل الالتقاط (للوحات الإدارة).
 * وإن مُرِّر seedJson (JSON من شكل {"key":"value"}) يُكتب في localStorage
 * (مثلاً لتعبئة السلة قبل لقطة صفحة إتمام الطلب).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const CHROME = "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe";
const [, , url, out, token, seed] = process.argv;

if (!url || !out) {
  console.error("الاستخدام: node scripts/shot.mjs <url> <out.png> [token]");
  process.exit(1);
}

const PORT = 9333;
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "stoor-shot-"));

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  "--window-size=1440,1100",
  "--hide-scrollbars",
  "--force-device-scale-factor=1",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-gpu",
  "about:blank",
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* لم يجهز بعد */
    }
    await sleep(200);
  }
  throw new Error("تعذّر الاتصال بـ Chrome");
}

let id = 0;
function rpc(ws, method, params = {}) {
  const msgId = ++id;
  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id !== msgId) return;
      ws.removeEventListener("message", onMessage);
      if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
      else resolve(msg.result);
    };
    ws.addEventListener("message", onMessage);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}

try {
  const wsUrl = await getWsUrl();
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => {
    ws.addEventListener("open", r, { once: true });
    ws.addEventListener("error", j, { once: true });
  });

  await rpc(ws, "Page.enable");
  await rpc(ws, "Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // نزور الأصل أولاً حتى نستطيع الكتابة في sessionStorage
  await rpc(ws, "Page.navigate", { url });
  await sleep(2500);

  if (token) {
    const origin = new URL(url).origin;
    await rpc(ws, "Runtime.evaluate", {
      expression: `sessionStorage.setItem("stoor.admin.token", ${JSON.stringify(token)});`,
    });
    await rpc(ws, "Page.navigate", { url: `${origin}/admin/products` });
    await sleep(2500);
    await rpc(ws, "Page.navigate", { url });
    await sleep(2500);
  }

  // تعبئة localStorage (مثلاً السلة) ثم إعادة التحميل
  if (seed) {
    const pairs = Object.entries(JSON.parse(seed))
      .map(
        ([k, v]) =>
          `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`
      )
      .join(" ");
    await rpc(ws, "Runtime.evaluate", { expression: pairs });
    await rpc(ws, "Page.navigate", { url });
    await sleep(3000);
  }

  const { data } = await rpc(ws, "Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(out, Buffer.from(data, "base64"));
  console.log("✓", out);
  ws.close();
} catch (err) {
  console.error("✗", err.message);
  process.exitCode = 1;
} finally {
  chrome.kill();
}
