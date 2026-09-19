/**
 * The native shell's islands, and the channel between an island and the shell.
 *
 * The macOS app (packages/mac-os) is a native window that hosts parts of this
 * app in web views of its own — the code surface with its dock — each one a
 * document of its own, loaded from the same build, told which island it is by
 * the bridge the shell installs before the first script runs
 * (`window.reviewer.island`, see `lib/desktop`). The chrome around an island —
 * the file tree in the sidebar — is the shell's own, drawn natively from what
 * the island reports. The window tabs are not: they are the island's own strip,
 * the same one the window bar draws in a browser tab, so a tab is
 * switched the way the router switches a page — in the document, primed ahead
 * of the click — rather than by a trip over the bridge and back. What the shell
 * has of them is a picture, for its menus.
 *
 * Islands cannot share a JavaScript heap, so what two of them both need — the
 * open project, where the code surface is pointed — lives in the shell, and the
 * shell is the one that navigates between them. An island never moves itself
 * out of its part of the app; it *reports* where it is, and it goes where it is
 * *told*. That is the whole contract, in the two unions below.
 *
 * Absent the shell, `shell` is a channel nobody is on the other end of, so an
 * island renders in a plain browser tab exactly as it does in the window — the
 * way every island is developed. A preview — the app in a frame of the island,
 * photographed for the launchpad — is cut off the same way: it borrows the
 * island's bridge to know it is one, and must not be heard as one.
 */
import type { TreeItem } from "@/interactions/file-actions/interfaces/file-actions.interfaces";
import type { WindowTabKind } from "@/interactions/window-tabs/interfaces/window-tabs.interfaces";
import type { AppMode } from "@/lib/api/types";
import type { DateFilter } from "@/lib/date-filter";
import { islandBridge } from "@/lib/desktop";
import { isPreviewWindow } from "@/lib/preview-window";
import type { BottomTab, CommitAgent } from "@/lib/ui-prefs";
import type { ChatProjectTally, ChatProviderKind } from "@reviewer/core/chats";
import type { CommitDraft } from "@reviewer/core/git-message";
import type { GitStatusEntry } from "@reviewer/core/repo";

export type Island = "code";

/** Shell → island. */
export type ShellEvent =
  | { readonly type: "navigate"; readonly href: string }
  /** Something changed behind the island's back — a save, an agent turn ending,
   * a project switch — so everything it holds is re-asked for. */
  | { readonly type: "refresh" }
  /** A menu chord for the window tabs — see `ShellWindowTabAction`. */
  | { readonly type: "windowTabs"; readonly action: ShellWindowTabAction }
  /** The shell's own file tree was acted on — see `ShellTree`. */
  | { readonly type: "tree"; readonly action: ShellTreeAction }
  /** The shell's own sessions list was acted on — see `ShellSessions`. */
  | { readonly type: "sessions"; readonly action: ShellSessionAction }
  /** The shell's own pane took the foot of the window — see `ShellDockAction`. */
  | { readonly type: "dock"; readonly action: ShellDockAction }
  /** The shell's own assign bar was acted on — see `ShellReview`. */
  | { readonly type: "review"; readonly action: ShellReviewAction };

/** Island → shell. */
export type ShellIntent =
  | { readonly type: "ready"; readonly island: Island }
  | { readonly type: "navigated"; readonly href: string }
  /** The window tabs as the strip stands, for the shell's menus to name. */
  | { readonly type: "windowTabs"; readonly strip: ShellWindowTabStrip }
  /** The code page's file tree as it stands, for the shell to draw in its
   * sidebar; null once the page stops showing one. */
  | { readonly type: "tree"; readonly tree: ShellTree | null }
  /** What moves under the tree without the listing moving — the selection, the
   * commit composer — sent apart so a click does not carry every path again. */
  | { readonly type: "treeState"; readonly state: ShellTreeState }
  /** The sessions list as the sessions surface holds it, for the shell to draw
   * in its sidebar; null once the page leaves the surface. */
  | { readonly type: "sessions"; readonly list: ShellSessions | null }
  /** The find-usages drawer the page keeps under itself is up — the one dock
   * surface still the page's, opened from a symbol in its code — or down
   * (null), so the shell's own pane can leave the foot of the window to it. */
  | { readonly type: "dock"; readonly shown: BottomTab | null }
  /** The page asked for one file's past — from its path bar, a file's tab —
   * and the History surface is the shell's own, so the ask crosses over. */
  | { readonly type: "history"; readonly path: string }
  /** The review comments the page is holding for a hand-off, for the shell
   * to float its assign bar over the page; null once there are none. */
  | { readonly type: "review"; readonly review: ShellReview | null };

