import {
  IconArrowBackUp,
  IconClipboard,
  IconClipboardCopy,
  IconClipboardText,
  IconCopy,
  IconCopyPlus,
  IconCursorText,
  IconCut,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NewEntryChoice } from "@/components/tree/new-entry-submenu";
import {
  NewEntrySubmenu,
  SUBMENU_CLOSE_EVENT,
  SUBMENU_OPEN_EVENT,
  TREE_MENU_ITEM,
  TREE_MENU_PANEL,
} from "@/components/tree/new-entry-submenu";
import { confirm } from "@/components/ui/alerts";
import { LoadingCursor } from "@/components/ui/loading-cursor";
import { droppedFiles } from "@/interactions/file-actions/adapters/dropped-files.adapter";
import {
  draftPath,
  dropDirectory,
  targetDirectory,
  withoutTrailingSlash,
  withTemplateExtension,
} from "@/interactions/file-actions/functions/file-actions.functions";
import type {
  Clipboard,
  FileActionsFunctions,
  TreeItem,
} from "@/interactions/file-actions/interfaces/file-actions.interfaces";
import type { AppMode } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import type { GitStatusEntry } from "@reviewer/core/repo";

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
  /**
   * Revert the given paths' working-tree changes. Only wired where the tree
   * lists the working copy's own changes; absent means no discard row. The
   * menu confirms before calling, and a folder arrives already spread into the
   * changed files under it.
   */
  onDiscardPaths?: (paths: ReadonlyArray<string>) => void;
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
    border-block: 1px solid transparent;
    background-clip: padding-box;
  }
