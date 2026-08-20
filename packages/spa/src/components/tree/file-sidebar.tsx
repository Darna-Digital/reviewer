import {
  IconClipboard,
  IconClipboardCopy,
  IconClipboardText,
  IconCopy,
  IconCopyPlus,
  IconCursorText,
  IconCut,
  IconFilePlus,
  IconFolderPlus,
  IconFolderSearch,
  IconHistory,
  IconTrash,
} from "@tabler/icons-react";
import { FileTree, useFileTree } from "@pierre/trees/react";
import type {
  ComponentType,
  DragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LoadingCursor } from "@/components/ui/loading-cursor";
import { droppedFiles } from "@/interactions/file-actions/adapters/dropped-files.adapter";
import {
  draftPath,
  dropDirectory,
  targetDirectory,
  withoutTrailingSlash,
} from "@/interactions/file-actions/functions/file-actions.functions";
import type {
  Clipboard,
  FileActionsFunctions,
  PathKind,
  TreeItem,
} from "@/interactions/file-actions/interfaces/file-actions.interfaces";
import type { AppMode } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import type { GitStatusEntry } from "@byconvo/core/repo";

interface FileSidebarProps {
  mode: AppMode;
  paths: ReadonlyArray<string>;
  gitStatus: ReadonlyArray<GitStatusEntry>;
  selectedFile: string | null;
  onFileSelect: (path: string | null) => void;
  /**
   * Everything the tree can do to the project's own files. Left out for a
   * review, whose tree lists a pull request rather than the working copy.
   */
  actions?: FileActionsFunctions;
  /** Confirm and delete; the rows go to the project's trash, so ⌘Z has them. */
  onDeletePaths?: (items: ReadonlyArray<TreeItem>) => Promise<void> | void;
  onRenamePath?: (from: string, to: string) => Promise<void>;
  /** Open the bottom dock on this path's commit history. */
  onShowHistory?: (path: string) => void;
  onError?: (message: string) => void;
  /** The open project folder, for the absolute path the menu copies. */
  projectPath?: string | null;
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

// Walked with the arrows as much as with the pointer, so the row the keyboard
// is on reads exactly like the row the pointer is on.
const CONTEXT_MENU_ITEM =
  "flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left outline-none hover:bg-elevate focus:bg-elevate disabled:opacity-40 disabled:hover:bg-transparent";

/** A menu row's icon: the component itself, mounted by the row that takes it. */
type MenuIcon = ComponentType<{ className?: string }>;

const REVEAL_LABEL =
  typeof navigator !== "undefined" && navigator.userAgent.includes("Mac")
    ? "Reveal in Finder"
    : "Show in folder";

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

/** The tree row a pointer event landed on, reached through the shadow root. */
function rowUnder(event: DragEvent): HTMLElement | null {
  for (const node of event.nativeEvent.composedPath()) {
    if (node instanceof HTMLElement && node.dataset.type === "item")
      return node;
  }
  return null;
}

/** The menu rows that can be chosen right now — a disabled Paste is skipped. */
const menuItems = (menu: HTMLElement) => [
  ...menu.querySelectorAll<HTMLButtonElement>(
    "[role='menuitem']:not(:disabled)"
  ),
];

/** The arrows walk the rows and wrap at both ends; Enter is the button's own. */
function walkMenu(event: KeyboardEvent) {
  const items = menuItems(event.currentTarget as HTMLElement);
  if (items.length === 0) return;
  const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
  if (step !== 0) {
    event.preventDefault();
    // -1 stepped back lands on the last row, which is where Up from a menu
    // nothing is focused in ought to go.
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(at + step + items.length) % items.length]?.focus();
    return;
  }
  if (event.key === "Home" || event.key === "End") {
    event.preventDefault();
    (event.key === "Home" ? items.at(0) : items.at(-1))?.focus();
  }
}

/**
 * An open menu is the keyboard's, not just the pointer's: the first row takes
 * focus as it opens, and the arrows walk on from there. The listener is bound
 * to the element rather than handed over as a prop because the tree stops keys
 * inside its slotted menu from travelling any further, and React's own listener
 * sits at the root of the page, where they never arrive. Escape belongs to the
 * tree, which closes the menu on it.
 */
