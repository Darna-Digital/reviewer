import {
  IconArrowBackUp,
  IconClipboardCopy,
  IconClipboardText,
  IconEye,
  IconFolderSearch,
  IconHistory,
} from "@tabler/icons-react";
import { FileTree, useFileTree } from "@pierre/trees/react";
import type {
  ComponentType,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  SyntheticEvent,
} from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { confirm } from "@/components/ui/alerts";
import { Orb } from "@/components/ui/orb";
import { revealPath } from "@/interactions/file-actions/adapters/reveal-path.adapter";
import { withoutTrailingSlash } from "@/interactions/file-actions/functions/file-actions.functions";
import type { TreeItem } from "@/interactions/file-actions/interfaces/file-actions.interfaces";
import type { AppMode } from "@/lib/api/types";
import { canQuickLook, quickLookFile } from "@/lib/desktop";
import { cn } from "@/lib/utils";
import type { GitStatusEntry } from "@reviewer/core/repo";

interface FileSidebarProps {
  mode: AppMode;
  paths: ReadonlyArray<string>;
  gitStatus: ReadonlyArray<GitStatusEntry>;
  selectedFile: string | null;
  onFileSelect: (path: string | null) => void;
  /**
   * A file the pointer or the focus has reached, and so may be about to open —
   * the moment to read and highlight it ahead of the click.
   */
  onFileIntent?: (path: string) => void;
  /** Open the bottom dock on this path's commit history. */
  onShowHistory?: (path: string) => void;
  /**
   * Revert the given paths' working-tree changes. Only wired where the tree
   * lists the working copy's own changes; absent means no discard row. The
   * menu confirms before calling, and a folder arrives already spread into the
   * changed files under it.
   */
  onDiscardPaths?: (paths: ReadonlyArray<string>) => void;
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

/**
 * The tree's context menu is hand-rolled — it lives in the slot the tree
 * positions, not in a base-ui portal — so its row and panel styling is spelled
 * here rather than borrowed from the app's menu components.
 */
const TREE_MENU_ITEM =
  "flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left outline-none hover:bg-elevate focus:bg-elevate disabled:opacity-40 disabled:hover:bg-transparent";

const TREE_MENU_PANEL =
  "flex min-w-48 flex-col gap-0.5 rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md";

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

/** The menu rows that can be chosen right now. */
const menuItems = (panel: HTMLElement) => [
  ...panel.querySelectorAll<HTMLButtonElement>(
    "[role='menuitem']:not(:disabled)"
  ),
];

/**
 * The keys an open menu answers to. It does not take the keyboard as it opens —
 * the row keeps focus until Down reaches for the menu, and only from there do
 * the arrows walk the entries and wrap at both ends. Bound to the document
 * because until focus is in the menu the keys are still the tree's, and bound
 * in the capture phase so the arrow that reaches for the menu does not move the
 * row behind it on its way. Escape belongs to the tree, which closes the menu.
 */
const menuKeys = (menu: HTMLElement) => (event: KeyboardEvent) => {
  const items = menuItems(menu);
  if (items.length === 0) return;
  const inside = menu.contains(document.activeElement);
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

export function FileSidebar({
  mode,
  paths,
  gitStatus,
  selectedFile,
  onFileSelect,
  onFileIntent,
  onShowHistory,
  onDiscardPaths,
  projectPath,
  loading = false,
  footer,
}: FileSidebarProps) {
  const onFileSelectRef = useRef(onFileSelect);
  onFileSelectRef.current = onFileSelect;
  // Rebuilding the tree is the only way to take a new listing, and a rebuilt
  // tree starts from `initialExpansion` — "closed", in browse mode. Every
  // folder the user had opened would therefore snap shut on the first git
  // refresh. So how each folder was left is kept here and handed to the tree
  // that replaces it:
  // true where it was open, false where it was closed, and absent for one
  // never seen either way.
  const foldsRef = useRef<Map<string, boolean>>(new Map());
  const pathsRef = useRef(paths);
  pathsRef.current = paths;
  const selectedFileRef = useRef(selectedFile);
  selectedFileRef.current = selectedFile;
  // Set while we sync the tree's selection to `selectedFile`, so the resulting
  // selection-change events don't loop back through `onFileSelect`.
  const syncingSelectionRef = useRef(false);
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
      onFileSelectRef.current(first);
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
  useEffect(() => {
    resetTreePaths();
  }, [pathsKey, model, resetTreePaths]);

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

  /** The row a keyboard action works on: the selection, or the focused row. */
  const activeItem = (): TreeItem | null => {
    const path = model.getSelectedPaths().at(0) ?? model.getFocusedPath();
    if (path === null || path === undefined) return null;
    return {
      kind: model.getItem(path)?.isDirectory() === true ? "directory" : "file",
      path,
    };
  };

  const copyToClipboard = (text: string) =>
    void navigator.clipboard.writeText(text);

  const absolutePath = (path: string) =>
    projectPath == null || projectPath === ""
      ? path
      : `${projectPath}/${withoutTrailingSlash(path)}`;

  // The search input lives in the tree's shadow root, so its keys reach this
  // handler retargeted to the host element — the path is the only place the
  // input itself still shows up.
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

  // The rows live in the tree's shadow root, so an event reaches this handler
  // retargeted to the host; the row it crossed is found on the composed path,
  // by the attributes the tree draws it with.
  const onRowIntent = (event: SyntheticEvent) => {
    if (onFileIntent === undefined) return;
    const row = event.nativeEvent
      .composedPath()
      .find(
        (node): node is HTMLElement =>
          node instanceof HTMLElement && node.dataset.itemType === "file"
      );
    const path = row?.dataset.itemPath;
    if (path !== undefined) onFileIntent(path);
  };

  // The tree drives the arrows and Enter itself; Space is the rest of what a
  // file tree is expected to answer to.
  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (typingInTree(event) || event.metaKey || event.ctrlKey) return;
    if (event.key !== " " || !canQuickLook) return;
    const item = activeItem();
    if (item === null || item.kind !== "file") return;
    event.preventDefault();
    quickLookFile(absolutePath(item.path));
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

  /**
   * The row's menu: the ways of getting at the file it names, and — where the
   * changes are the working copy's own — the one way of undoing them. Nothing
   * here makes, moves or deletes a file: the project's own files are the
   * editor's to change, and the tree only ever reads them.
   */
  const renderContextMenu = (
    item: TreeItem,
    context: { close: () => void }
  ) => {
    const entry = (
      Icon: MenuIcon,
      label: string,
      run: () => void,
      options?: { readonly destructive?: boolean }
    ) => (
      <button
        key={label}
        role="menuitem"
        className={cn(
          TREE_MENU_ITEM,
          options?.destructive === true && "text-destructive"
        )}
        onClick={() => {
          context.close();
          run();
        }}
      >
        <Icon className="size-3.5 shrink-0 opacity-70" />
        {label}
      </button>
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
        {entry(IconClipboardCopy, "Copy path", () =>
          copyToClipboard(absolutePath(item.path))
        )}
        {entry(IconClipboardText, "Copy relative path", () =>
          copyToClipboard(withoutTrailingSlash(item.path))
        )}
        {entry(
          IconFolderSearch,
          REVEAL_LABEL,
          () => void revealPath(item.path)
        )}
        {canQuickLook &&
          item.kind === "file" &&
          entry(IconEye, "Quick Look", () =>
            quickLookFile(absolutePath(item.path))
          )}
        {onShowHistory !== undefined &&
          entry(IconHistory, "Show history", () => onShowHistory(item.path))}
        {onDiscardPaths !== undefined && changedUnder(item).length > 0 && (
          <>
            <div role="separator" className="my-0.5 h-px bg-border" />
            {entry(
              IconArrowBackUp,
              "Discard changes",
              () => void discardChanges(item),
              { destructive: true }
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <aside className="flex h-full flex-col">
      <div
        className={cn(
          "mt-1 min-h-0 flex-1 overflow-auto",
          menuOpen && "relative z-20"
        )}
        onKeyDown={onKeyDown}
        onPointerOver={onRowIntent}
        onFocus={onRowIntent}
      >
        {loading ? (
          <div className="px-3 py-2">
            <Orb size={16} label="Loading files…" />
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
