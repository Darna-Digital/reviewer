/**
 * The native shell's islands, and the channel between an island and the shell.
 *
 * The macOS app (packages/mac-os) is a native window that hosts parts of this
 * app in web views of its own — the code surface with its dock — each one a
 * document of its own, loaded from the same build, told which island it is by
 * the bridge the shell installs before the first script runs
 * (`window.reviewer.island`, see `lib/desktop`). The chrome around an island
 * — the window tabs, the open-file strip, the file tree in the sidebar — is
 * the shell's own, drawn natively from what the island reports.
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
import type { TreeItem } from "@/interactions/file-actions/interfaces/file-actions.interfaces";
import type { AppMode } from "@/lib/api/types";
import { islandBridge } from "@/lib/desktop";
import type { CommitAgent } from "@/lib/ui-prefs";
import type { CommitDraft } from "@reviewer/core/git-message";
import type { GitStatusEntry } from "@reviewer/core/repo";

export type Island = "tabs" | "launchpad" | "code";

/** Shell → island. */
export type ShellEvent =
  | { readonly type: "navigate"; readonly href: string }
  /** Something changed behind the island's back — a save, an agent turn ending,
   * a project switch — so everything it holds is re-asked for. */
  | { readonly type: "refresh" }
  /** The shell's own open-file strip was acted on — see `ShellTabStrip`. */
  | { readonly type: "tabs"; readonly action: ShellTabAction }
  /** The shell's own file tree was acted on — see `ShellTree`. */
  | { readonly type: "tree"; readonly action: ShellTreeAction };

/** Island → shell. */
export type ShellIntent =
  | { readonly type: "ready"; readonly island: Island }
  | { readonly type: "navigated"; readonly href: string }
  /** The code island's open-file strip as it stands, for the shell to draw in
   * its own chrome; null once the page stops showing one. */
  | { readonly type: "tabs"; readonly strip: ShellTabStrip | null }
  /** The code page's file tree as it stands, for the shell to draw in its
   * sidebar; null once the page stops showing one. */
  | { readonly type: "tree"; readonly tree: ShellTree | null }
  /** What moves under the tree without the listing moving — the selection, the
   * commit composer — sent apart so a click does not carry every path again. */
  | { readonly type: "treeState"; readonly state: ShellTreeState };

/**
 * The open-file strip, as the shell draws it: the tabs in the order the web
 * strip shows them, and whether each is a preview, pinned, or holding an
 * unsaved buffer. The file's type icon is the shell's own — it carries the
 * tree's sprite, imported at build time — so only the path crosses.
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

/**
 * The file tree, as the shell draws it in its sidebar: what the web tree is
 * given — the paths, the git status of each, the mode that decides the layout
 * (the project, or the changed files) — and what it may do to them, since a
 * review lists somebody else's files and a diff read against a branch has
 * nothing of its own to discard.
 */
export interface ShellTree {
  readonly mode: AppMode;
  readonly paths: ReadonlyArray<string>;
  readonly gitStatus: ReadonlyArray<GitStatusEntry>;
  readonly loading: boolean;
  /** The open project folder, for the absolute path the menu copies. */
  readonly projectPath: string | null;
  /** Whether rows can be made, renamed and deleted — the project's own files. */
  readonly editable: boolean;
  /** Whether a row's working-tree changes can be discarded. */
  readonly discardable: boolean;
}

/**
 * The file the page is on, and the commit composer the web sidebar has under
 * the tree in commit mode.
 */
export interface ShellTreeState {
  readonly selected: string | null;
  readonly commit: ShellCommitComposer | null;
}

export interface ShellCommitComposer {
  readonly changes: ReadonlyArray<GitStatusEntry>;
  /** The server's drafting run — running, finished, or nothing yet. */
  readonly draft: CommitDraft | null;
}

/**
 * What the shell's tree can do — the tree's own props again, minus the DOM,
 * with the shell having already asked whatever the web tree asks first (a yes
 * to a deletion, a name for a new file).
 */
export type ShellTreeAction =
  | { readonly kind: "select"; readonly path: string }
  | { readonly kind: "history"; readonly path: string }
  | { readonly kind: "discard"; readonly paths: ReadonlyArray<string> }
  | { readonly kind: "delete"; readonly items: ReadonlyArray<TreeItem> }
  | { readonly kind: "rename"; readonly from: string; readonly to: string }
  | {
      readonly kind: "create";
      readonly path: string;
      readonly entry: TreeItem["kind"];
    }
  | {
      readonly kind: "commit";
      readonly message: string;
      readonly paths: ReadonlyArray<string>;
      readonly push: boolean;
    }
  | {
      readonly kind: "draft";
      readonly paths: ReadonlyArray<string>;
      readonly agent: CommitAgent;
    }
  /** The finished draft has been taken into the composer, so it can go. */
  | { readonly kind: "draftSettled" };

export interface ShellChannel {
  post: (intent: ShellIntent) => Promise<void>;
  subscribe: (listener: (event: ShellEvent) => void) => () => void;
  /** Called by the shell, never by the island. */
  dispatch: (event: ShellEvent) => void;
}

const ISLANDS: ReadonlySet<string> = new Set<Island>([
  "tabs",
  "launchpad",
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
