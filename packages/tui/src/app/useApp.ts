import type { TextareaRenderable } from '@opentui/core';
import { useRenderer, useTerminalDimensions } from '@opentui/react';
import type { ReviewComment } from '@reviewer/core/comments';
import type { DevCommand } from '@reviewer/core/local-dev';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import * as React from 'react';
import { stopKey } from '../diff/buildLayout';
import type { Anchor } from '../diff/buildLayout';
import type { CodePoint } from '../diff/codeAt';
import type { DiffLine } from '../diff/parseDiff';
import { discard, fetchAll, pull, push, summarize } from '../git/actions';
import { branchName } from '../git/branchName';
import { COMMIT_AGENTS, isCommitAgent } from '../git/commitMessage';
import type { CommitAgent } from '../git/commitMessage';
import type { GrepOptions } from '../git/files';
import type {
  DocumentSymbol,
  SymbolReference,
  SymbolTarget,
} from '../language/client';
import { identifiers } from '../language/identifier';
import type { Branch } from '../git/refs';
import type { MergeMethod } from '../github/client';
import { mergeBlockedReason, mergeCaution } from '../github/pullStatus';
import { stopAllSessions } from '../process/ptySession';
import { installedRelease, linkedBinary } from '../release/install';
import { fileIcons } from '../render/fileIcons';
import type { PaletteMode } from '../search/paletteModes';
import type { Store } from '../store/createStore';
import { readMacDefault } from '../store/macDefaults';
import { workspaces } from '../workspace/client';
import { folderWorkspace } from '../workspace/folder';
import type { SavedWorkspace } from '../workspace/client';
import { repoRoot } from '../git/repo';
import { expandHome } from '../text/paths';
import { byRepo, locate } from '../repos/repos';
import type { Repo, Repos } from '../repos/repos';
import type { TreeNode } from '../tree/fileTree';
import {
  comparisonOf,
  isSameComparison,
  targetKey,
  WORKTREE,
} from './comparison';
import type { CommandKey } from './commandKey';
import type { Comparison } from './comparison';
import { useBranches } from './useBranches';
import { useCommit } from './useCommit';
import { useDiffView } from './useDiffView';
import { fileAsDiff, useEditor } from './useEditor';
import type { DiffView } from './useDiffView';
import { useHistory } from './useHistory';
import { usePulls } from './usePulls';
import type { RepoPull } from './usePulls';
import { useReview } from './useReview';
import { useServer } from './useServer';
import { useUpdate } from './useUpdate';
import { useServices } from './useServices';
import { useSymbols } from './useSymbols';
import type { SymbolSpot } from './useSymbols';
import { useTheme } from './useTheme';
import type { ThemeStart } from './useTheme';
import { useTree } from './useTree';
import { CHROME_ROWS, useWorkspace } from './useWorkspace';
import type { BottomTab, Surface } from './useWorkspace';

export type Focus = 'sidebar' | 'main' | 'bottom';
/** The pull request sidebar's two lists: the pull requests, and the files of the one under review. */
export type PullPart = 'list' | 'files';
export type Typing =
  'message' | 'treeFilter' | 'historyFilter' | 'pullFilter' | null;
export type Cell = { x: number; y: number };

export type MenuEntry =
  | {
      label: string;
      hint?: string;
      danger?: boolean;
      disabled?: boolean;
      run: () => void;
    }
  | { separator: true };

export interface FormField {
  key: string;
  label: string;
  placeholder?: string;
  initial?: string;
}

export type Overlay =
  | { kind: 'help' }
  | { kind: 'targets'; at?: Cell }
  | {
      kind: 'branches';
      at?: Cell;
      /** Restored when coming back from a branch's submenu. */
      highlighted?: string;
      query?: string;
    }
  | { kind: 'palette'; mode: PaletteMode }
  | { kind: 'theme' }
  | { kind: 'comments' }
  | { kind: 'pulls' }
  /** A workspace's repositories, to focus one — and then show its branches. */
  | { kind: 'repos'; at?: Cell; then: 'focus' | 'branches' }
  | { kind: 'workspaces' }
  | { kind: 'workspaceEditor'; draft: WorkspaceDraft }
  /** Repositories to add to the workspace being edited. */
  | { kind: 'addRepo'; draft: WorkspaceDraft }
  | { kind: 'commentsHere'; at: Cell }
  | { kind: 'definitions'; at: Cell; symbol: string; targets: SymbolTarget[] }
  | { kind: 'lineSymbols'; at: Cell; spots: SymbolSpot[] }
  | { kind: 'outline'; path: string; symbols: DocumentSymbol[] }
  | {
      kind: 'compose';
      anchor: Anchor;
      line: DiffLine | null;
      editing: ReviewComment | null;
      /** A GitHub comment the text answers, in its thread. */
      replyTo: ReviewComment | null;
      /** The comparison key the comment is filed under. */
      target: string;
    }
  | {
      kind: 'confirm';
      title: string;
      detail: string;
      confirmLabel: string;
      run: () => void;
    }
  | {
      kind: 'form';
      title: string;
      fields: FormField[];
      submitLabel: string;
      /** Returns an error to show, or nothing to close. */
      submit: (values: Record<string, string>) => string | null | void;
    }
  | {
      kind: 'menu';
      at: { x: number; y: number };
      entries: MenuEntry[];
      /** The popover the menu was opened from; dismissing returns to it. */
      under?: Overlay;
    };

/** A saved workspace being made (`id` null) or edited. */
export interface WorkspaceDraft {
  id: string | null;
  name: string;
  roots: string[];
  /** The repository row with the keyboard. */
  selected: number;
}

export interface AppProps {
  repos: Repos;
  store: Store;
  /** Opens other repositories in place of these — a saved workspace, or ones on their own. */
  openRepos: (roots: string[], workspace: Repos['workspace']) => void;
  themeStart: ThemeStart;
  initial: Comparison;
  /** The repository `initial` is about, when not the first. */
  focus?: string;
  /** Start the Reviewer server when none answers (off in snapshots). */
  startServer?: boolean;
  /** Whether ⌘ is held, for ⌘-click; absent in snapshots. */
  commandKey?: CommandKey;
}

export type App = ReturnType<typeof useApp>;

export const COMPOSER_HEIGHT = 6;
export const NOTICE_MS = 4000;
/** The surface tabs and the branch and compare chips. */
export const SIDEBAR_HEADER = 2;
/** The commit box's rule, blank row and buttons around its message field. */
export const COMMIT_BOX_CHROME = 3;
const CLOCK_MS = 30_000;
/** The pull request list's share of the sidebar when the files of one are under it. */
const PULL_LIST_SHARE = 0.4;
/** The rule and filter field above a pull request's files. */
const PULL_FILES_CHROME = 2;
/** Rows a pull request's files keep however far the list is dragged down. */
const MIN_PULL_FILES_ROWS = 3;
/** How long history scrolling rests before the commit under it opens. */
const HISTORY_SETTLE_MS = 120;

