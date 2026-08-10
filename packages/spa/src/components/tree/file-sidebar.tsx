import { FileTree, useFileTree } from "@pierre/trees/react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { LoadingCursor } from "@/components/ui/loading-cursor";
import {
  draftPath,
  targetDirectory,
  withoutTrailingSlash,
} from "@/interactions/file-actions/functions/file-actions.functions";
import type {
  PathKind,
  TreeItem,
} from "@/interactions/file-actions/interfaces/file-actions.interfaces";
import type { AppMode } from "@/lib/api/types";
import type { GitStatusEntry } from "@byconvo/core/repo";

interface FileSidebarProps {
  mode: AppMode;
  paths: ReadonlyArray<string>;
  gitStatus: ReadonlyArray<GitStatusEntry>;
  selectedFile: string | null;
  onFileSelect: (path: string | null) => void;
  onDeletePath?: (path: string, isDirectory: boolean) => Promise<void> | void;
  onRenamePath?: (from: string, to: string) => Promise<void>;
  onCreatePath?: (path: string, kind: PathKind) => Promise<void>;
  /** Open the bottom dock on this path's commit history. */
  onShowHistory?: (path: string) => void;
  onError?: (message: string) => void;
  loading?: boolean;
  footer?: ReactNode;
}

// Inset each row's hover/selection background vertically so a highlighted row
// reads as a separate rounded pill instead of colliding edge-to-edge with the
// pill above/below it. The tree is virtualized with a fixed row height, so we
// can't add real spacing between rows (it would desync scroll math); instead we
// keep the row exactly `--trees-row-height` tall (box-sizing: border-box) and
// carve the gap out of it with a transparent block border, clipping the
// background to the padding box so it doesn't paint under that border.
// Injected into the tree's shadow root via the `@layer unsafe` override layer.
const TREE_UNSAFE_CSS = `
  [data-type='item'] {
    box-sizing: border-box;
    border-block: 2px solid transparent;
    background-clip: padding-box;
  }
`;

/**
 * Directory prefixes that must be expanded for `filePath` to be visible, e.g.
 * `"a/b/c.ts"` → `["a", "a/b"]`. Used to reveal a file in an otherwise
 * collapsed tree (both up-front via `initialExpandedPaths` and imperatively).
 */
function ancestorDirs(filePath: string): ReadonlyArray<string> {
  const segments = filePath.split("/");
  segments.pop();
  const dirs: string[] = [];
  let prefix = "";
  for (const segment of segments) {
    prefix = prefix === "" ? segment : `${prefix}/${segment}`;
    dirs.push(prefix);
  }
  return dirs;
}

