/**
 * Desktop-shell detection, and the bridge the shell hands the renderer.
 *
 * The Electron preload bridge injects `window.reviewer` (see
 * packages/desktop/src/preload.ts). When present we're running inside the
 * native window, where the macOS traffic lights sit over the top-left of the
 * web content (`titleBarStyle: "hiddenInset"`) — the window bar reserves space
 * for them. In the plain browser the bridge is absent and no space is reserved.
 *
 * A preview is the app in an iframe of that same window (see `preview-window`),
 * and Electron runs a preload in the main frame only: the frame comes up with
 * no bridge at all and would otherwise take the browser's path — no API origin,
 * so every request goes to `reviewer://app/api/…` and 404s against the shell's
 * own protocol handler, and a picture of a page that never loaded. It is
 * same-origin with the window it hangs in, so it borrows that window's bridge.
 *
 * SPA-only (no SSR), so reading `window` at module load is safe.
 */
import { isPreviewWindow } from "@/lib/preview-window";
import type { ShellChannel } from "@/lib/shell";

interface ReviewerBridge {
  apiBaseUrl?: string;
  openDirectory: () => Promise<string | null>;
  /** Present only where the shell has a Quick Look panel to show — macOS. */
  previewFile?: (path: string) => Promise<void>;
  /**
   * Set by the macOS shell, which hosts the app one island at a time: this
   * document is that island and nothing else. Which one is checked and typed
   * in `lib/shell`; the bridge only carries the name.
   */
  island?: string;
  /** "dark" or "light" — the appearance the shell's window is in. */
  appearance?: string;
  shell?: ShellChannel;
}

type ReviewerWindow = Window & {
  reviewer?: ReviewerBridge;
};

const bridgeIn = (view: Window): ReviewerBridge | undefined => {
  try {
    return (view as ReviewerWindow).reviewer;
  } catch {
    // A frame whose parent is another origin: not a preview, and not ours.
    return undefined;
  }
};

const bridge =
  typeof window === "undefined"
    ? undefined
    : (bridgeIn(window) ??
      (isPreviewWindow ? bridgeIn(window.parent) : undefined));

export const isDesktop = bridge !== undefined;

/** The raw bridge, for `lib/shell` to read the island name and channel from. */
export const islandBridge = bridge;

/**
 * The local API server's origin in the packaged app, where the renderer is
 * served over `reviewer://` and has no proxy to go through. Undefined in the
 * browser and in dev, which stay same-origin behind Vite's `/api` proxy.
 */
export const desktopApiBaseUrl = bridge?.apiBaseUrl;

export async function openDesktopDirectory(): Promise<string | null> {
  return bridge?.openDirectory() ?? null;
}

export const canQuickLook = bridge?.previewFile !== undefined;

/** Quick Look `absolutePath`; a no-op where the shell has no panel for it. */
export function quickLookFile(absolutePath: string): void {
  void bridge?.previewFile?.(absolutePath);
}