/** Composes every part of the screen and owns the actions that span them. */
export function useApp(props: AppProps) {
  const { repos, store } = props;
  const renderer = useRenderer();
  const themes = useTheme(renderer, store, props.themeStart);
  const { palette, theme, themeName } = themes.look;
  const icons = React.useMemo(
    () => fileIcons(palette, themes.settings.fileIcons),
    [palette, themes.settings.fileIcons],
  );
  const screen = useTerminalDimensions();
  const workspace = useWorkspace(store, layoutKey(repos), screen);
  const review = useReview(
    repos,
    store,
    props.initial,
    workspace.fullFiles ? 'full' : 'hunks',
    props.focus,
  );
  useServer(review, props.startServer ?? false);
  const update = useUpdate(review);
  const pulls = usePulls(review);
  const [now, setNow] = React.useState(Date.now);
  const [focus, setFocusState] = React.useState<Focus>('main');
  const [chosenPullPart, setPullPart] = React.useState<PullPart>('list');
  const [typing, setTyping] = React.useState<Typing>(null);
  const [captured, setCaptured] = React.useState(false);
  const [overlay, setOverlayState] = React.useState<Overlay | null>(null);
  const [previous, setPrevious] = React.useState<Comparison>(WORKTREE);
  const commentBox = React.useRef<TextareaRenderable | null>(null);
  const historySettle = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const [searchMemory, setSearchMemory] = React.useState({
    files: '',
    text: '',
    options: { caseSensitive: false, wholeWord: false, regex: false },
  });
  const chords = renderer.capabilities?.kitty_keyboard ?? false;

  React.useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(clock);
  }, []);
  React.useEffect(() => {
    if (!review.notice) return;
    const expire = setTimeout(() => setNow(Date.now()), NOTICE_MS + 50);
    return () => clearTimeout(expire);
  }, [review.notice]);

  const { surface } = workspace;
  const isCommitMode =
    surface === 'review' &&
    review.comparison.kind === 'worktree' &&
    review.files.length > 0;
  const showsPullFiles =
    surface === 'review' &&
    workspace.sidebarList === 'pulls' &&
    review.comparison.kind === 'pull';
  const pullPart = showsPullFiles ? chosenPullPart : 'list';

  // geometry
  const bodyHeight = Math.max(6, screen.height - CHROME_ROWS);
  const sidebarWidth = workspace.sidebarWidth;
  const mainLeft = workspace.sidebarVisible ? sidebarWidth + 1 : 0;
  const mainWidth = Math.max(20, screen.width - mainLeft);
  const bottomHeight = workspace.bottomOpen
    ? Math.min(workspace.bottomHeight, bodyHeight - 4)
    : 0;
  const editorHeight = bodyHeight - bottomHeight;
  const contentTop = 1;
  const contentHeight = Math.max(1, editorHeight - 1);
  const commitBoxHeight = workspace.commitMessageRows + COMMIT_BOX_CHROME;
  const treeHeight = Math.max(
    1,
    bodyHeight -
      SIDEBAR_HEADER -
      (surface === 'review' ? 1 : 0) -
      (isCommitMode ? commitBoxHeight : 0),
  );
  const pullRoom = treeHeight - PULL_FILES_CHROME;
  const pullListHeight = showsPullFiles
    ? Math.max(
        1,
        Math.min(
          workspace.pullListRows ?? Math.round(pullRoom * PULL_LIST_SHARE),
          pullRoom - MIN_PULL_FILES_ROWS,
        ),
      )
    : treeHeight;
  const pullFilesHeight = Math.max(1, pullRoom - pullListHeight);

  const mainFocused = focus === 'main' && !overlay;
  const diff = useDiffView({
    files: review.files,
    comments: review.visibleComments,
    width: mainWidth,
    height: contentHeight,
    palette,
    icons,
    theme,
    themeName,
    focused: mainFocused && surface === 'review',
    now,
    wrap: workspace.wrap,
    setWrap: workspace.setWrap,
  });
  const editor = useEditor({
    review,
    width: mainWidth,
    height: contentHeight,
    palette,
    icons,
    theme,
    themeName,
    focused: mainFocused && surface === 'browse',
    now,
    wrap: workspace.wrap,
    setWrap: workspace.setWrap,
  });
  const symbols = useSymbols(review);
  const jumps = React.useRef<{ back: Place[]; forward: Place[] }>({
    back: [],
    forward: [],
  });
  const usagesListWidth = Math.max(
    MIN_USAGES_PART,
    Math.min(
      workspace.usagesListWidth ?? Math.round(mainWidth * USAGES_LIST_SHARE),
      mainWidth - MIN_USAGES_PART,
    ),
  );
  const previewFiles = React.useMemo(
    () =>
      symbols.preview
        ? [fileAsDiff(symbols.preview.path, symbols.preview.file)]
        : [],
    [symbols.preview],
  );
  const usagePreview = useDiffView({
    files: previewFiles,
    comments: [],
    width: mainWidth - usagesListWidth - 1,
    height: Math.max(1, bottomHeight - USAGES_CHROME_ROWS),
    palette,
    icons,
    theme,
    themeName,
    focused: false,
    now,
    wrap: false,
    setWrap: keepUnwrapped,
    fixedView: 'file',
  });
  const previewLine = symbols.selectedUsage?.location;
  React.useEffect(() => {
    if (!previewLine) return;
    const line = previewLine.range.start.line + 1;
    usagePreview.landOn(stopKey.fileLine(previewLine.path, line));
  }, [previewLine, previewFiles]); // again once the preview file arrives
  const diffFile = diff.stop ? review.files[diff.stop.file]?.path : undefined;
  // the tree follows the diff cursor (Review) or the open tab (Browse)
  // unless the tree has the keyboard
  const shownFile =
    surface === 'review' ? diffFile : (editor.active ?? undefined);
  const treeHasKeyboard =
    focus === 'sidebar' && (!showsPullFiles || pullPart === 'files');
  const tree = useTree(
    surface,
    review,
    treeHasKeyboard ? undefined : shownFile,
  );
  React.useEffect(() => {
    if (surface === 'browse' && editor.active) tree.reveal(editor.active);
    // reveal once per tab change, not on every tree re-render
  }, [surface, editor.active]);
  const commitAgent = themes.settings.commitAgent ?? macCommitAgent;
  const commit = useCommit(review, workspace, commitAgent);
  const history = useHistory(
    review,
    workspace.bottomOpen && workspace.bottomTab === 'history',
  );
  const branches = useBranches(review);
  const services = useServices(review, store);
  const activeView = surface === 'review' ? diff : editor.viewer;

  const notify = review.notify;

  /** Moving focus leaves any field being typed in and lets go of a service. */
  function setFocus(next: Focus) {
    if (next === 'sidebar' && shownFile) tree.select(shownFile);
    setFocusState(next);
    setTyping(null);
    if (next !== 'bottom') setCaptured(false);
  }

  /** An overlay takes the keyboard from whatever field had it. */
  function setOverlay(next: Overlay | null) {
    if (next) setTyping(null);
    setOverlayState(next);
  }

  const actions = {
    setFocus,
    focusNext(step: 1 | -1) {
      const sidebarParts: Array<Focus | PullPart> = showsPullFiles
        ? ['list', 'files']
        : ['sidebar'];
      const order: Array<Focus | PullPart> = [
        ...(workspace.sidebarVisible ? sidebarParts : []),
        'main',
        ...(workspace.bottomOpen ? (['bottom'] as const) : []),
      ];
      const here = focus === 'sidebar' && showsPullFiles ? pullPart : focus;
      const index = order.indexOf(here);
      const next = order[(index + step + order.length) % order.length]!;
      if (next === 'list' || next === 'files') actions.focusPullPart(next);
      else setFocus(next);
    },
    focusPullPart(part: PullPart) {
      setPullPart(part);
      setFocus('sidebar');
    },
    /** Browse leaves a commit opened from history, as the Mac trail does. */
    setSurface(next: Surface) {
      if (next === 'browse' && review.comparison.kind === 'commit')
        showComparison(previous);
      workspace.setSurface(next);
      workspace.setSidebarList('files');
      // Browse with nothing open leaves the keyboard in the tree to pick a file
      setFocus(next === 'browse' && !editor.active ? 'sidebar' : 'main');
    },
    toggleBottomTab(tab: BottomTab) {
      const closing = workspace.bottomOpen && workspace.bottomTab === tab;
      workspace.toggleBottomTab(tab);
      setFocus(closing ? 'main' : 'bottom');
      setCaptured(false);
    },
    toggleBottom() {
      workspace.toggleBottom();
      setFocus(workspace.bottomOpen ? 'main' : 'bottom');
    },
    toggleSidebar() {
      workspace.toggleSidebar();
      if (workspace.sidebarVisible && focus === 'sidebar') setFocus('main');
    },
    setTyping,
    capture(on: boolean) {
      if (on) setFocusState('bottom');
      setCaptured(on);
    },
    openOverlay: (next: Overlay) => setOverlay(next),
    openPalette: (mode: PaletteMode) => setOverlay({ kind: 'palette', mode }),
    /**
     * The branch popover, hanging from `at` or the sidebar's branch chip;
     * over a workspace, its repositories first, to pick whose branches.
     */
    openBranches(at?: Cell, { pickRepo = repos.spans } = {}) {
      const anchor = at ?? chipAnchor('branch');
      setOverlay(
        pickRepo
          ? { kind: 'repos', at: anchor, then: 'branches' }
          : { kind: 'branches', at: anchor },
      );
    },
    /** The workspace's repositories, to focus one. */
    pickRepo(at?: Cell) {
      if (!repos.spans)
        return notify('info', 'One repository is open — ⌘O opens a workspace');
      setOverlay({ kind: 'repos', at, then: 'focus' });
    },
    focusRepo(repo: Repo) {
      review.focus(repo);
      if (repo !== review.focused)
        notify(
          'info',
          `Focused ${repo.name} — branch, history and git act on it`,
        );
    },
    /** Steps the focus through the workspace's repositories. */
    stepRepo(delta: number) {
      const at = repos.list.indexOf(review.focused);
      const next =
        repos.list[(at + delta + repos.list.length) % repos.list.length];
      if (next) actions.focusRepo(next);
    },
    openWorkspaces: () => setOverlay({ kind: 'workspaces' }),
    async editOpenWorkspace() {
      const saved = await openSavedWorkspace();
      if (saved) actions.editWorkspace(saved);
      else if (!repos.workspace) actions.editWorkspace();
    },
    /** The workspace editor of what is open, straight on to picking a repository to add. */
    async addRepoToWorkspace() {
      const saved = repos.workspace ? await openSavedWorkspace() : null;
      if (repos.workspace && !saved) return;
      const roots = repos.list.map((repo) => repo.root);
      setOverlay({
        kind: 'addRepo',
        draft: {
          id: saved?.id ?? null,
          name: saved?.name ?? '',
          roots,
          selected: roots.length,
        },
      });
    },
    /** Opens `roots` in place of what is open, once any running service is let go. */
    openRepos(roots: string[], saved: Repos['workspace'] = null) {
      const open = () => props.openRepos(roots, saved);
      const running = services.running().length;
      if (running === 0) return open();
      actions.confirm(
        'Open another workspace',
        `${running} running service${running === 1 ? ' is' : 's are'} stopped first.`,
        'open',
        open,
      );
    },
    openSaved(saved: SavedWorkspace) {
      const roots = saved.roots.filter((root) => existsSync(root));
      if (roots.length === 0)
        return notify(
          'error',
          `None of ${saved.name}'s repositories are on disk`,
        );
      actions.openRepos(roots, { id: saved.id, name: saved.name });
    },
    /** Opens the repository `path` is in, on its own or added to what is open. */
    async openPath(path: string, { add = false } = {}) {
      const root = await repoRoot(expandHome(path)).catch(() => null);
      const folder =
        root || add ? null : await folderWorkspace(expandHome(path));
      if (folder) return actions.openRepos(folder.roots, folder.workspace);
      if (!root)
        return notify(
          'error',
          `Not a git repository, nor a folder of them: ${path}`,
        );
      if (!add) return actions.openRepos([root]);
      const roots = repos.list.map((repo) => repo.root);
      if (roots.includes(root))
        return notify('info', `${basename(root)} is open already`);
      actions.setWorkspaceRoots([...roots, root]);
    },
    /** What is open, with these repositories — kept in its saved workspace, if it is one. */
    async setWorkspaceRoots(roots: string[]) {
      const saved = repos.workspace;
      if (saved && !(await asked(() => workspaces.update(saved.id, { roots }))))
        return;
      actions.openRepos(roots, saved);
    },
    removeRepo(repo: Repo) {
      actions.confirm(
        'Remove from workspace',
        `${repo.name} leaves ${repos.workspace?.name ?? 'the workspace'}; the repository stays where it is.`,
        'remove',
        () =>
          actions.setWorkspaceRoots(
            repos.list
              .filter((other) => other !== repo)
              .map((other) => other.root),
          ),
      );
    },
    /** The editor for a new workspace — of what is open, when several are — or a saved one. */
    editWorkspace(
      seed: Partial<Pick<SavedWorkspace, 'id' | 'name' | 'roots'>> = {},
    ) {
      const roots = [
        ...(seed.roots ??
          (repos.spans ? repos.list.map((repo) => repo.root) : [])),
      ];
      setOverlay({
        kind: 'workspaceEditor',
        draft: {
          id: seed.id ?? null,
          name: seed.name ?? (roots.length === 1 ? basename(roots[0]!) : ''),
          roots,
          selected: 0,
        },
      });
    },
    /**
     * Saves the draft through the server, then opens it — or, for the one
     * open, shows the change; the problem with it, if it was not saved.
     */
    async saveWorkspace(draft: WorkspaceDraft): Promise<string | null> {
      const name = draft.name.trim();
      if (!name) return 'Name the workspace';
      if (draft.roots.length === 0) return 'Add a repository';
      try {
        const saved =
          draft.id === null
            ? await workspaces.create(name, draft.roots)
            : await workspaces.update(draft.id, { name, roots: draft.roots });
        setOverlay(null);
        const ref = { id: saved.id, name: saved.name };
        if (draft.id === null || repos.workspace?.id === saved.id)
          actions.openRepos([...saved.roots], ref);
        else notify('success', `Saved ${saved.name}`);
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    },
    deleteWorkspace(saved: SavedWorkspace) {
      actions.confirm(
        'Delete workspace',
        `${saved.name} is forgotten. Its repositories stay where they are.`,
        'delete',
        async () => {
          if (!(await asked(() => workspaces.remove(saved.id)))) return;
          if (repos.workspace?.id === saved.id)
            props.openRepos(
              repos.list.map((repo) => repo.root),
              null,
            );
          notify('success', `Deleted ${saved.name}`);
        },
      );
    },
    /** The comparison popover, hanging from `at` or the compare chip. */
    openTargets: (at?: Cell) =>
      setOverlay({ kind: 'targets', at: at ?? chipAnchor('target') }),
    /** Files and text queries are kept between openings, as on the Mac. */
    rememberSearch(mode: PaletteMode, query: string) {
      if (mode === 'files' || mode === 'text')
        setSearchMemory((memory) => ({ ...memory, [mode]: query }));
    },
    setSearchOptions: (options: GrepOptions) =>
      setSearchMemory((memory) => ({ ...memory, options })),
    closeOverlay: () => setOverlay(null),
    openMenu(at: Cell, entries: MenuEntry[], under?: Overlay) {
      setOverlay({ kind: 'menu', at, entries, under });
    },
    /** Esc or a click away: back to the popover the menu came from, if any. */
    dismissMenu() {
      setOverlay(overlay?.kind === 'menu' ? (overlay.under ?? null) : null);
    },
    confirm(
      title: string,
      detail: string,
      confirmLabel: string,
      run: () => void,
    ) {
      setOverlay({ kind: 'confirm', title, detail, confirmLabel, run });
    },
    form(
      title: string,
      fields: FormField[],
      submitLabel: string,
      submit: Extract<Overlay, { kind: 'form' }>['submit'],
    ) {
      setOverlay({ kind: 'form', title, fields, submitLabel, submit });
    },

    openFile(path: string, opts: { preview?: boolean; line?: number } = {}) {
      if (!opts.preview) rememberPlace();
      workspace.setSurface('browse');
      editor.open(path, opts);
      tree.reveal(path);
      if (opts.line)
        editor.viewer.landOn(`L:${path}:${opts.line}:${opts.line}`);
    },
    showInDiff(path: string) {
      rememberPlace();
      workspace.setSurface('review');
      const index = review.files.findIndex((file) => file.path === path);
      if (index !== -1) diff.jumpToFile(index);
    },
    /** Moves the tree selection; on Review the diff follows to the file. */
    stepTree(delta: number) {
      const node = tree.step(delta);
      if (surface !== 'review' || node?.kind !== 'file') return;
      const index = review.files.findIndex((file) => file.path === node.path);
      if (index !== -1) diff.jumpToFile(index);
    },
    openTreeNode(node: TreeNode, { preview = false } = {}) {
      if (node.kind === 'dir') return tree.setOpen(node, !tree.isOpen(node));
      if (surface === 'browse') actions.openFile(node.path, { preview });
      else actions.showInDiff(node.path);
      if (!preview) setFocus('main');
    },
    treeMenu(node: TreeNode, at: { x: number; y: number }) {
      const repo = repos.spans
        ? repos.list.find((candidate) => candidate.name === node.path)
        : undefined;
      if (repo) return actions.repoMenu(repo, at);
      const changed = node.files.filter((path) => review.statusMap.has(path));
      actions.openMenu(at, [
        ...(node.kind === 'file'
          ? [
              { label: 'Open', run: () => actions.openFile(node.path) },
              ...(review.files.some((file) => file.path === node.path)
                ? [
                    {
                      label: 'Show in diff',
                      run: () => actions.showInDiff(node.path),
                    },
                  ]
                : []),
              {
                label: 'Show history',
                run: () => actions.showHistoryFor(node.path),
              },
              { separator: true as const },
            ]
          : []),
        { label: 'Copy path', run: () => actions.copy(node.path) },
        {
          label: 'Copy absolute path',
          run: () => actions.copy(absolutePath(node.path)),
        },
        ...(changed.length > 0
          ? [
              { separator: true as const },
              {
                label: 'Discard changes…',
                danger: true,
                run: () => actions.discard(node),
              },
            ]
          : []),
      ]);
    },
    /** A workspace repository's folder in the tree, as the Mac tree's root header. */
    repoMenu(repo: Repo, at: Cell) {
      actions.openMenu(at, [
        {
          label: `Focus ${repo.name}`,
          disabled: repo === review.focused,
          run: () => actions.focusRepo(repo),
        },
        {
          label: 'Show history',
          run: () => {
            review.focus(repo);
            actions.showHistoryFor(null);
          },
        },
        { separator: true },
        { label: 'Copy path', run: () => actions.copy(repo.root) },
        { separator: true },
        {
          label: 'Remove from workspace…',
          danger: true,
          run: () => actions.removeRepo(repo),
        },
      ]);
    },
    discard(node: TreeNode) {
      const paths = node.files.filter((path) => review.statusMap.has(path));
      if (paths.length === 0) return notify('info', 'Nothing to discard');
      const what =
        node.kind === 'dir'
          ? `${paths.length} files under ${node.path}`
          : node.path;
      actions.confirm(
        'Discard changes',
        `Revert the working-tree changes to ${what}? This cannot be undone.`,
        'discard',
        () =>
          void review.runGit(
            `Discarding ${node.name}…`,
            async () => {
              for (const group of byRepo(repos, paths))
                await discard(group.repo.root, group.paths);
            },
            () => `Discarded ${node.name}`,
          ),
      );
    },
    /** The agent menu beside the commit box's Generate, as the Mac composer has it. */
    commitAgentMenu(at: Cell) {
      actions.openMenu(
        at,
        COMMIT_AGENTS.map(({ id, label }) => ({
          label: `${id === commitAgent ? '✓' : ' '} ${label}`,
          run: () => {
            themes.updateSettings({ commitAgent: id });
            notify('success', `Commit messages are drafted with ${label}`);
          },
        })),
      );
    },
    copy(text: string) {
      renderer.copyToClipboardOSC52(text);
      notify('success', `Copied ${text}`);
    },
    openUrl(url: string) {
      if (!url) return notify('info', 'No link for this one');
      const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
      Bun.spawn([opener, url], { stdout: 'ignore', stderr: 'ignore' });
    },

    /** The list as last read, re-read underneath — the read at launch can beat the server up. */
    openPulls() {
      void pulls.reload();
      setOverlay({ kind: 'pulls' });
    },
    /**
     * The open pull requests in the sidebar, as the Mac app's Merge requests:
     * the keyboard in the list, the first one opened when none is yet.
     */
    showPullList() {
      if (!workspace.sidebarVisible) return actions.openPulls();
      void pulls.reload();
      workspace.setSurface('review');
      workspace.setSidebarList('pulls');
      actions.focusPullPart('list');
      const first = pulls.ordered[0];
      if (review.comparison.kind !== 'pull' && first)
        actions.reviewPull(first, { stay: true });
    },
    /** Reviews a pull request: its diff and GitHub threads, with its overview below. */
    reviewPull(pr: RepoPull, { stay = false } = {}) {
      setOverlay(null);
      if (!stay) rememberPlace();
      workspace.setSurface('review');
      showComparison({ kind: 'pull', number: pr.number }, undefined, pr.repo);
      if (!workspace.bottomOpen) workspace.openBottom('pull');
      if (!stay) setFocus('main');
    },
    /** j/k in the list: the highlight moves at once, the diff once it rests. */
    stepPulls(delta: number) {
      const next = pulls.step(delta);
      if (!next) return;
      clearTimeout(historySettle.current);
      historySettle.current = setTimeout(
        () => latestActions.current.reviewPull(next, { stay: true }),
        HISTORY_SETTLE_MS,
      );
    },
    /** The pull request under review, or why there is none to act on. */
    shownPull(): RepoPull | null {
      if (review.comparison.kind !== 'pull') {
        notify('info', 'No pull request under review — press M to pick one');
        return null;
      }
      const pr = pulls.shown;
      if (!pr)
        notify(
          'info',
          pulls.loading ? 'Still loading' : 'It is no longer open',
        );
      return pr;
    },
    checkoutPull(pr: RepoPull) {
      void pulls.checkout(pr);
    },
    /** The merge method, then a confirmation — as the Mac app's merge alert. */
    mergePull(pr: RepoPull) {
      const blocked = mergeBlockedReason(pr);
      if (blocked) return notify('info', blocked);
      const confirmMerge = (method: MergeMethod, how: string) =>
        actions.confirm(
          `Merge #${pr.number} into ${pr.baseRef}?`,
          [
            `${how} — GitHub lands ${pr.headRef} on ${pr.baseRef}.`,
            mergeCaution(pr),
          ]
            .filter(Boolean)
            .join(' '),
          how.toLowerCase(),
          () => void pulls.merge(pr, method).then((ok) => ok && leavePull()),
        );
      actions.openMenu(cursorCell(), [
        {
          label: 'Create a merge commit',
          run: () => confirmMerge('merge', 'Merge commit'),
        },
        {
          label: 'Squash and merge',
          run: () => confirmMerge('squash', 'Squash and merge'),
        },
        {
          label: 'Rebase and merge',
          run: () => confirmMerge('rebase', 'Rebase and merge'),
        },
      ]);
    },
    closePull(pr: RepoPull) {
      actions.confirm(
        `Close #${pr.number} without merging?`,
        `${pr.headRef} keeps its commits; reopening is done on GitHub.`,
        'close',
        () => void pulls.close(pr).then((ok) => ok && leavePull()),
      );
    },
    showHistoryFor(path: string | null) {
      if (path !== null) review.focus(locate(repos, path).repo);
      history.setPath(path);
      workspace.openBottom('history');
      setFocus('bottom');
    },

    showComparison,
    toggleTarget() {
      const { comparison, recent, aim, defaultBranch } = review;
      if (comparison.kind !== 'worktree') return showComparison(WORKTREE);
      const ref = recent[0] ?? aim ?? defaultBranch;
      if (ref) showComparison({ kind: 'branch', against: ref });
      else notify('info', 'No branch to compare against yet — press t');
    },
    pickTarget(ref: string | null, remember: boolean) {
      workspace.setSurface('review');
      showComparison(ref ? { kind: 'branch', against: ref } : WORKTREE);
      if (remember && review.repo?.branch) {
        review.setAim(ref);
        notify(
          'success',
          ref
            ? `${review.repo.branch} now targets ${ref}`
            : `Cleared the target of ${review.repo.branch}`,
        );
      }
      setFocus('main');
    },
    showCommit(sha: string, path?: string) {
      workspace.setSurface('review');
      showComparison(
        { kind: 'commit', sha },
        path ? stopKey.file(path) : undefined,
      );
    },
    /** Leaves a commit or pull request for the change it was opened from. */
    back() {
      const { kind } = review.comparison;
      if (kind === 'commit' || kind === 'pull') showComparison(previous);
    },
    /** Moves through history and opens the commit, as the Mac list does. */
    stepHistory(delta: number) {
      const sha = history.step(delta);
      if (!sha) return;
      clearTimeout(historySettle.current);
      historySettle.current = setTimeout(
        () => latestActions.current.showCommit(sha),
        HISTORY_SETTLE_MS,
      );
    },
    openComment(comment: ReviewComment) {
      if (
        comment.target === 'worktree' &&
        !review.files.some((file) => file.path === comment.filePath)
      ) {
        actions.openFile(comment.filePath);
        editor.viewer.landOn(stopKey.comment(comment.id));
        return setFocus('main');
      }
      const target = comparisonOf(comment.target);
      if (!target)
        return notify('info', `Nothing here shows ${comment.target}`);
      workspace.setSurface('review');
      diff.setShowComments(true);
      diff.unfold(comment.filePath);
      showComparison(
        target,
        stopKey.comment(comment.id),
        target.kind === 'worktree'
          ? review.focused
          : locate(repos, comment.filePath).repo,
      );
      setFocus('main');
    },

    /** The symbol at a point in a pane's code, when the server can answer for it. */
    spotOf(view: DiffView, point: CodePoint): SymbolSpot | null {
      const path = view.paint.files[point.file]?.path;
      if (!path || !canAskAbout(view, point.line)) return null;
      return symbols.spotAt(
        path,
        point.line.newNo!,
        point.line.text,
        point.index,
      );
    },
    /** Every symbol on the cursor's line, for the keyboard's symbol menu. */
    symbolsOnLine() {
      const stop = activeView.stop;
      const file = stop ? activeView.paint.files[stop.file] : undefined;
      if (!stop || !file || stop.target.kind !== 'line')
        return notify('info', 'Move to a line of code');
      const { hunk, left, right } = stop.target;
      const line = file.hunks[hunk]?.lines[right ?? left ?? -1];
      if (!line || !canAskAbout(activeView, line))
        return notify(
          'info',
          'Symbols are read from the working tree — not this side',
        );
      const spots = identifiers(line.text).map((identifier) => ({
        path: file.path,
        line: line.newNo!,
        text: line.text,
        identifier,
      }));
      if (spots.length === 0) return notify('info', 'No symbols on this line');
      setOverlay({ kind: 'lineSymbols', at: cursorCell(), spots });
    },
    async goToDefinition(spot: SymbolSpot, at: Cell = cursorCell()) {
      const result = await symbols.definition(spot);
      if (!result) return;
      const targets = result.targets.filter((target) => !isSpot(target, spot));
      if (targets.length === 0) return actions.findUsages(spot);
      if (targets.length === 1)
        return actions.openLocation(targets[0]!.location);
      setOverlay({
        kind: 'definitions',
        at,
        symbol: spot.identifier.name,
        targets,
      });
    },
    findUsages(spot: SymbolSpot) {
      workspace.openBottom('usages');
      setFocus('bottom');
      void symbols.findUsages(spot);
    },
    openUsage(reference: SymbolReference) {
      actions.openLocation(reference.location);
    },
    openLocation(location: SymbolTarget['location']) {
      actions.openFile(location.path, { line: location.range.start.line + 1 });
      setFocus('main');
    },
    showInfo(spot: SymbolSpot, at: Cell = cursorCell()) {
      symbols.hoverAt(spot, at, { now: true });
    },
    symbolMenu(spot: SymbolSpot, at: Cell, under?: Overlay) {
      const name = spot.identifier.name;
      actions.openMenu(
        at,
        [
          {
            label: 'Go to definition',
            run: () => void actions.goToDefinition(spot, at),
          },
          {
            label: `Find usages of ${name}`,
            run: () => actions.findUsages(spot),
          },
          { label: 'Show info', run: () => actions.showInfo(spot, at) },
          { separator: true },
          { label: 'Comment on this line', run: () => actions.compose() },
          { label: `Copy ${name}`, run: () => actions.copy(name) },
        ],
        under,
      );
    },
    /** The symbols of the file in view, to jump to one. */
    async outline() {
      const path =
        surface === 'browse'
          ? editor.active
          : diff.stop
            ? review.files[diff.stop.file]?.path
            : undefined;
      if (!path) return notify('info', 'Open a file first');
      const found = await symbols.outline(path);
      if (!found) return;
      if (found.length === 0) return notify('info', `No symbols in ${path}`);
      setOverlay({ kind: 'outline', path, symbols: found });
    },
    goToSymbol(path: string, symbol: DocumentSymbol) {
      rememberPlace();
      const line = symbol.selectionRange.start.line + 1;
      if (surface === 'browse')
        editor.viewer.landOnWord(stopKey.fileLine(path, line), symbol.name);
      else if (!diff.landOnLine(path, line)) actions.openFile(path, { line });
      setFocus('main');
    },
    /**
     * The symbol under the word cursor — or, with none picked, the line's
     * first, which is then picked — or `null` with a hint why not.
     */
    wordSpot(): SymbolSpot | null {
      const stop = activeView.stop;
      const picked = activeView.cursorWord ?? activeView.firstWord();
      if (!picked || !stop) {
        notify('info', 'Move to a line with a symbol on it');
        return null;
      }
      if (!activeView.cursorWord) activeView.wordEdge('first');
      const spot = actions.spotOf(activeView, {
        file: stop.file,
        line: picked.line,
        index: picked.identifier.start,
      });
      if (!spot)
        notify(
          'info',
          'Symbols are read from the working tree — not this side',
        );
      return spot;
    },
    /** `{` / `}` in a file: the previous or next definition in its outline. */
    async jumpSymbol(step: 1 | -1) {
      const path = editor.active;
      const line = activeView.cursorLine();
      if (!path || line === null) return activeView.paragraph(step);
      const outline = await symbols.outline(path, { quiet: true });
      const starts = (outline ?? []).map((symbol) => ({
        symbol,
        line: symbol.selectionRange.start.line + 1,
      }));
      const next =
        step > 0
          ? starts.find((entry) => entry.line > line)
          : starts.findLast((entry) => entry.line < line);
      if (!next) return activeView.paragraph(step);
      editor.viewer.landOnWord(
        stopKey.fileLine(path, next.line),
        next.symbol.name,
      );
    },
    /** `*` / `#`, remembered so ⌃O comes back. */
    occurrence(step: 1 | -1) {
      rememberPlace();
      if (!activeView.occurrence(step))
        notify('info', 'No other use of it in view');
    },
    /** ⌃O / ⌥←: back to where the last jump left from. */
    jumpBack() {
      const place = jumps.current.back.pop();
      if (!place) return notify('info', 'Nowhere to go back to');
      jumps.current.forward.push(placeNow());
      goTo(place);
    },
    /** ⌥→: forward again. */
    jumpForward() {
      const place = jumps.current.forward.pop();
      if (!place) return notify('info', 'Nowhere to go forward to');
      jumps.current.back.push(placeNow());
      goTo(place);
    },
    compose() {
      const at = activeView.anchorAtCursor();
      if (!at) return notify('info', 'Move to a line to comment on it');
      activeView.setShowComments(true);
      const target =
        surface === 'review' ? targetKey(review.comparison) : 'worktree';
      setOverlay({
        kind: 'compose',
        anchor: at.anchor,
        line: at.line,
        editing: null,
        replyTo: null,
        target,
      });
    },
    /** Answers a GitHub comment in its thread. */
    reply(comment: ReviewComment) {
      if (comment.source !== 'github')
        return notify(
          'info',
          'Replies are for GitHub threads — e edits a note',
        );
      const { filePath, side, lineNumber } = comment;
      setOverlay({
        kind: 'compose',
        anchor: { filePath, side, lineNumber },
        line: null,
        editing: null,
        replyTo: comment,
        target: comment.target,
      });
    },
    toggleResolved(comment: ReviewComment) {
      if (comment.source !== 'github' || !comment.thread)
        return notify('info', 'Only GitHub threads resolve');
      review.setThreadResolved(comment, !comment.resolved);
    },
    editComment(comment: ReviewComment) {
      if (comment.source !== 'local')
        return notify('info', 'GitHub comments are edited on GitHub');
      const { filePath, side, lineNumber } = comment;
      setOverlay({
        kind: 'compose',
        anchor: { filePath, side, lineNumber },
        line: null,
        editing: comment,
        replyTo: null,
        target: comment.target,
      });
    },
    deleteComment(comment: ReviewComment) {
      const onGitHub = comment.source === 'github';
      actions.confirm(
        onGitHub ? 'Delete comment on GitHub' : 'Delete comment',
        `“${comment.body.split('\n')[0] ?? ''}”`,
        'delete',
        () =>
          onGitHub
            ? review.deletePullComment(comment)
            : review.removeComment(comment),
      );
    },
    submitComposer() {
      if (overlay?.kind !== 'compose') return;
      const body = (commentBox.current?.plainText ?? '').trim();
      if (body && overlay.replyTo) {
        review.replyToComment(overlay.replyTo, body);
      } else if (body && overlay.editing) {
        review.updateComment(overlay.editing, body);
        activeView.landOn(stopKey.comment(overlay.editing.id));
      } else if (body) {
        review.addComment({ ...overlay.anchor, body }, overlay.target);
      }
      setOverlay(null);
      setFocus('main');
    },

    fetch: (only?: Repo) =>
      inRepos('Fetch', only, (at) =>
        review.runGit(
          `Fetching${inName(at)}…`,
          () => eachRoot(at, fetchAll),
          (out) => summarize(out, `Fetched${inName(at)}`),
        ),
      ),
    pull: (only?: Repo) =>
      inRepos('Pull', only, (at) =>
        review.runGit(
          `Pulling${inName(at)}…`,
          () => eachRoot(at, pull),
          (out) => summarize(out, `Pulled${inName(at)}`),
        ),
      ),
    push: (only?: Repo) =>
      inRepos('Push', only, (at) =>
        review.runGit(
          `Pushing${inName(at)}…`,
          () => eachRoot(at, push),
          (out) => summarize(out, `Pushed${inName(at)}`),
        ),
      ),

    checkoutBranch(branch: Branch) {
      if (branch.current) return;
      actions.confirm(
        'Check out',
        `Switch the working tree to ${branch.name}?`,
        'check out',
        () => void branches.checkout(branch),
      );
    },
    newBranch(from?: Branch) {
      actions.form(
        from ? `New branch from ‘${from.name}’` : 'New branch',
        [{ key: 'name', label: 'Branch name' }],
        'Create',
        ({ name }) => {
          const slug = branchName(name ?? '');
          if (!slug) return 'Name the branch';
          void branches.create(slug, from?.name);
        },
      );
    },
    renameBranch(branch: Branch) {
      actions.form(
        'Rename branch',
        [{ key: 'name', label: 'New name', initial: branch.name }],
        'Rename',
        ({ name }) => {
          const slug = branchName(name ?? '');
          if (!slug) return 'Name the branch';
          void branches.rename(branch, slug);
        },
      );
    },
    branchMenu(branch: Branch, at: Cell, under?: Overlay) {
      const head = review.repo?.branch ?? 'HEAD';
      actions.openMenu(
        at,
        [
          {
            label: 'Checkout',
            disabled: branch.current,
            run: () => actions.checkoutBranch(branch),
          },
          {
            label: `New branch from ‘${branch.name}’…`,
            run: () => actions.newBranch(branch),
          },
          { separator: true },
          {
            label: `Review ‘${head}’ against ‘${branch.name}’`,
            disabled: branch.current,
            run: () => actions.pickTarget(branch.name, false),
          },
          {
            label: `Merge ‘${branch.name}’ into ‘${head}’`,
            disabled: branch.current,
            run: () =>
              actions.confirm(
                'Merge',
                `Merge ${branch.name} into ${head}?`,
                'merge',
                () => void branches.merge(branch),
              ),
          },
          {
            label: `Rebase ‘${head}’ onto ‘${branch.name}’`,
            disabled: branch.current,
            run: () =>
              actions.confirm(
                'Rebase',
                `Rebase ${head} onto ${branch.name}?`,
                'rebase',
                () => void branches.rebase(branch),
              ),
          },
          { separator: true },
          {
            label: 'Update (fetch)',
            run: () => void actions.fetch(review.focused),
          },
          { label: 'Push', run: () => void actions.push(review.focused) },
          ...(branch.remote
            ? []
            : [
                { separator: true as const },
                { label: 'Rename…', run: () => actions.renameBranch(branch) },
                {
                  label: 'Delete',
                  danger: true,
                  disabled: branch.current,
                  run: () =>
                    actions.confirm(
                      'Delete branch',
                      `Delete ‘${branch.name}’? This cannot be undone.`,
                      'delete',
                      () => void branches.remove(branch),
                    ),
                },
              ]),
        ],
        under,
      );
    },

    addService() {
      actions.form(
        repos.spans ? `New command in ${services.addsTo.name}` : 'New command',
        [
          { key: 'name', label: 'Name', placeholder: 'Frontend' },
          { key: 'command', label: 'Command', placeholder: 'pnpm dev' },
          { key: 'cwd', label: 'Folder', placeholder: 'Repository root' },
        ],
        'Add',
        ({ name, command, cwd }) => {
          if (!name?.trim() || !command?.trim())
            return 'Give it a name and a command';
          return services.add({ name, command, cwd: cwd ?? '' });
        },
      );
    },
    removeService(command: DevCommand) {
      actions.confirm(
        'Remove command',
        `Remove ‘${command.name}’? It is stopped first.`,
        'remove',
        () => services.remove(command.id),
      );
    },
    serviceMenu(command: DevCommand, at: { x: number; y: number }) {
      const running = services.statusOf(command.id) === 'running';
      actions.openMenu(at, [
        ...(running
          ? [
              { label: 'Restart', run: () => services.start(command.id) },
              { label: 'Stop', run: () => services.stop(command.id) },
            ]
          : [
              {
                label:
                  services.statusOf(command.id) === 'exited'
                    ? 'Restart'
                    : 'Start',
                run: () => services.start(command.id),
              },
            ]),
        { separator: true },
        { label: 'Copy command', run: () => actions.copy(command.command) },
        { separator: true },
        {
          label: 'Remove',
          danger: true,
          run: () => actions.removeService(command),
        },
      ]);
    },

    refresh() {
      notify('info', 'Refreshing…');
      void review.refresh();
      if (pulls.loaded) void pulls.reload();
    },
    quit() {
      stopAllSessions();
      renderer.destroy();
      store.close();
      process.exit(0);
    },
    /** Quits into the release installed since launch, opened as this one was. */
    restart() {
      const release = installedRelease();
      if (!release || !update.installed) return;
      stopAllSessions();
      renderer.destroy();
      store.close();
      const next = spawnSync(linkedBinary(release.home), Bun.argv.slice(2), {
        stdio: 'inherit',
      });
      process.exit(next.status ?? 0);
    },
  };
  const latestActions = React.useRef(actions);
  latestActions.current = actions;

  return {
    palette,
    icons,
    themes,
    store,
    screen,
    now,
    review,
    workspace,
    diff,
    editor,
    tree,
    commit,
    history,
    branches,
    services,
    pulls,
    update,
    activeView,
    focus,
    typing,
    captured,
    overlay,
    commentBox,
    searchMemory,
    commitAgent,
    symbols,
    usagePreview,
    /** The terminal reports ⌘ (kitty keyboard protocol). */
    chords,
    commandHeld: () => props.commandKey?.isHeld() ?? false,
    isCommitMode,
    /** The pull request sidebar has the files of the one under review below its list. */
    showsPullFiles,
    pullPart,
    layout: {
      bodyHeight,
      mainLeft,
      mainWidth,
      editorHeight,
      contentTop,
      contentHeight,
      bottomHeight,
      treeHeight,
      pullListHeight,
      pullFilesHeight,
      sidebarWidth,
      usagesListWidth,
      commitBoxHeight,
    },
    actions,
  };

  /** Under the sidebar's chips, or the editor's header when the sidebar is hidden. */
  function chipAnchor(chip: 'branch' | 'target'): Cell {
    if (!workspace.sidebarVisible) return { x: mainLeft, y: contentTop };
    const half = chip === 'target' ? Math.floor(sidebarWidth / 2) : 0;
    return { x: half, y: SIDEBAR_HEADER };
  }

  /** Where the cursor is, to come back to after a jump. */
  function placeNow(): Place {
    return {
      surface,
      path: surface === 'browse' ? editor.active : null,
      key: activeView.stop?.key ?? null,
    };
  }

  /** Records the place a jump leaves from; a new jump drops the forward trail. */
  function rememberPlace() {
    const { back } = jumps.current;
    back.push(placeNow());
    if (back.length > MAX_JUMPS) back.shift();
    jumps.current.forward = [];
  }

  function goTo(place: Place) {
    workspace.setSurface(place.surface);
    if (place.surface === 'browse' && place.path) {
      editor.open(place.path);
      tree.reveal(place.path);
      if (place.key) editor.viewer.landOn(place.key);
    } else if (place.key) {
      diff.landOn(place.key);
    }
    setFocus('main');
  }

  /** The saved workspace open, as the server has it now, or `null` with why not. */
  async function openSavedWorkspace(): Promise<SavedWorkspace | null> {
    const open = repos.workspace;
    if (!open) return null;
    const saved = await asked(() => workspaces.find(open.id));
    if (saved === null) notify('info', `${open.name} is no longer saved`);
    return saved ?? null;
  }

  /** A server call's answer, or `undefined` once its failure is shown. */
  async function asked<TResult>(
    run: () => Promise<TResult>,
  ): Promise<TResult | undefined> {
    try {
      return await run();
    } catch (error) {
      notify('error', error instanceof Error ? error.message : String(error));
      return undefined;
    }
  }

  function absolutePath(path: string): string {
    const at = locate(repos, path);
    return join(at.repo.root, at.path);
  }

  /**
   * Runs a git action in one repository — over a workspace, the one picked
   * from a menu of them, or every one — as the Mac palette asks.
   */
  function inRepos(
    verb: string,
    only: Repo | undefined,
    run: (at: Repo | null) => void,
  ) {
    if (only || !repos.spans) return run(only ?? review.focused);
    actions.openMenu({ x: mainLeft + 2, y: contentTop + 1 }, [
      { label: `${verb} every repository`, run: () => run(null) },
      { separator: true },
      ...repos.list.map((repo) => ({
        label: `${verb} ${repo.name}`,
        hint: review.stateOf(repo)?.info.branch ?? '',
        run: () => run(repo),
      })),
    ]);
  }

  function inName(at: Repo | null): string {
    if (at === null) return ' every repository';
    return repos.spans ? ` ${at.name}` : '';
  }

  /** One repository's output, or every one's in workspace order. */
  async function eachRoot(
    at: Repo | null,
    git: (root: string) => Promise<string>,
  ): Promise<string> {
    if (at) return git(at.root);
    const outputs: string[] = [];
    for (const repo of repos.list) outputs.push(await git(repo.root));
    return outputs.join('\n');
  }

  /** Under the cursor's line, where a menu for it opens. */
  function cursorCell(): Cell {
    const stop = activeView.stop;
    const row = stop ? stop.row - activeView.top + stop.height : 0;
    return {
      x: mainLeft + activeView.layout.geometry.gutter,
      y: contentTop + Math.max(0, row),
    };
  }

  /**
   * The server reads the working tree, so a diff answers for its new side
   * of uncommitted or branch changes, and a whole file (the viewer, the
   * usages preview) for any line.
   */
  function canAskAbout(view: DiffView, line: DiffLine): boolean {
    if (line.kind === 'del' || line.newNo === null) return false;
    const { kind } = review.comparison;
    return view.view === 'file' || (kind !== 'commit' && kind !== 'pull');
  }

  /** Off a pull request that is merged or closed, to where it was opened from. */
  function leavePull() {
    if (review.comparison.kind === 'pull') showComparison(previous);
  }

  /** `at` is the repository a branch, commit or pull request is in: the focused one unless named. */
  function showComparison(
    next: Comparison,
    landOn?: string,
    at: Repo = review.focused,
  ) {
    if (isSameComparison(next, review.comparison) && at === review.focused) {
      if (landOn) diff.landOn(landOn);
      return;
    }
    if (isVisit(next) && !isVisit(review.comparison))
      setPrevious(review.comparison);
    if (landOn) diff.landOn(landOn);
    diff.moveTo(0);
    review.setComparison(next, at);
  }
}

