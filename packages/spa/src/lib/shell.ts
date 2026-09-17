/**
 * The native shell's islands, and the channel between an island and the shell.
 *
 * The macOS app (packages/mac-os) is a native window that hosts parts of this
 * app in web views of its own — the tab strip, the launchpad, the bottom dock,
 * the file tree, the code surface — each one a document of its own, loaded from
 * the same build, told which island it is by the bridge the shell installs
 * before the first script runs (`window.reviewer.island`, see `lib/desktop`).
 *
 * Islands cannot share a JavaScript heap, so what two of them both need — the
 * open project, the window tabs, which one is selected, where the code surface
 * is pointed — lives in the shell, and the shell is the one that navigates. An
 * island never moves itself between pages; it *reports* where it is, and it
 * goes where it is *told*. That is the whole contract, in the two unions below.
 *
 * Absent the shell, `shell` is a channel nobody is on the other end of, so an
 * island renders in a plain browser tab exactly as it does in the window — the
 * way every island is developed.
 */
import { islandBridge } from "@/lib/desktop";

export type Island = "tabs" | "launchpad" | "dock" | "tree" | "code";

/** Shell → island. */
export type ShellEvent =
  | { readonly type: "navigate"; readonly href: string }
  /** Something changed behind the island's back — a save, an agent turn ending,
   * a project switch — so everything it holds is re-asked for. */
  | { readonly type: "refresh" };

/** Island → shell. */
export type ShellIntent =
  | { readonly type: "ready"; readonly island: Island }
  | { readonly type: "navigated"; readonly href: string };

export interface ShellChannel {
  post: (intent: ShellIntent) => Promise<void>;
  subscribe: (listener: (event: ShellEvent) => void) => () => void;
  /** Called by the shell, never by the island. */
  dispatch: (event: ShellEvent) => void;
}

const ISLANDS: ReadonlySet<string> = new Set<Island>([
  "tabs",
  "launchpad",
  "dock",
  "tree",
  "code",
]);

const isIsland = (value: unknown): value is Island =>
  typeof value === "string" && ISLANDS.has(value);

/** Which island this document is, or undefined for the whole app. */
export const island: Island | undefined = isIsland(islandBridge?.island)
  ? islandBridge.island
  : undefined;

const unhosted: ShellChannel = {
  post: () => Promise.resolve(),
  subscribe: () => () => {},
  dispatch: () => {},
};

export const shell: ShellChannel = islandBridge?.shell ?? unhosted;
