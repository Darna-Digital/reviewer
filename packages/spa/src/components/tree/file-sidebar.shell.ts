/**
 * The file tree, handed to the native shell.
 *
 * In the macOS window the sidebar is the window's own: the shell draws the
 * tree there natively — the project's files, or the changed ones with the
 * commit composer under them — from a picture of what `FileSidebar` would be
 * given, and sends back what was done to it. The tree's data and every action
 * on it stay this page's: the listing, the diff, the file actions and the git
 * actions are all wired here, and the shell only ever asks.
 *
 * The shell confirms what the web tree confirms — a deletion, a discard — and
 * prompts for what the web tree edits inline — a new name — before it sends,
 * so every action arrives ready to carry out.
 */
import { useEffect, useMemo, useRef } from "react";
import type { CommitDraft } from "@reviewer/core/git-message";
import type { GitStatusEntry } from "@reviewer/core/repo";
import type {
  FileActionsFunctions,
  TreeItem,
} from "@/interactions/file-actions/interfaces/file-actions.interfaces";
import type { AppMode } from "@/lib/api/types";
import {
  island,
  shell,
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
  readonly loading: boolean;
  readonly projectPath: string | null;
  readonly onFileSelect: (path: string | null) => void;
  readonly onShowHistory: (path: string) => void;
  readonly onDiscardPaths?: (paths: ReadonlyArray<string>) => void;
  /** Already confirmed by the shell; the rows go straight to the trash. */
  readonly onTrashPaths?: (items: ReadonlyArray<TreeItem>) => Promise<void>;
  readonly onRenamePath?: (from: string, to: string) => Promise<void>;
  readonly actions?: FileActionsFunctions;
  readonly commit?: ShellCommitSource;
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

const act = (source: ShellTreeSource, action: ShellTreeAction): void => {
  switch (action.kind) {
    case "select":
      return source.onFileSelect(action.path);
    case "history":
      return source.onShowHistory(action.path);
    case "discard":
      return source.onDiscardPaths?.(action.paths);
    case "delete":
      return void source.onTrashPaths?.(action.items);
    case "rename":
      return void source.onRenamePath?.(action.from, action.to);
    case "create":
      return void source.actions?.create(action.path, action.entry);
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

  // The handlers are remade every render; the picture only follows the data.
  const mode = source?.mode ?? null;
  const paths = source?.paths ?? null;
  const gitStatus = source?.gitStatus ?? null;
  const selected = source?.selectedFile ?? null;
  const loading = source?.loading ?? false;
  const projectPath = source?.projectPath ?? null;
  const editable = source?.actions !== undefined;
  const discardable = source?.onDiscardPaths !== undefined;
  const changes = source?.commit?.changes ?? null;
  const draft = source?.commit?.draft ?? null;
  const listing = useMemo<ShellTree | null>(
    () =>
      shellDrawsTree && mode !== null && paths !== null && gitStatus !== null
        ? {
            mode,
            paths,
            gitStatus,
            loading,
            projectPath,
            editable,
            discardable,
          }
        : null,
    [mode, paths, gitStatus, loading, projectPath, editable, discardable]
  );
  useEffect(() => {
    if (!shellDrawsTree) return;
    void shell.post({ type: "tree", tree: listing });
  }, [listing]);
  const state = useMemo<ShellTreeState>(
    () => ({
      selected,
      commit: changes === null ? null : { changes, draft },
    }),
    [selected, changes, draft]
  );
  useEffect(() => {
    if (!shellDrawsTree || listing === null) return;
    void shell.post({ type: "treeState", state });
  }, [listing, state]);
  useEffect(() => {
    if (!shellDrawsTree) return;
    return () => void shell.post({ type: "tree", tree: null });
  }, []);

  useEffect(() => {
    if (!shellDrawsTree) return;
    return shell.subscribe((event) => {
      if (event.type !== "tree" || latest.current === null) return;
      act(latest.current, event.action);
    });
  }, []);
}