const openedMenu = (menu: HTMLElement | null) => {
  if (menu === null) return;
  menuItems(menu).at(0)?.focus();
  menu.addEventListener("keydown", walkMenu);
  return () => menu.removeEventListener("keydown", walkMenu);
};

const rowItem = (row: HTMLElement): TreeItem => ({
  kind: row.dataset.itemType === "folder" ? "directory" : "file",
  path: row.dataset.itemPath ?? "",
});

export function FileSidebar({
  mode,
  paths,
  gitStatus,
  selectedFile,
  onFileSelect,
  actions,
  onDeletePaths,
  onRenamePath,
  onShowHistory,
  onError,
  projectPath,
  loading = false,
  footer,
}: FileSidebarProps) {
  const onFileSelectRef = useRef(onFileSelect);
  onFileSelectRef.current = onFileSelect;
  const onRenamePathRef = useRef(onRenamePath);
  onRenamePathRef.current = onRenamePath;
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
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
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);
  const [dropping, setDropping] = useState(false);
  // The menu is drawn inside the tree's shadow root, which stacks wherever the
  // host does — under the sidebar's resize seam, which lifts itself over the
  // panels it divides. Lifting the tree higher while a menu is open puts the
  // menu over the seam without leaving the tree over it the rest of the time,
  // where it would take the pointer off the few pixels the seam overlaps.
  const [menuOpen, setMenuOpen] = useState(false);

  // Copied for the tree, which wants mutable arrays — but copied once per new
  // listing rather than once per render, for the same reason as the keys below.
  const treePaths = useMemo(() => [...paths], [paths]);
  const treeGitStatus = useMemo(() => [...gitStatus], [gitStatus]);

  // A folder is `src/` in the tree and `src` everywhere else, and a row is only
  // "already there" if either spelling of it is.
  const treeHolds = (path: string) =>
    modelRef.current?.getItem(path) != null ||
    modelRef.current?.getItem(`${path}/`) != null;

  const { model } = useFileTree({
    paths: treePaths,
    // Browse shows the whole project, so it starts collapsed and reveals the open
    // file by expanding just its ancestors (see the reveal effect below). The
    // commit/review modes show a small changed-file set, so they start expanded.
    // `mode` is read once here, so AppShell remounts this tree per mode.
    initialExpansion: mode === "browse" ? "closed" : "open",
    initialExpandedPaths:
      selectedFile !== null ? [...ancestorDirs(selectedFile)] : undefined,
    initialSelectedPaths: selectedFile !== null ? [selectedFile] : undefined,
    flattenEmptyDirectories: true,
    search: mode !== "browse",
    unsafeCSS: TREE_UNSAFE_CSS,
    gitStatus: treeGitStatus,
    composition: {
      contextMenu: {
        onOpen: () => setMenuOpen(true),
        onClose: () => setMenuOpen(false),
      },
    },
    onSelectionChange: (selectedPaths) => {
      if (syncingSelectionRef.current) return;
      const first = selectedPaths.at(0);
      if (first !== undefined) {
        const item = modelRef.current?.getItem(first);
        if (item != null && !item.isDirectory()) onFileSelectRef.current(first);
      }
    },
    // The tree rearranges its own rows the moment a drag lands, so the move is
    // already on screen while the server is still hearing about it; a refusal
    // puts the listing back.
    dragAndDrop:
      actions === undefined
        ? false
        : {
            onDropComplete: ({ draggedPaths, target }) => {
              void actionsRef.current
                ?.move(draggedPaths, dropDirectory(target))
                .catch(() =>
                  modelRef.current?.resetPaths([...pathsRef.current])
                );
            },
            onDropError: (message) => onErrorRef.current?.(message),
          },
    renaming: {
      canRename: () =>
        onRenamePathRef.current !== undefined ||
        actionsRef.current !== undefined,
      onError: (message) => onErrorRef.current?.(message),
      onRename: ({ destinationPath, isFolder, sourcePath }) => {
        const revert = () =>
          modelRef.current?.resetPaths([...pathsRef.current]);
        if (draftRef.current === sourcePath) {
          draftRef.current = null;
          const create = actionsRef.current?.create;
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

  // Both keys are folds over the whole repository — every tracked path, every
  // changed file — and they were being rebuilt on every render of this
  // component, which is every render of the shell above it. Opening a menu or
  // dragging a panel handle was enough to join fifty thousand strings. They
  // change only when their input array is replaced, which is what the memo says.
  const pathsKey = useMemo(() => paths.join("\n"), [paths]);
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

  const statusKey = useMemo(
    () => gitStatus.map((e) => `${e.path}:${e.status}`).join("\n"),
    [gitStatus]
  );
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
  // that commits it is routed to `create` by the handler above.
  const startCreate = (item: TreeItem, kind: PathKind) => {
    const row = draftPath(targetDirectory(item), kind, treeHolds);
    draftRef.current = withoutTrailingSlash(row);
    modelRef.current?.add(row);
    modelRef.current?.startRenaming(row, { removeIfCanceled: true });
  };

  /** The rows a keyboard action works on: the selection, or the focused row. */
  const activeItems = (): ReadonlyArray<TreeItem> => {
    const selected = model.getSelectedPaths();
    const focused = model.getFocusedPath();
    const rows =
      selected.length > 0 ? selected : focused === null ? [] : [focused];
    return rows.map((path) => ({
      kind: model.getItem(path)?.isDirectory() === true ? "directory" : "file",
      path,
    }));
  };

  const copyToClipboard = (text: string) =>
    void navigator.clipboard.writeText(text);

  const absolutePath = (path: string) =>
    projectPath == null || projectPath === ""
      ? path
      : `${projectPath}/${withoutTrailingSlash(path)}`;

  const pasteInto = (item: TreeItem) => {
    if (clipboard === null) return;
    void actionsRef.current?.paste(clipboard, targetDirectory(item), treeHolds);
    if (clipboard.mode === "cut") setClipboard(null);
  };

  // The tree drives the arrows, Enter and F2 itself; these are the rest of what
  // a file tree is expected to answer to.
  const onKeyDown = (event: ReactKeyboardEvent) => {
    const chord = event.metaKey || event.ctrlKey;
    // Shift turns the key itself uppercase, and ⇧⌘Z is how redo is spelled.
    const key = event.key.toLowerCase();
    if (chord && key === "z" && actions !== undefined) {
      event.preventDefault();
      void (event.shiftKey ? actions.redo() : actions.undo());
      return;
    }
    const items = activeItems();
    const first = items.at(0);
    if (first === undefined) return;
    if (!chord && (key === "delete" || key === "backspace")) {
      event.preventDefault();
      void onDeletePaths?.(items);
      return;
    }
    if (!chord || actions === undefined) return;
    if (key === "c" || key === "x") {
      event.preventDefault();
      setClipboard({
        mode: key === "c" ? "copy" : "cut",
        paths: items.map((item) => item.path),
      });
      return;
    }
    if (key === "v") {
      event.preventDefault();
      pasteInto(first);
    }
  };

  const carriesFiles = (event: DragEvent) =>
    event.dataTransfer.types.includes("Files");

  // The tree paints its own drop target only for rows it is dragging itself, so
  // a drop from the desktop marks the row the same way by hand.
  const highlightRef = useRef<HTMLElement | null>(null);
  const highlight = (row: HTMLElement | null) => {
    if (highlightRef.current === row) return;
    highlightRef.current?.removeAttribute("data-item-drag-target");
    row?.setAttribute("data-item-drag-target", "true");
    highlightRef.current = row;
  };

  const onDragOver = (event: DragEvent) => {
    if (actions === undefined || !carriesFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    highlight(rowUnder(event));
    setDropping(true);
  };

  const onDragLeave = (event: DragEvent) => {
    const leaving = event.relatedTarget;
    if (leaving instanceof Node && event.currentTarget.contains(leaving))
      return;
    highlight(null);
    setDropping(false);
  };

  const onDrop = (event: DragEvent) => {
    if (actions === undefined || !carriesFiles(event)) return;
    event.preventDefault();
    const row = rowUnder(event);
    const directory = row === null ? "" : targetDirectory(rowItem(row));
    highlight(null);
    setDropping(false);
    // Read before yielding: the browser empties the transfer once this returns.
    const files = droppedFiles(event.dataTransfer);
    void files.then((dropped) =>
      actionsRef.current?.upload(dropped, directory, treeHolds)
    );
  };

  const hasMenu =
    actions !== undefined ||
    onDeletePaths !== undefined ||
    onRenamePath !== undefined ||
    onShowHistory !== undefined;
  const renderContextMenu = hasMenu
    ? (
        item: TreeItem,
        context: { close: (options?: { restoreFocus?: boolean }) => void }
      ) => {
        // Closing restores focus to the row, which would take it straight back
        // off an input the action is about to open — so those say not to.
        const entry = (
          Icon: MenuIcon,
          label: string,
          run: () => void,
          options?: { readonly focusMoves?: boolean; readonly off?: boolean }
        ) => (
          <button
            key={label}
            role="menuitem"
            disabled={options?.off === true}
            className={cn(
              CONTEXT_MENU_ITEM,
              label === "Delete" && "text-destructive"
            )}
            onClick={() => {
              context.close(
                options?.focusMoves === true
                  ? { restoreFocus: false }
                  : undefined
              );
              run();
            }}
          >
            <Icon className="size-3.5 shrink-0 opacity-70" />
            {label}
          </button>
        );
        const separator = (key: string) => (
          <div key={key} role="separator" className="my-1 h-px bg-border" />
        );
        return (
          <div
            // Re-keyed per row, so opening the menu on another row while it is
            // already up mounts a fresh one — and the first entry takes focus
            // again, rather than leaving it on the row the last menu was for.
            key={item.path}
            role="menu"
            ref={openedMenu}
            className="min-w-48 rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md"
          >
            {actions !== undefined && [
              entry(
                IconFilePlus,
                "New file…",
                () => startCreate(item, "file"),
                { focusMoves: true }
              ),
              entry(
                IconFolderPlus,
                "New folder…",
                () => startCreate(item, "directory"),
                { focusMoves: true }
              ),
              separator("new"),
              entry(IconCut, "Cut", () =>
                setClipboard({ mode: "cut", paths: [item.path] })
              ),
              entry(IconCopy, "Copy", () =>
                setClipboard({ mode: "copy", paths: [item.path] })
              ),
              entry(IconClipboard, "Paste", () => pasteInto(item), {
                off: clipboard === null,
              }),
              entry(
                IconCopyPlus,
                "Duplicate",
                () => void actions.duplicate(item.path, treeHolds)
              ),
              separator("clipboard"),
              entry(IconClipboardCopy, "Copy path", () =>
                copyToClipboard(absolutePath(item.path))
              ),
              entry(IconClipboardText, "Copy relative path", () =>
                copyToClipboard(withoutTrailingSlash(item.path))
              ),
              entry(
                IconFolderSearch,
                REVEAL_LABEL,
                () => void actions.reveal(item.path)
              ),
            ]}
            {onShowHistory !== undefined &&
              entry(IconHistory, "Show history", () =>
                onShowHistory(item.path)
              )}
            {(onRenamePath !== undefined || onDeletePaths !== undefined) &&
              separator("edit")}
            {onRenamePath !== undefined &&
              entry(
                IconCursorText,
                "Rename…",
                () => void modelRef.current?.startRenaming(item.path),
                { focusMoves: true }
              )}
            {onDeletePaths !== undefined &&
              entry(IconTrash, "Delete", () => void onDeletePaths([item]))}
          </div>
        );
      }
    : undefined;

  return (
    <aside className="flex h-full flex-col">
      <div
        className={cn(
          "-mx-2 mt-2 min-h-0 flex-1 overflow-auto",
          menuOpen && "relative z-20",
          dropping && "rounded-md ring-1 ring-ring ring-inset"
        )}
        onKeyDown={onKeyDown}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
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
