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
  | { readonly type: "refresh" }
  /** The shell's own open-file strip was acted on — see `ShellTabStrip`. */
  | { readonly type: "tabs"; readonly action: ShellTabAction };

/** Island → shell. */
export type ShellIntent =
  | { readonly type: "ready"; readonly island: Island }
  | { readonly type: "navigated"; readonly href: string }
  /** The code island's open-file strip as it stands, for the shell to draw in
   * its own chrome; null once the page stops showing one. */
  | { readonly type: "tabs"; readonly strip: ShellTabStrip | null };

/**
 * The open-file strip, as the shell draws it: the tabs in the order the web
 * strip shows them, and everything a native tab needs to look like the web one
 * — the file's type icon as inline SVG in each of the two palettes, and whether
 * it is a preview, pinned, or holding an unsaved buffer.
 */
export interface ShellTabStrip {
  readonly tabs: ReadonlyArray<ShellTab>;
  readonly active: string | null;
}

export interface ShellTab {
  readonly path: string;
  readonly name: string;
  readonly pinned: boolean;
  readonly preview: boolean;
  readonly dirty: boolean;
  readonly icon: ShellTabIcon;
}

export interface ShellTabIcon {
  /** A standalone `<svg>` painting in `currentColor`. */
  readonly svg: string;
  readonly light: string;
  readonly dark: string;
}

/** What the shell's strip can do to the island's tabs — `TabStripProps` again. */
export type ShellTabAction =
  | { readonly kind: "select"; readonly path: string }
  | { readonly kind: "keep"; readonly path: string }
  | { readonly kind: "close"; readonly path: string }
  | { readonly kind: "togglePin"; readonly path: string }
  | { readonly kind: "closeOthers"; readonly path: string }
  | { readonly kind: "closeAll" }
  | { readonly kind: "move"; readonly path: string; readonly toIndex: number };

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
