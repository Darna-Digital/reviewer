import type { TextareaRenderable } from '@opentui/core';
import { useRenderer, useTerminalDimensions } from '@opentui/react';
import type { ReviewComment } from '@reviewer/core/comments';
import type { DevCommand } from '@reviewer/core/local-dev';
import { join } from 'node:path';
import * as React from 'react';
import { stopKey } from '../diff/buildLayout';
import type { Anchor } from '../diff/buildLayout';
import type { CodePoint } from '../diff/codeAt';
import type { DiffLine } from '../diff/parseDiff';
import { discard, fetchAll, pull, push, summarize } from '../git/actions';
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
import { stopAllSessions } from '../process/ptySession';
import { fileIcons } from '../render/fileIcons';
import type { PaletteMode } from '../search/paletteModes';
import type { Store } from '../store/createStore';
import { readMacDefault } from '../store/macDefaults';
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
import { useReview } from './useReview';
import { useServer } from './useServer';
import { useServices } from './useServices';
import { useSymbols } from './useSymbols';
import type { SymbolSpot } from './useSymbols';
import { useTheme } from './useTheme';
import type { ThemeStart } from './useTheme';
import { useTree } from './useTree';
import { CHROME_ROWS, useWorkspace } from './useWorkspace';
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
  | { kind: 'definitions'; at: Cell; symbol: string; targets: SymbolTarget[] }
  | { kind: 'lineSymbols'; at: Cell; spots: SymbolSpot[] }
  | { kind: 'outline'; path: string; symbols: DocumentSymbol[] }
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
/** How long history scrolling rests before the commit under it opens. */
const HISTORY_SETTLE_MS = 120;

/** Composes every part of the screen and owns the actions that span them. */
export function useApp(props: AppProps) {
  const { root, store } = props;
  const renderer = useRenderer();
  const themes = useTheme(renderer, props.themeStart);
  const { palette, theme, themeName } = themes.look;
  const icons = React.useMemo(
    () => fileIcons(palette, themes.settings.fileIcons),
    [palette, themes.settings.fileIcons],
  );
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
  // unless the sidebar has the keyboard
  const shownFile =
    surface === 'review' ? diffFile : (editor.active ?? undefined);
  const tree = useTree(
    surface,
    review,
    focus === 'sidebar' ? undefined : shownFile,
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
    icons,
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
    commitAgent,
    symbols,
    usagePreview,
    /** The terminal reports ⌘ (kitty keyboard protocol). */
    chords,
    commandHeld: () => props.commandKey?.isHeld() ?? false,
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
    return view.view === 'file' || review.comparison.kind !== 'commit';
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