/**
 * The window tabs, as the shell draws them on its toolbar and names them in
 * its menus: the strip in the order it is shown, which of them holds the
 * window, and what each is. The strip itself — the store, the priming, the
 * switch — is the island's; what crosses is the picture, so the toolbar can
 * draw the tabs, the Tabs menu can list the sessions ⌘1–9 reach and Close Tab
 * can stand down on a pinned one.
 */
export interface ShellWindowTabStrip {
  readonly tabs: ReadonlyArray<ShellWindowTab>;
  readonly activeId: string;
}

export interface ShellWindowTab {
  readonly id: string;
  readonly title: string;
  readonly kind: WindowTabKind;
  readonly pinned: boolean;
}

/**
 * What the shell asks of the strip — a tab pressed on its toolbar, and the
 * window bar's own chords, claimed by menu items so they answer while a native
 * view has the keyboard — handed back to the strip that answers them
 * everywhere else.
 */
export type ShellWindowTabAction =
  | { readonly kind: "select"; readonly id: string }
  | { readonly kind: "close"; readonly id: string }
  | { readonly kind: "newSession" }
  | { readonly kind: "closeActive" }
  /** The tab beside the active one, wrapping round. */
  | { readonly kind: "step"; readonly offset: 1 | -1 }
  /** The way of working after the one the window is on — Code, Sessions — ⌘G. */
  | { readonly kind: "mode" };

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
  /** What your own changes are read against — a question only your own
   * changes have, so null on every other surface. See `LocalComparison`. */
  readonly comparison: ShellComparison | null;
}

/**
 * The local comparison, flattened for the wire: the branch the changes are
 * read against, or null for what is merely uncommitted, and where the branch's
 * work is aimed, which the shell's picker marks the way the web one does.
 */