`;

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

/**
 * The menu rows that can be chosen right now — a disabled Paste is skipped,
 * and so are the rows of any other panel: the "New" flyout is a `role="menu"`
 * of its own nested in the top-level one, and the arrows walk one at a time.
 */
const menuItems = (panel: HTMLElement) =>
  [
    ...panel.querySelectorAll<HTMLButtonElement>(
      "[role='menuitem']:not(:disabled)"
    ),
  ].filter((item) => item.closest("[role='menu']") === panel);

/** The panel the keyboard is in: the flyout when focus is there, else `menu`. */
const activePanel = (menu: HTMLElement): HTMLElement => {
  const active = document.activeElement;
  const panel =
    active instanceof HTMLElement
      ? active.closest<HTMLElement>("[role='menu']")
      : null;
  return panel !== null && menu.contains(panel) ? panel : menu;
};

/**
 * The keys an open menu answers to. It does not take the keyboard as it opens —
 * the row keeps focus until Down reaches for the menu, and only from there do
 * the arrows walk the entries and wrap at both ends. Bound to the document
 * because until focus is in the menu the keys are still the tree's, and bound
 * in the capture phase so the arrow that reaches for the menu does not move the
 * row behind it on its way. Escape belongs to the tree, which closes the menu;
 * Left and Right belong to the "New" entry, which opens and closes its flyout.
 */
const menuKeys = (menu: HTMLElement) => (event: KeyboardEvent) => {
  const panel = activePanel(menu);
  const items = menuItems(panel);
  if (items.length === 0) return;
  const inside = panel.contains(document.activeElement);
  // The submenu cannot hear the arrows itself — the tree swallows them while
  // its menu is up — so from here they become events its component listens for.
  if (event.key === "ArrowRight" && panel === menu) {
    const active = document.activeElement;
    if (
      active instanceof HTMLElement &&
      menu.contains(active) &&
      active.getAttribute("aria-haspopup") === "menu"
    ) {
      event.preventDefault();
      event.stopPropagation();
      active.dispatchEvent(new CustomEvent(SUBMENU_OPEN_EVENT));
    }
    return;
  }
  if (event.key === "ArrowLeft" && panel !== menu) {
    event.preventDefault();
    event.stopPropagation();
    panel.dispatchEvent(new CustomEvent(SUBMENU_CLOSE_EVENT));
    return;
  }
  const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
  if (step !== 0) {
    event.preventDefault();
    event.stopPropagation();
    if (!inside) {
      (step === 1 ? items.at(0) : items.at(-1))?.focus();
      return;
    }
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    items[(at + step + items.length) % items.length]?.focus();
    return;
  }
  if (inside && (event.key === "Home" || event.key === "End")) {
    event.preventDefault();
    event.stopPropagation();
    (event.key === "Home" ? items.at(0) : items.at(-1))?.focus();
  }
};

const openedMenu = (menu: HTMLElement | null) => {
  if (menu === null) return;
  const onKeyDown = menuKeys(menu);
  document.addEventListener("keydown", onKeyDown, true);
  return () => document.removeEventListener("keydown", onKeyDown, true);
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
  onDiscardPaths,
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
  // The row a "New …" entry is being named in. It is an ordinary tree row
  // until the name is committed, so the rename handler recognises it here and
  // routes it to creation instead — `path` as the rename event spells it,
  // `row` as the tree does, and the extension a typed template stamps on.
  const draftRef = useRef<{
    readonly path: string;
    readonly row: string;
    readonly extension: string | null;
  } | null>(null);
  // Set when the listing changes under an open draft: resetting the tree then
  // would take the row — and the half-typed name in it — down with it, so the
  // reset waits until the draft is committed or let go.
  const pendingResetRef = useRef(false);
  // Rebuilding the tree is the only way to take a new listing, and a rebuilt
  // tree starts from `initialExpansion` — "closed", in browse mode. Every
  // folder the user had opened would therefore snap shut on the first refresh
  // after it, which is every create, rename, delete and git refresh. So how
  // each folder was left is kept here and handed to the tree that replaces it:
  // true where it was open, false where it was closed, and absent for one
  // never seen either way. Declared this high because the reset it feeds
  // happens from four places, the earliest of them above the model itself.
  const foldsRef = useRef<Map<string, boolean>>(new Map());
  const resetPathsRef = useRef<() => void>(() => {});
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
  // What the server has confirmed, for telling real rows from optimistic ones.
  const knownPaths = useMemo(() => new Set(paths), [paths]);
  const knownPathsRef = useRef(knownPaths);
  knownPathsRef.current = knownPaths;

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
      if (first === undefined) return;
      const item = modelRef.current?.getItem(first);
      if (item == null || item.isDirectory()) return;
      // A row the server hasn't confirmed — a draft being named, a create or
      // move still in flight — has no file behind it to open yet. Starting a
      // draft selects its row, which was navigating the viewer to a path that
      // doesn't exist; a created file is opened by the create flow instead.
      if (!knownPathsRef.current.has(first)) return;
      onFileSelectRef.current(first);
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
                .catch(() => resetPathsRef.current());
            },
            onDropError: (message) => onErrorRef.current?.(message),
          },
    renaming: {
      canRename: () =>
        onRenamePathRef.current !== undefined ||
        actionsRef.current !== undefined,
      onError: (message) => {
        // A draft that failed to commit — the name is taken, or holds a "/" —
        // would be left behind as a blank ghost row: the tree closes the
        // rename but keeps the row. Reopen the input instead, so the user is
        // still where JetBrains would leave them: naming the file.
        const draft = draftRef.current;
        if (draft !== null) {
          // After the commit that raised the error has fully unwound.
          queueMicrotask(() => {
            if (draftRef.current !== draft) return;
            modelRef.current?.startRenaming(draft.row, {
              removeIfCanceled: true,
            });
          });
        }
        onErrorRef.current?.(message);
      },
      onRename: ({ destinationPath, isFolder, sourcePath }) => {
        const revert = () => resetPathsRef.current();
        const draft = draftRef.current;
        if (draft !== null && draft.path === sourcePath) {
          const target = withTemplateExtension(
            destinationPath,
            draft.extension
          );
          // The tree validated the typed name, but the stamped one is what the
          // file will really be called — a collision it lands on comes out
          // here, before a doomed round-trip, with the naming still open.
          if (target !== destinationPath && treeHolds(target)) {
            queueMicrotask(() => {
              if (draftRef.current !== draft) return;
              modelRef.current?.move(destinationPath, draft.row);
              modelRef.current?.startRenaming(draft.row, {
                removeIfCanceled: true,
              });
            });
            onErrorRef.current?.(`"${target}" already exists.`);
            return;
          }
          draftRef.current = null;
          // A listing change held back during naming is settled by what comes
          // next either way: success refreshes the listing, failure reverts.
          pendingResetRef.current = false;
          const create = actionsRef.current?.create;
          if (create === undefined) return revert();
          // The tree is about to move the draft row to the typed name; when a
          // template stamps its extension on, move the row once more to match
          // the file being created — after that first move has landed.
          if (target !== destinationPath) {
            queueMicrotask(() =>
              modelRef.current?.move(destinationPath, target)
            );
          }
          void create(target, isFolder ? "directory" : "file").catch(revert);
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

  /**
   * Take note of how each folder is folded, so the next rebuild can restore it.
   *
   * Only the rows on screen can be asked — a folder inside one that has since
   * been closed keeps whatever it was last seen as, which is exactly what it
   * should unfold to when its parent opens again. A flattened row stands for
   * every segment it spells (`pkg/a/b` is `pkg`, `pkg/a` and `pkg/a/b`), so
   * they are all recorded together: the rebuilt tree may not flatten the same
   * way once a file lands in one of them.
   */
  const rememberFolds = useCallback(() => {
    const tree = modelRef.current;
    if (tree == null) return;
    const folds = foldsRef.current;
    for (const row of tree.getVisibleRows(0, tree.getVisibleCount())) {
      if (row.kind !== "directory") continue;
      const segments = row.flattenedSegments ?? [];
      for (const path of [
        row.path,
        ...segments.map((segment) => segment.path),
      ]) {
        folds.set(withoutTrailingSlash(path), row.isExpanded);
      }
    }
  }, []);

  // Noting them only as the tree is about to be rebuilt would be too late: a
  // folder left open inside one that was then closed is off screen by the time
  // the rebuild comes, and would never have been seen open at all. So the tree
  // is read whenever it changes — coalesced to one pass a frame, since it also
  // announces every selection and focus move.
  useEffect(() => {
    let frame: number | null = null;
    const unsubscribe = model.subscribe(() => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        rememberFolds();
      });
    });
    return () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      unsubscribe();
    };
  }, [model, rememberFolds]);

  // Rebuilding collapses the tree; hand it back the folders that were open,
  // plus the open file's ancestors so it doesn't flash closed. Selection,
  // scroll and focus are re-applied by the reveal effect below (which also
  // depends on `pathsKey`).
  const resetTreePaths = useCallback(() => {
    rememberFolds();
    const folds = foldsRef.current;
    // Seeding a folder open opens the whole chain down to it, so one left open
    // inside a folder that was then closed must not be named — that would
    // reopen the parent the user closed.
    const expanded = new Set(
      [...folds]
        .filter(
          ([path, open]) =>
            open && ancestorDirs(path).every((dir) => folds.get(dir) !== false)
        )
        .map(([path]) => path)
    );
    const open = selectedFileRef.current;
    if (open !== null) for (const dir of ancestorDirs(open)) expanded.add(dir);
    modelRef.current?.resetPaths([...pathsRef.current], {
      // Sorted: the store walks the hints in order and keeps the parent it is
      // already inside, rather than starting from the root for each one.
      initialExpandedPaths: [...expanded].sort(),
    });
  }, [rememberFolds]);
  resetPathsRef.current = resetTreePaths;
  useEffect(() => {
    // A reset would tear the row a draft is being named in out from under the
    // input, half-typed name and all — it waits for the draft to finish.
    if (draftRef.current !== null) {
      pendingResetRef.current = true;
      return;
    }
    resetTreePaths();
  }, [pathsKey, model, resetTreePaths]);

  // The tree is the only one who knows a draft was let go — Escape, or a
  // committed blank name, removes the row without a rename ever firing. Seeing
  // that remove closes out the draft and applies any reset it was holding up.
  useEffect(
    () =>
      model.onMutation("remove", ({ path }) => {
        const draft = draftRef.current;
        if (draft === null || withoutTrailingSlash(path) !== draft.path) return;
        draftRef.current = null;
        if (pendingResetRef.current) {
          pendingResetRef.current = false;
          resetTreePaths();
        }
      }),
    [model, resetTreePaths]
  );

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
  // that commits it is routed to `create` by the handler above, which stamps a
  // typed template's extension on the name.
  const startCreate = (item: TreeItem, choice: NewEntryChoice) => {
    const row = draftPath(targetDirectory(item), choice.kind, treeHolds);
    draftRef.current = {
      path: withoutTrailingSlash(row),
      row,
      extension: choice.extension,
    };
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

  // The rename and search inputs live in the tree's shadow root, so their keys
  // reach this handler retargeted to the host element — the path is the only
  // place the input itself still shows up.
  const typingInTree = (event: ReactKeyboardEvent) =>
    event.nativeEvent
      .composedPath()
      .some(
        (node) =>
          node instanceof HTMLElement &&
          (node.isContentEditable ||
            node.tagName === "INPUT" ||
            node.tagName === "TEXTAREA")
      );

  // The tree drives the arrows, Enter and F2 itself; these are the rest of what
  // a file tree is expected to answer to.
  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (typingInTree(event)) return;
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

  // What a row would revert: the file itself, or every changed file the folder
  // holds — a folder is handed over spread out, so the new files under it are
  // dropped too rather than left behind by a `git checkout` of the directory.
  const changedUnder = (item: TreeItem): ReadonlyArray<string> => {
    const path = withoutTrailingSlash(item.path);
    if (item.kind === "file")
      return gitStatus.some((entry) => entry.path === path) ? [path] : [];
    const prefix = `${path}/`;
    return gitStatus
      .filter((entry) => entry.path.startsWith(prefix))
      .map((entry) => entry.path);
  };

  const discardChanges = async (item: TreeItem) => {
    const changed = changedUnder(item);
    if (changed.length === 0) return;
    const name = withoutTrailingSlash(item.path);
    const files = `${changed.length} ${changed.length === 1 ? "file" : "files"}`;
    const ok = await confirm({
      title:
        item.kind === "file"
          ? "Discard all changes in this file?"
          : `Discard changes in ${files} under this folder?`,
      subject: name,
      description:
        item.kind === "file"
          ? "This reverts the file to the last commit and cannot be undone."
          : "This reverts them to the last commit and cannot be undone.",
      confirmLabel: "Discard",
      destructive: true,
    });
    if (ok) onDiscardPaths?.(changed);
  };

  const hasMenu =
    actions !== undefined ||
    onDeletePaths !== undefined ||
    onRenamePath !== undefined ||
    onShowHistory !== undefined ||
    onDiscardPaths !== undefined;
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
          options?: {
            readonly focusMoves?: boolean;
            readonly off?: boolean;
            readonly destructive?: boolean;
          }
        ) => (
          <button
            key={label}
            role="menuitem"
            disabled={options?.off === true}
            className={cn(
              TREE_MENU_ITEM,
              options?.destructive === true && "text-destructive"
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
          <div key={key} role="separator" className="my-0.5 h-px bg-border" />
        );
        return (
          <div
            // Re-keyed per row, so opening the menu on another row while it is
            // already up mounts a fresh one — and the first entry takes focus
            // again, rather than leaving it on the row the last menu was for.
            key={item.path}
            role="menu"
            ref={openedMenu}
            // A hovered row and a focused one are lit at once whenever the
            // pointer rests somewhere the arrows are not, so the rows are held
            // apart by the 2px the tree already puts between its own.
            className={TREE_MENU_PANEL}
          >
            {actions !== undefined && [
              <NewEntrySubmenu
                key="new"
                onPick={(choice) => {
                  // Focus moves on to the draft's rename input.
                  context.close({ restoreFocus: false });
                  startCreate(item, choice);
                }}
              />,
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
            {onDiscardPaths !== undefined &&
              changedUnder(item).length > 0 &&
              entry(
                IconArrowBackUp,
                "Discard changes",
                () => void discardChanges(item),
                { destructive: true }
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
              entry(IconTrash, "Delete", () => void onDeletePaths([item]), {
                destructive: true,
              })}
          </div>
        );
      }
    : undefined;

  return (
    <aside className="flex h-full flex-col">
      <div
        className={cn(
          "mt-1 min-h-0 flex-1 overflow-auto",
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