/** A place to come back to: the surface, the open file (Browse) and the cursor's stop. */
interface Place {
  surface: Surface;
  path: string | null;
  key: string | null;
}

const MAX_JUMPS = 100;
const USAGES_LIST_SHARE = 0.42;
const MIN_USAGES_PART = 30;
/** The divider, the tab strip and the usages header above the preview. */
const USAGES_CHROME_ROWS = 3;

function keepUnwrapped() {}

/** Where the layout is kept: the saved workspace's, else the repositories' own. */
function layoutKey(repos: Repos): string {
  if (repos.workspace) return `workspace:${repos.workspace.id}`;
  return repos.list.map((repo) => repo.root).join('\n');
}

/** A commit or pull request opened from elsewhere, which `esc` leaves. */
function isVisit(comparison: Comparison): boolean {
  return comparison.kind === 'commit' || comparison.kind === 'pull';
}

function isSpot(target: SymbolTarget, spot: SymbolSpot): boolean {
  const { path, range } = target.location;
  return path === spot.path && range.start.line === spot.line - 1;
}

/** The agent the Mac app drafts with, until one is chosen here. */
const macCommitAgent = macAgentOrClaude();

function macAgentOrClaude(): CommitAgent {
  const agent = readMacDefault('commit-agent');
  return isCommitAgent(agent) ? agent : 'claude';
}
