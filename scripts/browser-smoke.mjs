import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";

const edgeCandidates = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];
const browserPath = edgeCandidates.find(existsSync);

if (!browserPath) {
  throw new Error("未找到 Edge 或 Chrome，无法运行浏览器冒烟测试。");
}

const pageUrl =
  "file:///C:/%E6%96%87%E6%A1%A3/ChatGPT/%E4%B9%A0%E6%83%AF%E6%89%93%E5%8D%A1/index.html";
const profile = join(
  tmpdir(),
  `habit-checkin-smoke-${Date.now()}-${Math.random().toString(16).slice(2)}`,
);
const port = await getAvailablePort();
const browser = spawn(
  browserPath,
  [
    "--headless=new",
    "--no-sandbox",
    "--no-first-run",
    "--disable-extensions",
    "--disable-gpu",
    "--disable-gpu-compositing",
    "--disable-software-rasterizer",
    "--allow-file-access-from-files",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    pageUrl,
  ],
  { stdio: "ignore", windowsHide: true },
);

let socket;
let commandId = 0;
const pending = new Map();

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForTarget() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(
        (response) => response.json(),
      );
      const target = targets.find(
        (item) => item.type === "page" && item.url.startsWith("file:"),
      );
      if (target) return target;
    } catch {
      // The browser debug endpoint may need a moment to start.
    }
    await delay(100);
  }
  throw new Error("浏览器调试端口未能启动。");
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const response = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (response.result.exceptionDetails) {
    throw new Error(response.result.exceptionDetails.text);
  }
  return response.result.result.value;
}

async function waitFor(expression, message) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await delay(50);
  }
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  const target = await waitForTarget();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const response = JSON.parse(event.data);
    if (!response.id || !pending.has(response.id)) return;
    const handler = pending.get(response.id);
    pending.delete(response.id);
    if (response.error) handler.reject(new Error(response.error.message));
    else handler.resolve(response);
  });

  await send("Runtime.enable");
  await waitFor(
    "document.body.innerText.includes('今日习惯')",
    "页面主体未完成渲染。",
  );

  const heading = await evaluate("document.title");
  assert(heading.includes("微光习惯"), "页面标题不正确。");

  await evaluate(
    "document.querySelector('[data-action=\"quick-add\"]').click()",
  );
  await waitFor(
    "document.querySelectorAll('.habit-row').length === 1",
    "快捷添加习惯失败。",
  );

  await evaluate(
    "document.querySelector('[data-action=\"toggle-today\"]').click()",
  );
  await waitFor(
    "document.querySelector('.progress-ring').getAttribute('aria-label') === '今日完成 1 项，共 1 项'",
    "打卡后今日完成数未更新。",
  );

  await evaluate(
    "document.querySelector('[data-action=\"add-habit\"]').click()",
  );
  await waitFor(
    "document.querySelector('#habit-form') !== null",
    "添加习惯弹窗未打开。",
  );
  await evaluate(`
    (() => {
      const input = document.querySelector('#habit-name');
      input.value = '拉伸';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#habit-form').requestSubmit();
    })()
  `);
  await waitFor(
    "document.querySelectorAll('.habit-row').length === 2 && !document.querySelector('#habit-form')",
    "添加第二个习惯失败。",
  );

  await evaluate(
    "document.querySelector('.habit-row [data-action=\"delete-habit\"]').click()",
  );
  await waitFor(
    "document.querySelector('[data-action=\"confirm-delete\"]') !== null",
    "删除确认弹窗未打开。",
  );
  await evaluate(
    "document.querySelector('[data-action=\"confirm-delete\"]').click()",
  );
  await waitFor(
    "document.querySelectorAll('.habit-row').length === 1 && document.querySelector('.undo-toast')",
    "删除或撤销提示失败。",
  );
  await evaluate(
    "document.querySelector('[data-action=\"undo-delete\"]').click()",
  );
  await waitFor(
    "document.querySelectorAll('.habit-row').length === 2",
    "删除撤销失败。",
  );

  await send("Page.enable");
  await send("Page.reload", { ignoreCache: true });
  await waitFor(
    "document.body.innerText.includes('今日习惯') && document.querySelectorAll('.habit-row').length === 2",
    "刷新后本地数据未恢复。",
  );

  await evaluate(`
    (() => {
      const date = new Date();
      date.setDate(date.getDate() - 6);
      const key = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
      ].join('-');
      localStorage.setItem('habit-checkin:v1', JSON.stringify({
        version: 1,
        habits: [{
          id: 'history-water',
          name: '喝水',
          emoji: '💧',
          color: 'mint',
          createdDate: key
        }],
        checkIns: []
      }));
    })()
  `);
  await send("Page.reload", { ignoreCache: true });
  await waitFor(
    "document.querySelectorAll('.habit-row').length === 1",
    "历史测试数据未能加载。",
  );
  await evaluate(`
    (() => {
      const date = new Date();
      date.setDate(date.getDate() - 1);
      const key = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
      ].join('-');
      document.querySelector('[data-date="' + key + '"]').click();
    })()
  `);
  await waitFor(
    "document.querySelector('.day-detail .detail-check') !== null",
    "历史日期无法打开。",
  );
  await evaluate(
    "document.querySelector('.day-detail .detail-check').click()",
  );
  await waitFor(
    "document.querySelector('.day-detail .detail-check').classList.contains('is-complete')",
    "历史补记失败。",
  );

  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await delay(100);
  const mobileLayout = await evaluate(
    "({ viewport: innerWidth, content: document.documentElement.scrollWidth })",
  );
  assert(
    mobileLayout.content <= mobileLayout.viewport,
    `移动端出现横向溢出：${mobileLayout.content}px / ${mobileLayout.viewport}px`,
  );

  console.log("浏览器冒烟测试通过：渲染、添加、打卡、删除撤销和持久化正常。");
} finally {
  if (socket && socket.readyState === WebSocket.OPEN) socket.close();
  browser.kill();
}