export interface ShellComparison {
  readonly against: string | null;
  readonly aim: string | null;
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

/**
 * The sessions list, as the shell draws it in its sidebar: the rows the
 * sessions surface would list beside the conversation — every project's
 * sessions, newest first, under the filters the surface keeps, and above them
 * the runs handed to reviewer cloud while the app is connected. The list
 * itself — the paged fetch, the filters, the marks read off each session —
 * stays the page's; what crosses is the rows, and what was done to them comes
 * back as a `ShellSessionAction`.
 */
export interface ShellSessions {
  readonly sessions: ReadonlyArray<ShellSession>;
  readonly cloudRuns: ReadonlyArray<ShellSession>;
  /** The session — or cloud run — the page is on, if any. */
  readonly activeId: string | null;
  /** The first page still on its way. */
  readonly loading: boolean;
  /** Whether the server has more rows after the loaded ones. */
  readonly hasMore: boolean;
  /** What the list is narrowed to, and what it could be narrowed to. */
  readonly filters: ShellSessionFilters;
}

/** The state a row wears, as `ChatRow` reads it off the session. */
export type ShellSessionMark = "running" | "error" | "unread";

export interface ShellSession {
  readonly id: string;
  readonly kind: "session" | "cloud";
  readonly title: string;
  /** Where the session runs — its project, or a cloud run's repository. */
  readonly origin: string;
  readonly updatedAt: string;
  readonly mark: ShellSessionMark | null;
  /** For the preview the shell shows over a row — what the web card shows
   * before the tail arrives, and what a cloud run has instead of one. */
  readonly messageCount: number;
  readonly lastMessage: string | null;
}

/**
 * The three ways the web narrows the list — the rail's search, and the filter
 * popover's project and date — all of them part of what the page asks the
 * server for, so the shell's field and menu narrow every session rather than
 * the pages loaded so far. The projects are the ones the filter can name, with
 * how many sessions each holds. See `chatListFilters`.
 */
export interface ShellSessionFilters {
  readonly search: string;
  /** `all`, or a project folder's absolute path. */
  readonly project: string;
  readonly date: DateFilter;
  readonly projects: ReadonlyArray<ChatProjectTally>;
}

/**
 * What the shell's list can do — the row's own gestures, and the list's:
 * a click shows the session on the Sessions tab, the menu lifts it into a tab
 * of its own or deletes it, scrolling to the foot asks for the next page, and
 * the field and the filter menu narrow what is asked for. `refetch` is the
 * conversation's: inside the shell the conversation is drawn natively, read
 * from the server by the shell itself, so the rows' marks — a turn running, a
 * session just started, one just opened — are re-read when it says they moved.
 */
export type ShellSessionAction =
  | { readonly kind: "select"; readonly id: string }
  | { readonly kind: "openInTab"; readonly id: string }
  | { readonly kind: "delete"; readonly id: string }
  | { readonly kind: "loadMore" }
  | { readonly kind: "refetch" }
  | { readonly kind: "search"; readonly text: string }
  | {
      readonly kind: "filter";
      readonly project?: string;
      readonly date?: DateFilter;
    };

/**
 * What the shell asks of the dock the code island still keeps: find usages,
 * the one surface that stays the page's — it is opened from a symbol in the
 * page's own code and previews the page's own files. Branches, history, the
 * terminal and the run surfaces are the shell's, drawn natively in its own
 * pane, and when that pane takes the foot of the window the drawer is put
 * away (`close`), so one surface stands at the bottom at a time.
 */
export type ShellDockAction = { readonly kind: "close" };

/**
 * The review in hand, as the shell floats its assign bar over the page: the
 * comments left on the diff and on the running app, flattened the way the web
 * bar lists them (see `AssignBarComment`), the branch they are about — the
 * sessions already working there lead the shell's picker — and whether a
 * hand-off is under way, so the bar can say so while the page does it. The
 * comments, the hand-off itself — the chat made, the prompt built, the
 * comments resolved after — and the jump to a comment's line stay the page's;
 * what crosses is the picture, and what was done to it comes back as a
 * `ShellReviewAction`.
 */
export interface ShellReview {
  readonly comments: ReadonlyArray<ShellReviewComment>;
  readonly branch: string;
  readonly assigning: boolean;
}

export interface ShellReviewComment {
  readonly id: string;
  readonly file: string;
  readonly line: number;
  readonly body: string;
}

/**
 * Where the shell's bar hands the review: a fresh chat with an agent on a
 * model, or a session already running — `AssignTarget`, on the wire.
 */
export type ShellReviewTarget =
  | {
      readonly kind: "new";
      readonly agent: ChatProviderKind;
      readonly model: string;
    }
  | { readonly kind: "existing"; readonly chatId: string };

/** What the shell's bar can do — the web bar's own three. */
export type ShellReviewAction =
  | { readonly kind: "assign"; readonly target: ShellReviewTarget }
  | { readonly kind: "open"; readonly id: string }
  | { readonly kind: "delete"; readonly id: string };

export interface ShellChannel {
  post: (intent: ShellIntent) => Promise<void>;
  subscribe: (listener: (event: ShellEvent) => void) => () => void;
  /** Called by the shell, never by the island. */
  dispatch: (event: ShellEvent) => void;
}

const ISLANDS: ReadonlySet<string> = new Set<Island>(["code"]);

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

export const shell: ShellChannel = isPreviewWindow
  ? unhosted
  : (islandBridge?.shell ?? unhosted);