export function FileSidebar({
  mode,
  paths,
  gitStatus,
  selectedFile,
  onFileSelect,
  onDeletePath,
  onRenamePath,
  onCreatePath,
  onShowHistory,
  onError,
  loading = false,
  footer,
}: FileSidebarProps) {
  const onFileSelectRef = useRef(onFileSelect);
  onFileSelectRef.current = onFileSelect;
  const onRenamePathRef = useRef(onRenamePath);
  onRenamePathRef.current = onRenamePath;
  const onCreatePathRef = useRef(onCreatePath);
  onCreatePathRef.current = onCreatePath;
  // The row a "New file/folder" is being named in, as the rename event spells
  // it. It is an ordinary tree row until the name is committed, so the rename
  // handler recognises it here and routes it to creation instead.
  const draftRef = useRef<string | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const pathsRef = useRef(paths);
  pathsRef.current = paths;
  const selectedFileRef = useRef(selectedFile);
  selectedFileRef.current = selectedFile;
  // Set while we sync the tree's selection to `selectedFile`, so the resulting
  // selection-change events don't loop back through `onFileSelect`.
  const syncingSelectionRef = useRef(false);

  const { model } = useFileTree({
    paths: [...paths],
    // Browse shows the whole project, so it starts collapsed and reveals the open
    // file by expanding just its ancestors (see the reveal effect below). The
    // commit/review modes show a small changed-file set, so they start expanded.
    // `mode` is read once here, so AppShell remounts this tree per mode.
    initialExpansion: mode === "browse" ? "closed" : "open",
    initialExpandedPaths:
      selectedFile !== null ? [...ancestorDirs(selectedFile)] : undefined,
    initialSelectedPaths: selectedFile !== null ? [selectedFile] : undefined,
    flattenEmptyDirectories: true,
    search: true,
    unsafeCSS: TREE_UNSAFE_CSS,
    gitStatus: [...gitStatus],
    onSelectionChange: (selectedPaths) => {
      if (syncingSelectionRef.current) return;
      const first = selectedPaths.at(0);
      if (first !== undefined) {
        const item = modelRef.current?.getItem(first);
        if (item != null && !item.isDirectory()) onFileSelectRef.current(first);
      }
    },
    renaming: {
      canRename: () =>
        onRenamePathRef.current !== undefined ||
        onCreatePathRef.current !== undefined,
      onError: (message) => onErrorRef.current?.(message),
      onRename: ({ destinationPath, isFolder, sourcePath }) => {
        const revert = () =>
          modelRef.current?.resetPaths([...pathsRef.current]);
        if (draftRef.current === sourcePath) {
          draftRef.current = null;
          const create = onCreatePathRef.current;
          if (create === undefined) return revert();
          void create(destinationPath, isFolder ? "directory" : "file").catch(
            revert
          );
          return;
        }
        const handler = onRenamePathRef.current;
        if (handler === undefined) return revert();
        if (destinationPath === sourcePath) return;
        void handler(sourcePath, destinationPath).catch(revert);
      },
    },
  });

  const modelRef = useRef(model);
  modelRef.current = model;

  // Reveal `path` in the tree: expand its ancestor directories, select just that
  // row (so it is visibly highlighted), and scroll to it. `focus` moves keyboard
  // focus too — reserved for explicit navigation so background refreshes don't
  // yank focus. Returns false when the path isn't in the current tree yet.
  const prevRevealedRef = useRef<string | null>(null);
  const revealFile = (path: string, focus: boolean): boolean => {
    const target = model.getItem(path);
    if (target == null) return false;
    for (const dir of ancestorDirs(path)) {
      const item = model.getItem(dir);
      if (item != null && "expand" in item && !item.isExpanded()) item.expand();
    }
    const current = model.getSelectedPaths();
    if (!(current.length === 1 && current[0] === path)) {
      // Selection-change events fire synchronously here; suppress the loop back
      // into `onFileSelect` while we replace the selection with just this file.
      syncingSelectionRef.current = true;
      for (const p of current) model.getItem(p)?.deselect();
      target.select();
      syncingSelectionRef.current = false;
    }
    model.scrollToPath(path, { focus, offset: "center" });
    return true;
  };

  const pathsKey = paths.join("\n");
  useEffect(() => {
    // Rebuilding collapses the tree; seed the open file's ancestors as expanded
    // so it doesn't flash closed. Selection/scroll/focus is re-applied by the
    // reveal effect below (which also depends on `pathsKey`).
    const open = selectedFileRef.current;
    model.resetPaths(
      [...paths],
      open !== null
        ? { initialExpandedPaths: [...ancestorDirs(open)] }
        : undefined
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathsKey, model]);

  const statusKey = gitStatus.map((e) => `${e.path}:${e.status}`).join("\n");
  useEffect(() => {
    model.setGitStatus([...gitStatus]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusKey, pathsKey, model]);

  // Reveal the open file whenever it changes, and re-apply after the tree is
  // rebuilt (`pathsKey`) — e.g. on initial load the file is set before its paths
  // arrive. Focus only when the file actually changed, so a background refresh
  // re-highlights without stealing keyboard focus.
  useEffect(() => {
    if (selectedFile === null) {
      prevRevealedRef.current = null;
      return;
    }
    if (revealFile(selectedFile, prevRevealedRef.current !== selectedFile)) {
      prevRevealedRef.current = selectedFile;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile, pathsKey, model]);

  // Draw the new entry as a row and let the user name it in place; the rename
  // that commits it is routed to `onCreatePath` by the handler above.
  const startCreate = (item: TreeItem, kind: PathKind) => {
    const row = draftPath(
      targetDirectory(item),
      kind,
      (candidate) => modelRef.current?.getItem(candidate) != null
    );
    draftRef.current = withoutTrailingSlash(row);
    modelRef.current?.add(row);
    modelRef.current?.startRenaming(row, { removeIfCanceled: true });
  };

  const hasMenu =
    onCreatePath !== undefined ||
    onDeletePath !== undefined ||
    onRenamePath !== undefined ||
    onShowHistory !== undefined;
  const renderContextMenu = hasMenu
    ? (
        item: TreeItem,
        context: { close: (options?: { restoreFocus?: boolean }) => void }
      ) => (
        <div
          role="menu"
          className="min-w-36 rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md"
        >
          {onCreatePath !== undefined && (
            <>
              {(["file", "directory"] as const).map((kind) => (
                <button
                  key={kind}
                  role="menuitem"
                  className="flex w-full items-center rounded-sm px-2 py-1 text-left hover:bg-muted"
                  onClick={() => {
                    context.close({ restoreFocus: false });
                    startCreate(item, kind);
                  }}
                >
                  {kind === "file" ? "New file…" : "New folder…"}
                </button>
              ))}
              <div role="separator" className="my-1 h-px bg-border" />
            </>
          )}
          {onShowHistory !== undefined && (
            <button
              role="menuitem"
              className="flex w-full items-center rounded-sm px-2 py-1 text-left hover:bg-muted"
              onClick={() => {
                context.close();
                onShowHistory(item.path);
              }}
            >
              Show history
            </button>
          )}
          {onRenamePath !== undefined && (
            <button
              role="menuitem"
              className="flex w-full items-center rounded-sm px-2 py-1 text-left hover:bg-muted"
              onClick={() => {
                context.close({ restoreFocus: false });
                modelRef.current?.startRenaming(item.path);
              }}
            >
              Rename…
            </button>
          )}
          {onDeletePath !== undefined && (
            <button
              role="menuitem"
              className="flex w-full items-center rounded-sm px-2 py-1 text-left text-destructive hover:bg-muted"
              onClick={() => {
                context.close();
                void onDeletePath(item.path, item.kind === "directory");
              }}
            >
              Delete
            </button>
          )}
        </div>
      )
    : undefined;

  return (
    <aside className="flex h-full flex-col">
      <div className="-mx-2 mt-2 min-h-0 flex-1 overflow-auto">
        {loading ? (
          <div className="px-3 py-2">
            <LoadingCursor label="Loading files…" />
          </div>
        ) : (
          <FileTree
            model={model}
            renderContextMenu={renderContextMenu}
            style={{ height: "100%" }}
          />
        )}
      </div>
      {footer}
    </aside>
  );
}
