import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { SpaSnapshotScheme } from "../../src/lib/spa-snapshot.ts";

const BINARY_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

const PORT_FILE_TIMEOUT_MS = 20_000;
const COMMAND_TIMEOUT_MS = 120_000;
const NAVIGATION_TIMEOUT_MS = 60_000;
const SELECTOR_POLL_MS = 100;
const HOVER_SETTLE_MS = 120;

interface CdpMessage {
  id?: number;
  method?: string;
  sessionId?: string;
  params?: unknown;
  result?: unknown;
  error?: { message: string };
}

interface EvaluateResult {
  result: { value: unknown };
  exceptionDetails?: {
    text: string;
    exception?: { description?: string };
  };
}

export interface CapturePage {
  goto: (url: string) => Promise<void>;
  waitForSelector: (selector: string, timeoutMs: number) => Promise<void>;
  evaluate: <T>(expression: string) => Promise<T>;
  /** A real browser click, so it hit-tests into shadow DOM the way a user does. */
  click: (x: number, y: number) => Promise<void>;
  elementOrigin: (selector: string) => Promise<{ x: number; y: number } | null>;
  close: () => Promise<unknown>;
}

export interface CaptureBrowser {
  openPage: (options: {
    width: number;
    height: number;
    scheme: SpaSnapshotScheme;
    initScript?: string;
  }) => Promise<CapturePage>;
  close: () => Promise<void>;
}

export const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function findBinary() {
  const binary = [process.env["CHROME_PATH"], ...BINARY_CANDIDATES].find(
    (path) => path && existsSync(path)
  );
  if (!binary) {
    throw new Error(
      "No Chrome or Chromium found — set CHROME_PATH to a browser binary."
    );
  }
  return binary;
}

async function readDevToolsPort(profileDir: string) {
  const portFile = join(profileDir, "DevToolsActivePort");
  const deadline = Date.now() + PORT_FILE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const [port] = (await readFile(portFile, "utf8")).split("\n");
      if (port) return Number(port);
    } catch {
      // Chrome writes the file once the DevTools endpoint is listening.
    }
    await delay(50);
  }
  throw new Error("Chrome did not report a DevTools port");
}

async function connect(endpoint: string) {
  const socket = new WebSocket(endpoint);
  await new Promise<void>((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener(
      "error",
      () => reject(new Error(`Could not connect to ${endpoint}`)),
      { once: true }
    );
  });

  let nextId = 1;
  const pending = new Map<
    number,
    {
      method: string;
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
    }
  >();
  const listeners = new Set<(message: CdpMessage) => void>();

  socket.addEventListener("message", (event) => {
    const data: CdpMessage = JSON.parse(String(event.data));
    if (data.id === undefined) {
      for (const listener of [...listeners]) listener(data);
      return;
    }
    const entry = pending.get(data.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.error) {
      entry.reject(new Error(`${entry.method}: ${data.error.message}`));
    } else {
      entry.resolve(data.result);
    }
  });

  const send = <T>(
    method: string,
    params: Record<string, unknown> = {},
    sessionId?: string
  ) => {
    const id = nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, COMMAND_TIMEOUT_MS);
      pending.set(id, {
        method,
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value as T);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      socket.send(
        JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) })
      );
    });
  };

  const waitForEvent = (method: string, sessionId: string, timeoutMs: number) =>
    new Promise<void>((resolve, reject) => {
      const listener = (data: CdpMessage) => {
        if (data.method !== method) return;
        if (data.sessionId !== sessionId) return;
        clearTimeout(timer);
        listeners.delete(listener);
        resolve();
      };
      const timer = setTimeout(() => {
        listeners.delete(listener);
        reject(new Error(`${method} did not fire`));
      }, timeoutMs);
      listeners.add(listener);
    });

  return { send, waitForEvent, close: () => socket.close() };
}

export async function launchBrowser({
  headed = false,
}: { headed?: boolean } = {}): Promise<CaptureBrowser> {
  const binary = findBinary();
  const profileDir = await mkdtemp(join(tmpdir(), "reviewer-capture-"));
  const child = spawn(
    binary,
    [
      ...(headed ? [] : ["--headless=new"]),
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      "--mute-audio",
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  const port = await readDevToolsPort(profileDir);
  const version = (await fetch(`http://127.0.0.1:${port}/json/version`).then(
    (response) => response.json()
  )) as { webSocketDebuggerUrl: string };
  const connection = await connect(version.webSocketDebuggerUrl);

  return {
    async openPage({ width, height, scheme, initScript }) {
      const { targetId } = await connection.send<{ targetId: string }>(
        "Target.createTarget",
        { url: "about:blank" }
      );
      const { sessionId } = await connection.send<{ sessionId: string }>(
        "Target.attachToTarget",
        { targetId, flatten: true }
      );
      const send = (method: string, params?: Record<string, unknown>) =>
        connection.send(method, params, sessionId);

      await send("Page.enable");
      await send("Runtime.enable");
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await send("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-color-scheme", value: scheme }],
      });
      if (initScript) {
        await send("Page.addScriptToEvaluateOnNewDocument", {
          source: initScript,
        });
      }

      const evaluate = async <T>(expression: string) => {
        const { result, exceptionDetails } =
          await connection.send<EvaluateResult>(
            "Runtime.evaluate",
            { expression, awaitPromise: true, returnByValue: true },
            sessionId
          );
        if (exceptionDetails) {
          throw new Error(
            exceptionDetails.exception?.description ?? exceptionDetails.text
          );
        }
        return result.value as T;
      };

      return {
        async goto(url) {
          const loaded = connection.waitForEvent(
            "Page.loadEventFired",
            sessionId,
            NAVIGATION_TIMEOUT_MS
          );
          await send("Page.navigate", { url });
          await loaded;
        },
        async waitForSelector(selector, timeoutMs) {
          const deadline = Date.now() + timeoutMs;
          while (Date.now() < deadline) {
            const found = await evaluate<boolean>(
              `!!document.querySelector(${JSON.stringify(selector)})`
            );
            if (found) return;
            await delay(SELECTOR_POLL_MS);
          }
          throw new Error(`Timed out waiting for ${selector}`);
        },
        evaluate,
        async click(x, y) {
          // Move first: gutter affordances only render under the pointer, so a
          // bare press lands on nothing.
          await send("Input.dispatchMouseEvent", {
            type: "mouseMoved",
            x,
            y,
            button: "none",
          });
          await delay(HOVER_SETTLE_MS);
          for (const type of ["mousePressed", "mouseReleased"]) {
            await send("Input.dispatchMouseEvent", {
              type,
              x,
              y,
              button: "left",
              buttons: type === "mousePressed" ? 1 : 0,
              clickCount: 1,
            });
          }
        },
        elementOrigin: (selector) =>
          evaluate<{ x: number; y: number } | null>(
            `(() => {
              const element = document.querySelector(${JSON.stringify(selector)});
              if (!element) return null;
              const rect = element.getBoundingClientRect();
              return { x: rect.left, y: rect.top };
            })()`
          ),
        close: () => connection.send("Target.closeTarget", { targetId }),
      };
    },
    async close() {
      connection.close();
      const exited = new Promise<void>((resolve) =>
        child.once("exit", () => resolve())
      );
      child.kill();
      await exited;
      await rm(profileDir, { recursive: true, force: true, maxRetries: 5 });
    },
  };
}
