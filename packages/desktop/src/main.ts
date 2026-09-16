/**
 * reviewer desktop — Electron main process.
 *
 * Wraps the SPA in a native window. The app is self-contained: it makes sure
 * the API server is running (spawning it if necessary) and then loads the SPA.
 *
 * - Dev (`REVIEWER_DESKTOP_DEV=1`): loads the Vite dev server and spawns the
 *   server through pnpm if nothing answers on the API port yet.
 * - Prod/local package test: runs the bundled server and loads the built SPA
 *   from disk. No pnpm, tsx, or Vite server is required at runtime.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  nativeImage,
  nativeTheme,
  protocol,
  shell,
} from "electron";
import { autoUpdater } from "electron-updater";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "reviewer",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

// Beta and production installs coexist on one machine (distinct appId +
// product name → separate app bundles and userData dirs). Beta builds carry a
// `-beta.N` version suffix, so key the identity and the local server port off
// that: without it, both channels would default to the same port and running
// them at once would cross-wire — the renderer, the spawned server, and the
// reachability checks all target this port.
const isBeta = app.getVersion().includes("-beta.");

// Branding: the product name shown in the macOS menu bar, dock, and window
// title. Set before the app is ready so it replaces Electron's default name.
app.setName(isBeta ? "Reviewer Beta" : "Reviewer");

const isDev = process.env["REVIEWER_DESKTOP_DEV"] === "1";
const serverPort = Number(
  process.env["REVIEWER_PORT"] ?? (isBeta ? 41821 : 41811)
);
// Propagate the resolved port so the preload/renderer (which reads
// REVIEWER_PORT) and the spawned server agree on it, even when it wasn't set
// from the outside.
process.env["REVIEWER_PORT"] = String(serverPort);
const serverUrl = `http://localhost:${serverPort}`;
const spaUrl = process.env["REVIEWER_DEV_URL"] ?? "http://localhost:41812";

// packages/desktop/dist/main.js → repository root.
const repoRoot = resolve(__dirname, "..", "..", "..");
const packagedAppRoot = resolve(__dirname, "..");
const rendererRoot = app.isPackaged
  ? join(packagedAppRoot, "renderer")
  : resolve(repoRoot, "packages", "spa", "dist", "client");
const rendererIndex = join(rendererRoot, "_shell.html");
const bundledServerEntry = app.isPackaged
  ? join(packagedAppRoot, "server", "main.cjs")
  : resolve(repoRoot, "packages", "embedded-server", "dist", "main.cjs");
const pnpmBin = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

// The Reviewer brand logo, used for the window and the macOS dock icon so the
// app no longer shows Electron's default icon. Both variants are the `brand/`
// square on the macOS icon grid — an 824px tile centred in a 1024px canvas, the
// margin every other dock icon leaves — carrying the same top-to-bottom
// gradient the packaged icon gets from its `automatic-gradient` fills, and
// differ only in whether the tile is dark with a white mark or light with a
// black one, so nothing moves or resizes as the appearance flips. Resolved
// relative to `dist/` (../assets) so dev and packaged builds load the same
// files.
const brandIcons = {
  dark: nativeImage.createFromPath(
    resolve(__dirname, "..", "assets", "reviewer-icon-dark.png")
  ),
  light: nativeImage.createFromPath(
    resolve(__dirname, "..", "assets", "reviewer-icon-light.png")
  ),
};

const currentBrandIcon = () =>
  nativeTheme.shouldUseDarkColors ? brandIcons.dark : brandIcons.light;

/**
 * A packaged macOS app leaves its dock tile to the system: the bundle icon
 * (compiled from `assets/Reviewer.icon` at build time) is rendered by macOS
 * 26 with its glass treatment and appearance variants, and `dock.setIcon`
 * would replace that with the flat PNG — a duller tile than the one shown
 * before launch. Dev has no bundle at all and so still paints the PNG, as do
 * the window icons elsewhere, following the appearance as it flips.
 */
function applyBrandIcon() {
  const icon = currentBrandIcon();
  if (icon.isEmpty()) return;
  if (process.platform === "darwin") {
    if (app.isPackaged) return;
    app.dock?.setIcon(icon);
    return;
  }
  for (const window of BrowserWindow.getAllWindows()) window.setIcon(icon);
}

