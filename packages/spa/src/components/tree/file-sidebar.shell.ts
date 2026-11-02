/**
 * The file tree, handed to the native shell.
 *
 * In the macOS window the sidebar is the window's own: the shell draws the
 * tree there natively — the project's files, or the changed ones with the
 * commit composer under them; a pull request's it draws beside the sidebar
 * instead, under the pull request's overview, the sidebar holding the list
 * of them — from a picture of what `FileSidebar` would be given, and sends
 * back what was done to it. The tree's data and every action on it stay this
 * page's: the listing, the diff and the git actions are all wired here, and
 * the shell only ever asks.
 *
 * The shell confirms what the web tree confirms — a discard — before it sends,
 * so every action arrives ready to carry out.
 */
import { useEffect, useMemo, useRef } from "react";
import type { CommitDraft } from "@reviewer/core/git-message";
import type { GitStatusEntry } from "@reviewer/core/repo";
import type { AppMode } from "@/lib/api/types";
import {
  island,
  shell,
  type ShellComparison,
  type ShellTree,
  type ShellTreeAction,
  type ShellTreeState,
} from "@/lib/shell";
import type { CommitAgent } from "@/lib/ui-prefs";

/** Whether the tree is the shell's to draw rather than this document's. */
export const shellDrawsTree = island === "code";

/** What the shell's tree is drawn from — `FileSidebarProps`, minus the DOM. */
export interface ShellTreeSource {
  readonly mode: AppMode;
  readonly paths: ReadonlyArray<string>;
  readonly gitStatus: ReadonlyArray<GitStatusEntry>;
  readonly selectedFile: string | null;
  /** The root the selected file is in, when it is not the page's own. */
  readonly selectedRoot?: string | null;
  readonly loading: boolean;
  readonly projectPath: string | null;
  /** See `ShellTree.spansWorkspace`. */
  readonly spansWorkspace?: boolean;
  /** `root` names another repository's file, while the diff spans them all. */
  readonly onFileSelect: (path: string | null, root?: string) => void;
  /** A file the pointer has reached — read and highlighted ahead of a click. */
  readonly onFileIntent?: (path: string) => void;
  readonly onShowHistory: (path: string) => void;
  readonly onDiscardPaths?: (paths: ReadonlyArray<string>) => void;
  readonly commit?: ShellCommitSource;
  /** What the changes are read against, while they are your own. */
  readonly comparison?: ShellComparison;
}

export interface ShellCommitSource {
  readonly changes: ReadonlyArray<GitStatusEntry>;
  readonly draft: CommitDraft | undefined;
  readonly onCommit: (
    message: string,
    paths: ReadonlyArray<string>,
    andPush: boolean
  ) => Promise<unknown>;
  readonly onGenerate: (
    paths: ReadonlyArray<string>,
    agent: CommitAgent
  ) => Promise<void>;
  readonly onDraftSettled: () => void;
}

/**
 * The page whose listing the shell is drawing. A page's take-down waits a
 * tick and only goes through while it still owns the tree — see
 * `useShellTree`.
 */
let treeOwner: object | null = null;

const act = (source: ShellTreeSource, action: ShellTreeAction): void => {
  switch (action.kind) {
    case "select":
      return source.onFileSelect(action.path, action.root);
    case "intent":
      return source.onFileIntent?.(action.path);
    case "history":
      return source.onShowHistory(action.path);
    case "discard":
      return source.onDiscardPaths?.(action.paths);
    case "commit":
      return void source.commit?.onCommit(
        action.message,
        action.paths,
        action.push
      );
    case "draft":
      return void source.commit?.onGenerate(action.paths, action.agent);
    case "draftSettled":
      return source.commit?.onDraftSettled();
  }
};

/**
 * Keep the shell's tree in step with `source`, and its actions flowing back
 * into it; null where the page shows no tree, which takes the shell's down.
 */
export function useShellTree(source: ShellTreeSource | null): void {
  const latest = useRef(source);
  latest.current = source;
  const owner = useRef({}).current;

  // The handlers are remade every render; the picture only follows the data.
  const mode = source?.mode ?? null;
  const paths = source?.paths ?? null;
  const gitStatus = source?.gitStatus ?? null;
  const selected = source?.selectedFile ?? null;
  const selectedRoot = source?.selectedRoot ?? null;
  const loading = source?.loading ?? false;
  const projectPath = source?.projectPath ?? null;
  const discardable = source?.onDiscardPaths !== undefined;
  const spansWorkspace = source?.spansWorkspace ?? false;
  const changes = source?.commit?.changes ?? null;
  const draft = source?.commit?.draft ?? null;
  const against = source?.comparison?.against ?? null;
  const aim = source?.comparison?.aim ?? null;
  const comparing = source?.comparison !== undefined;
  const listing = useMemo<ShellTree | null>(
    () =>
      shellDrawsTree && mode !== null && paths !== null && gitStatus !== null
        ? {
            mode,
            paths,
            gitStatus,
            loading,
            projectPath,
            discardable,
            spansWorkspace,
          }
        : null,
    [mode, paths, gitStatus, loading, projectPath, discardable, spansWorkspace]
  );
  const state = useMemo<ShellTreeState>(
    () => ({
      selected,
      selectedRoot,
      commit: changes === null ? null : { changes, draft },
      comparison: comparing ? { against, aim } : null,
    }),
    [selected, selectedRoot, changes, draft, comparing, against, aim]
  );
  // A new listing and the state under it go as one message: posted apart,
  // they reach the shell in separate frames, and the composer under the tree
  // would land a frame after the rows it belongs to.
  const postedListing = useRef<ShellTree | null | undefined>(undefined);
  useEffect(() => {
    if (!shellDrawsTree) return;
    if (postedListing.current !== listing) {
      postedListing.current = listing;
      treeOwner = owner;
      void shell.post({
        type: "tree",
        tree: listing,
        ...(listing === null ? {} : { state }),
      });
      return;
    }
    if (listing !== null) void shell.post({ type: "treeState", state });
  }, [listing, state, owner]);
  // The code pages are sibling routes, so browse to review is this page
  // unmounting and the next mounting in the same commit. Taken down here and
  // put up again there, the shell's tree would be emptied for a frame between
  // them; instead the take-down waits a tick, and the next page's listing,
  // posted before it runs, cancels it. A page that leaves for a surface with
  // no tree posts nothing in that tick, and the take-down goes through. A
  // page that unmounts after the next one has already posted no longer owns
  // the tree, and leaves it standing. Effects torn down and run again on the
  // same page — StrictMode, a hidden subtree shown again — post the listing
  // afresh, which cancels the take-down too.
  useEffect(() => {
    if (!shellDrawsTree) return;
    return () => {
      postedListing.current = undefined;
      queueMicrotask(() => {
        if (treeOwner !== owner || postedListing.current !== undefined) return;
        treeOwner = null;
        void shell.post({ type: "tree", tree: null });
      });
    };
  }, [owner]);

  useEffect(() => {
    if (!shellDrawsTree) return;
    return shell.subscribe((event) => {
      if (event.type !== "tree" || latest.current === null) return;
      act(latest.current, event.action);
    });
  }, []);
}
