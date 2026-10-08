import type { TextareaRenderable } from '@opentui/core';
import { useRenderer, useTerminalDimensions } from '@opentui/react';
import type { ReviewComment } from '@reviewer/core/comments';
import type { DevCommand } from '@reviewer/core/local-dev';
import { join } from 'node:path';
import * as React from 'react';
import { stopKey } from '../diff/buildLayout';
import type { Anchor } from '../diff/buildLayout';
import type { DiffLine } from '../diff/parseDiff';
import { discard, fetchAll, pull, push, summarize } from '../git/actions';
import type { GrepOptions } from '../git/files';
import type { Branch } from '../git/refs';
import { stopAllSessions } from '../process/ptySession';
import type { PaletteMode } from '../search/paletteModes';
import type { Store } from '../store/createStore';
import type { TreeNode } from '../tree/fileTree';
import {
  comparisonOf,
  isSameComparison,
  targetKey,
  WORKTREE,
} from './comparison';
import type { Comparison } from './comparison';
import { useBranches } from './useBranches';
import { useCommit } from './useCommit';
import { useDiffView } from './useDiffView';
import { useEditor } from './useEditor';
import { useHistory } from './useHistory';
import { useReview } from './useReview';
import { useServer } from './useServer';
import { useServices } from './useServices';
import { useTheme } from './useTheme';
import type { ThemeStart } from './useTheme';
import { useTree } from './useTree';
import { useWorkspace } from './useWorkspace';
import type { BottomTab, Surface } from './useWorkspace';