let serverProcess: ChildProcess | null = null;

/**
 * A packaged `.app` launched from Finder inherits launchd's minimal PATH
 * (`/usr/bin:/bin:/usr/sbin:/sbin`), which omits Homebrew. `git` lives in
 * `/usr/bin` so it still resolves, but `gh` (used for GitHub auth) lives in
 * `/opt/homebrew/bin` (Apple Silicon) or `/usr/local/bin` (Intel) and silently
 * fails to spawn — so PRs load in dev but vanish in the built app. Prepend the
 * common locations so the spawned server can find `gh` and friends.
 */
function ensureBinPath(): void {
  if (process.platform === "win32") return;
  const extra = ["/opt/homebrew/bin", "/usr/local/bin"];
  const current = (process.env["PATH"] ?? "").split(":").filter(Boolean);
  const missing = extra.filter((dir) => !current.includes(dir));
  if (missing.length > 0) {
    process.env["PATH"] = [...missing, ...current].join(":");
  }
}

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** Resolves once `url` answers an HTTP request, or rejects after `timeoutMs`. */
async function waitForUrl(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1000);
      await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      return;
    } catch {
      if (Date.now() > deadline) {
        throw new Error(`timed out waiting for ${url}`);
      }
      await sleep(300);
    }
  }
}

async function isReachable(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 600);
    await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

/** Ensure the API server is up, spawning it when nothing answers yet. */
async function ensureServer(): Promise<void> {
  if (await isReachable(`${serverUrl}/api/workspace`)) return;

  const serverCwd = app.isPackaged ? app.getPath("home") : repoRoot;

  // In the packaged app the bundled server runs under Electron's Node
  // (ELECTRON_RUN_AS_NODE) — the same runtime as this process — so the native
  // node-pty module electron-builder rebuilt for Electron is loadable, and we
  // can hand the server its exact resolved location. In dev the server runs on
  // system Node via tsx, where it resolves its own (system-ABI) node-pty, so we
  // must NOT pass an Electron-ABI path across the runtime boundary.
  let resolvedNodePty: string | undefined;
  if (!isDev) {
    try {
      resolvedNodePty = require.resolve("node-pty");
    } catch {
      resolvedNodePty = undefined;
    }
  }

  serverProcess = isDev
    ? spawn(pnpmBin, ["--filter", "@reviewer/embedded-server", "start"], {
        cwd: serverCwd,
        env: { ...process.env, REVIEWER_PORT: String(serverPort) },
        stdio: "inherit",
      })
    : spawn(process.execPath, [bundledServerEntry], {
        cwd: serverCwd,
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: "1",
          REVIEWER_PORT: String(serverPort),
          ...(resolvedNodePty ? { REVIEWER_NODE_PTY: resolvedNodePty } : {}),
        },
        stdio: "inherit",
      });

  serverProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`server exited with code ${code}`);
    }
  });

  await waitForUrl(`${serverUrl}/api/workspace`, 20_000);
}

/**
 * A navigation — some route the router owns — rather than a fetch for a file the
 * app ships. Only navigations get the SPA shell when nothing is on disk:
 * answering a missing `index-abc123.js` with HTML gets it rejected on MIME type
 * and leaves the window blank with nothing but that error to go on.
 *
 * The `Accept` header is the only signal that survives the trip: Electron leaves
 * `request.destination` empty and strips `Sec-Fetch-Dest`. Chromium asks for
 * `text/html` on a navigation and never on a script, stylesheet or `fetch()`.
 * A route's path is no help — `/modes/code/review/worktree/src/main.ts` is a
 * route, dot and all.
 */
function isNavigation(request: GlobalRequest): boolean {
  return (request.headers.get("accept") ?? "").includes("text/html");
}

function registerRendererProtocol(): void {
  protocol.handle("reviewer", (request) => {
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname);
    const candidate =
      pathname === "/" ? rendererIndex : resolve(rendererRoot, `.${pathname}`);
    const onDisk =
      candidate.startsWith(rendererRoot) &&
      existsSync(candidate) &&
      statSync(candidate).isFile();

    if (!onDisk && !isNavigation(request)) {
      return new Response("Not found", {
        status: 404,
        headers: { "content-type": "text/plain" },
      });
    }

    return net.fetch(
      pathToFileURL(onDisk ? candidate : rendererIndex).toString()
    );
  });
}