export type Focus = 'sidebar' | 'main' | 'bottom';
export type Typing = 'message' | 'treeFilter' | 'historyFilter' | null;
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
  | { kind: 'commentsHere'; at: Cell }
  | {
      kind: 'compose';
      anchor: Anchor;
      line: DiffLine | null;
      editing: ReviewComment | null;
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

export interface AppProps {
  root: string;
  store: Store;
  themeStart: ThemeStart;
  initial: Comparison;
  /** Start the Reviewer server when none answers (off in snapshots). */
  startServer?: boolean;
}

export type App = ReturnType<typeof useApp>;

export const COMPOSER_HEIGHT = 6;
export const NOTICE_MS = 4000;
export const SIDEBAR_HEADER = 1;
export const COMMIT_BOX_HEIGHT = 7;
const CLOCK_MS = 30_000;
/** How long history scrolling rests before the commit under it opens. */
const HISTORY_SETTLE_MS = 120;

/** Composes every part of the screen and owns the actions that span them. */
export function useApp(props: AppProps) {
  const { root, store } = props;
  const renderer = useRenderer();
  const themes = useTheme(renderer, props.themeStart);
  const { palette, theme, themeName } = themes.look;
  const screen = useTerminalDimensions();
  const workspace = useWorkspace(root, screen);
  const review = useReview(
    root,
    store,
    props.initial,
    workspace.fullFiles ? 'full' : 'hunks',
  );
  useServer(review, props.startServer ?? false);
  const [now, setNow] = React.useState(Date.now);
  const [focus, setFocusState] = React.useState<Focus>('main');
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

  // geometry
  const bodyHeight = Math.max(6, screen.height - 2);
  const sidebarWidth = workspace.sidebarWidth;
  const mainLeft = workspace.sidebarVisible ? sidebarWidth + 1 : 0;
  const mainWidth = Math.max(20, screen.width - mainLeft);
  const bottomHeight = workspace.bottomOpen
    ? Math.min(workspace.bottomHeight, bodyHeight - 4)
    : 0;
  const editorHeight = bodyHeight - bottomHeight;
  const contentTop = 2;
  const contentHeight = Math.max(1, editorHeight - 1);
  const treeHeight = Math.max(
    1,
    bodyHeight -
      SIDEBAR_HEADER -
      (surface === 'review' ? 1 : 0) -
      (isCommitMode ? COMMIT_BOX_HEIGHT : 0),
  );

  const mainFocused = focus === 'main' && !overlay;
  const diff = useDiffView({
    files: review.files,
    comments: review.visibleComments,
    width: mainWidth,
    height: contentHeight,
    palette,
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
    theme,
    themeName,
    focused: mainFocused && surface === 'browse',
    now,
    wrap: workspace.wrap,
    setWrap: workspace.setWrap,
  });
  // the review tree follows the diff cursor unless the sidebar has the keyboard
  const diffFile = diff.stop ? review.files[diff.stop.file]?.path : undefined;
  const tree = useTree(
    surface,
    review,
    focus === 'sidebar' ? undefined : diffFile,
  );
  const commit = useCommit(review, workspace);
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
    if (next === 'sidebar' && surface === 'review' && diffFile)
      tree.select(diffFile);
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
      const order: Focus[] = [
        ...(workspace.sidebarVisible ? (['sidebar'] as const) : []),
        'main',
        ...(workspace.bottomOpen ? (['bottom'] as const) : []),
      ];
      const index = order.indexOf(focus);
      setFocus(order[(index + step + order.length) % order.length]!);
    },
    /** Browse leaves a commit opened from history, as the Mac trail does. */
    setSurface(next: Surface) {
      if (next === 'browse' && review.comparison.kind === 'commit')
        showComparison(previous);
      workspace.setSurface(next);
      setFocus('main');
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
    /** The branch popover, hanging from `at` or the sidebar's branch chip. */
    openBranches: (at?: Cell) =>
      setOverlay({ kind: 'branches', at: at ?? chipAnchor('branch') }),
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
      workspace.setSurface('browse');
      editor.open(path, opts);
      tree.reveal(path);
      if (opts.line)
        editor.viewer.landOn(`L:${path}:${opts.line}:${opts.line}`);
    },
    showInDiff(path: string) {
      workspace.setSurface('review');
      const index = review.files.findIndex((file) => file.path === path);
      if (index !== -1) diff.jumpToFile(index);
    },
    openTreeNode(node: TreeNode, { preview = false } = {}) {
      if (node.kind === 'dir') return tree.setOpen(node, !tree.isOpen(node));
      if (surface === 'browse') actions.openFile(node.path, { preview });
      else actions.showInDiff(node.path);
      if (!preview) setFocus('main');
    },
    treeMenu(node: TreeNode, at: { x: number; y: number }) {
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
          run: () => actions.copy(join(root, node.path)),
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
            () => discard(root, paths),
            () => `Discarded ${node.name}`,
          ),
      );
    },
    copy(text: string) {
      renderer.copyToClipboardOSC52(text);
      notify('success', `Copied ${text}`);
    },
    showHistoryFor(path: string | null) {
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
    /** Leaves a commit for the change it was opened from. */
    back() {
      if (review.comparison.kind === 'commit') showComparison(previous);
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
        return notify('info', 'Pull request comments open in the Reviewer app');
      workspace.setSurface('review');
      diff.setShowComments(true);
      diff.unfold(comment.filePath);
      showComparison(target, stopKey.comment(comment.id));
      setFocus('main');
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
        target,
      });
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
        target: comment.target,
      });
    },
    deleteComment(comment: ReviewComment) {
      if (comment.source !== 'local')
        return notify('info', 'GitHub comments are resolved on GitHub');
      actions.confirm(
        'Delete comment',
        `“${comment.body.split('\n')[0] ?? ''}”`,
        'delete',
        () => review.removeComment(comment.id),
      );
    },
    submitComposer() {
      if (overlay?.kind !== 'compose') return;
      const body = (commentBox.current?.plainText ?? '').trim();
      if (body && overlay.editing) {
        review.updateComment(overlay.editing.id, body);
        activeView.landOn(stopKey.comment(overlay.editing.id));
      } else if (body) {
        review.addComment({ ...overlay.anchor, body }, overlay.target);
      }
      setOverlay(null);
      setFocus('main');
    },

    fetch: () =>
      review.runGit(
        'Fetching…',
        () => fetchAll(root),
        (out) => summarize(out, 'Fetched'),
      ),
    pull: () =>
      review.runGit(
        'Pulling…',
        () => pull(root),
        (out) => summarize(out, 'Pulled'),
      ),
    push: () =>
      review.runGit(
        'Pushing…',
        () => push(root),
        (out) => summarize(out, 'Pushed'),
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
          if (!name?.trim()) return 'Name the branch';
          void branches.create(name.trim(), from?.name);
        },
      );
    },
    renameBranch(branch: Branch) {
      actions.form(
        'Rename branch',
        [{ key: 'name', label: 'New name', initial: branch.name }],
        'Rename',
        ({ name }) => {
          if (!name?.trim()) return 'Name the branch';
          void branches.rename(branch, name.trim());
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
          { label: 'Update (fetch)', run: () => void actions.fetch() },
          { label: 'Push', run: () => void actions.push() },
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
        'New command',
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
    },
    quit() {
      stopAllSessions();
      renderer.destroy();
      store.close();
      process.exit(0);
    },
  };
  const latestActions = React.useRef(actions);
  latestActions.current = actions;

  return {
    palette,
    themes,
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
    activeView,
    focus,
    typing,
    captured,
    overlay,
    commentBox,
    searchMemory,
    /** The terminal reports ⌘ (kitty keyboard protocol). */
    chords,
    isCommitMode,
    layout: {
      bodyHeight,
      mainLeft,
      mainWidth,
      editorHeight,
      contentTop,
      contentHeight,
      bottomHeight,
      treeHeight,
      sidebarWidth,
    },
    actions,
  };

  /** Under the sidebar's chips, or the editor's header when the sidebar is hidden. */
  function chipAnchor(chip: 'branch' | 'target'): Cell {
    if (!workspace.sidebarVisible) return { x: mainLeft, y: 2 };
    const half = chip === 'target' ? Math.floor(sidebarWidth / 2) : 0;
    return { x: half, y: 2 };
  }

  function showComparison(next: Comparison, landOn?: string) {
    if (isSameComparison(next, review.comparison)) {
      if (landOn) diff.landOn(landOn);
      return;
    }
    if (next.kind === 'commit' && review.comparison.kind !== 'commit')
      setPrevious(review.comparison);
    if (landOn) diff.landOn(landOn);
    diff.moveTo(0);
    review.setComparison(next);
  }
}