const isMac = process.platform === "darwin";

/** Everything the app itself is served from — anything else is the web. */
function isInternalUrl(url: string): boolean {
  if (url.startsWith("reviewer://")) return true;
  try {
    const { origin } = new URL(url);
    return origin === new URL(spaUrl).origin || origin === serverUrl;
  } catch {
    return false;
  }
}

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    // On macOS the window frame is a vibrancy layer the renderer tints through
    // (see `.desktop .app-frame`), so the background has to be fully clear for
    // the blur behind it to show. Elsewhere it stays an opaque near-black.
    // Do NOT add `transparent: true` here: the docs suggest it is needed for the
    // alpha above, but it drops the vibrancy view instead of enabling it.
    backgroundColor: isMac ? "#00000000" : "#000000",
    ...(isMac
      ? {
          vibrancy: "under-window" as const,
          visualEffectState: "active" as const,
        }
      : {}),
    title: "Reviewer",
    icon: currentBrandIcon(),
    titleBarStyle: "hiddenInset",
    // Measured off screenshots rather than reasoned about: macOS lands a 14px
    // light on an even pixel, snapping this inset down to reach one, so its
    // centre falls on an odd pixel — and 23 is the one the WindowBar rides its
    // controls on. The bar's lead gutter is what leaves room for them.
    trafficLightPosition: { x: 20, y: 16 },
    webPreferences: {
      preload: resolve(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      // The browser pane embeds the app under review in a <webview>.
      webviewTag: true,
    },
  });

  // The pane loads whatever the user types into its address bar, so the guest is
  // untrusted: hold it to the sandbox regardless of the attributes the renderer
  // asked for, and refuse to run any preload in it.
  window.webContents.on("will-attach-webview", (_event, webPreferences) => {
    webPreferences.nodeIntegration = false;
    webPreferences.nodeIntegrationInSubFrames = false;
    webPreferences.contextIsolation = true;
    delete webPreferences.preload;
  });

  // Open target=_blank / external links in the system browser, not the app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) shell.openExternal(url);
    return { action: "deny" };
  });

  // A plain link to the web (a PR on GitHub, a doc) would otherwise replace the
  // app inside its own window, with no way back — the shell has no address bar.
  // Hand those to the system browser and stay put; in-app navigation continues.
  window.webContents.on("will-navigate", (event, url) => {
    if (isInternalUrl(url)) return;
    event.preventDefault();
    if (url.startsWith("http")) void shell.openExternal(url);
  });

  if (isDev) {
    await waitForUrl(spaUrl, 30_000);
    await window.loadURL(spaUrl);
  } else {
    await window.loadURL("reviewer://app/");
  }
}

// Native folder picker, invoked from the renderer through the preload bridge.
ipcMain.handle("dialog:open-directory", async (event) => {
  const owner = BrowserWindow.fromWebContents(event.sender);
  const result = await (owner
    ? dialog.showOpenDialog(owner, {
        title: "Open repository",
        properties: ["openDirectory", "createDirectory"],
      })
    : dialog.showOpenDialog({
        title: "Open repository",
        properties: ["openDirectory", "createDirectory"],
      }));
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

app.whenReady().then(async () => {
  ensureBinPath();

  if (!isDev) registerRendererProtocol();

  applyBrandIcon();
  nativeTheme.on("updated", applyBrandIcon);

  try {
    await ensureServer();
    await createWindow();
  } catch (cause) {
    console.error("failed to start reviewer desktop:", cause);
    app.quit();
  }

  // Check GitHub Releases for a newer signed build, download it in the
  // background, and install on quit (with a native "restart to update" prompt).
  // Only meaningful in a packaged, signed build — Squirrel.Mac refuses to apply
  // an update to an app whose signature it can't verify — so this no-ops in dev
  // and unsigned local packages. Failures (offline, no release yet) are logged
  // and swallowed so a bad update check never blocks startup.
  if (app.isPackaged) {
    autoUpdater
      .checkForUpdatesAndNotify()
      .catch((cause) => console.error("update check failed:", cause));
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Only tear down child processes this app started.
app.on("quit", () => {
  if (serverProcess !== null) serverProcess.kill();
});
