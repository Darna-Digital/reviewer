import type { TextareaRenderable } from '@opentui/core';
import { useRenderer, useTerminalDimensions } from '@opentui/react';
import type { ReviewComment } from '@reviewer/core/comments';
import * as React from 'react';
import { stopKey } from '../diff/buildLayout';
import type { Anchor } from '../diff/buildLayout';
import type { Theme } from '../diff/highlight';
import type { DiffLine } from '../diff/parseDiff';
import type { Branch } from '../git/refs';
import { commitBanner } from '../render/commitBanner';
import type { Palette } from '../render/palette';
import type { ListItem } from '../render/sidebarItems';
import type { Store } from '../store/createStore';
import { comparisonOf, isSameComparison, WORKTREE } from './comparison';
import type { Comparison } from './comparison';
import { useDiffView } from './useDiffView';
import { useReview } from './useReview';
import { useSidebarLayout, useSidebarList } from './useSidebar';
import type { Tab } from './useSidebar';

export type Focus = 'sidebar' | 'diff';

export type Overlay =
  | { kind: 'help' }
  | { kind: 'targets' }
  | { kind: 'files' }
  | {
      kind: 'compose';
      anchor: Anchor;
      line: DiffLine | null;
      editing: ReviewComment | null;
    }
  | {
      kind: 'confirm';
      title: string;
      detail: string;
      confirmLabel: string;
      run: () => void;
    };

export interface AppProps {
  root: string;
  store: Store;
  palette: Palette;
  theme: Theme;
  themeName: string;
  initial: Comparison;
}

export type App = ReturnType<typeof useApp>;

export const COMPOSER_HEIGHT = 8;
const CLOCK_MS = 30_000;
export const NOTICE_MS = 4000;

/** Wires the data, the diff view and the sidebar together, and owns the actions. */
export function useApp(props: AppProps) {
  const { root, store, palette } = props;
  const renderer = useRenderer();
  const screen = useTerminalDimensions();
  const review = useReview(root, store, props.initial);
  const [now, setNow] = React.useState(Date.now);
  const [focus, setFocus] = React.useState<Focus>('diff');
  const [overlay, setOverlay] = React.useState<Overlay | null>(null);
  const [previous, setPrevious] = React.useState<Comparison>(WORKTREE);
  const textarea = React.useRef<TextareaRenderable | null>(null);

  React.useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(clock);
  }, []);

  // redraw once a notice has expired so the status bar drops it
  React.useEffect(() => {
    if (!review.notice) return;
    const expire = setTimeout(() => setNow(Date.now()), NOTICE_MS + 50);
    return () => clearTimeout(expire);
  }, [review.notice]);

  const sidebar = useSidebarLayout(screen.width);
  const bodyHeight = Math.max(
    4,
    screen.height - 2 - (overlay?.kind === 'compose' ? COMPOSER_HEIGHT : 0),
  );
  const diffWidth = Math.max(
    20,
    screen.width - sidebar.width - (sidebar.visible ? 1 : 0),
  );
  const banner =
    review.comparison.kind === 'commit' && review.commit
      ? commitBanner(palette, review.commit, diffWidth, now)
      : [];

  const diff = useDiffView({
    files: review.files,
    comments: review.visibleComments,
    width: diffWidth,
    height: Math.max(1, bodyHeight - banner.length),
    palette,
    theme: props.theme,
    themeName: props.themeName,
    focused: focus === 'diff' && !overlay,
    now,
  });
  const list = useSidebarList({ tab: sidebar.tab, palette, review, diff, now });

  const actions = {
    focusSidebar(tab?: Tab) {
      if (tab) sidebar.setTab(tab);
      sidebar.setVisible(true);
      setFocus('sidebar');
    },
    toggleFocus() {
      sidebar.setVisible(true);
      setFocus((f) => (f === 'diff' ? 'sidebar' : 'diff'));
    },
    toggleSidebar() {
      sidebar.setVisible((visible) => !visible);
      setFocus('diff');
    },
    showComparison,
    /** `T`: flips between the uncommitted work and the last branch read against. */
    toggleTarget() {
      const { comparison, recent, aim, defaultBranch } = review;
      if (comparison.kind !== 'worktree') return showComparison(WORKTREE);
      const ref = recent[0] ?? aim ?? defaultBranch;
      if (ref) showComparison({ kind: 'branch', against: ref });
      else review.notify('info', 'No branch to compare against yet — press t');
    },
    pickTarget(ref: string | null, remember: boolean) {
      showComparison(ref ? { kind: 'branch', against: ref } : WORKTREE);
      if (remember && review.repo?.branch) {
        review.setAim(ref);
        review.notify(
          'success',
          ref
            ? `${review.repo.branch} now targets ${ref}`
            : `Cleared the target of ${review.repo.branch}`,
        );
      }
      sidebar.setTab('files');
      setFocus('diff');
    },
    setAimToSelection() {
      const branch = list.selectedItem?.branch;
      if (!branch || !review.repo?.branch) return;
      review.setAim(branch.name);
      review.notify(
        'success',
        `${review.repo.branch} now targets ${branch.name}`,
      );
    },
    openOverlay: (next: Overlay) => setOverlay(next),
    closeOverlay: () => setOverlay(null),
    selectItem,
    stepSelection(delta: number) {
      const index = list.step(delta);
      if (index !== undefined) selectItem(index);
    },
    activate,
    compose,
    editComment,
    deleteComment,
    submitComposer,
    confirmCheckout(branch: Branch) {
      if (branch.current) return;
      setOverlay({
        kind: 'confirm',
        title: 'Check out',
        detail: `Switch the working tree to ${branch.name}?`,
        confirmLabel: 'check out',
        run: () => void review.checkout(branch),
      });
    },
    back() {
      if (review.comparison.kind === 'commit') showComparison(previous);
    },
    refresh() {
      review.notify('info', 'Refreshing…');
      void review.refresh();
    },
    quit() {
      renderer.destroy();
      store.close();
      process.exit(0);
    },
  };

  return {
    palette,
    screen,
    now,
    review,
    diff,
    sidebar,
    list,
    focus,
    setFocus,
    overlay,
    textarea,
    banner,
    bodyHeight,
    diffWidth,
    actions,
  };

  function showComparison(next: Comparison, landOn?: string) {
    if (isSameComparison(next, review.comparison)) {
      if (landOn) diff.landOn(landOn);
      return;
    }
    if (next.kind === 'commit' && review.comparison.kind !== 'commit') {
      setPrevious(review.comparison);
    }
    if (landOn) diff.landOn(landOn);
    diff.moveTo(0);
    review.setComparison(next);
  }

  function selectItem(index: number): ListItem | undefined {
    const item = list.select(index);
    if (item?.file !== undefined) diff.jumpToFile(item.file);
    return item;
  }

  /** Enter or double-click on a list item. */
  function activate(item: ListItem | undefined = list.selectedItem) {
    if (!item) return;
    if (item.file !== undefined) {
      diff.jumpToFile(item.file);
      setFocus('diff');
    } else if (item.branch) {
      actions.pickTarget(item.branch.name, false);
    } else if (item.commit) {
      showComparison({ kind: 'commit', sha: item.commit.sha });
      setFocus('diff');
    } else if (item.comment) {
      openComment(item.comment);
    }
  }

  function openComment(comment: ReviewComment) {
    const target = comparisonOf(comment.target);
    if (!target) {
      review.notify('info', 'Pull request comments open in the Reviewer app');
      return;
    }
    diff.setShowComments(true);
    diff.unfold(comment.filePath);
    showComparison(target, stopKey.comment(comment.id));
    setFocus('diff');
  }

  function compose() {
    const at = diff.anchorAtCursor();
    if (!at) {
      review.notify('info', 'Move to a line to comment on it');
      return;
    }
    diff.setShowComments(true);
    setOverlay({
      kind: 'compose',
      anchor: at.anchor,
      line: at.line,
      editing: null,
    });
  }

  function editComment(comment: ReviewComment) {
    if (comment.source !== 'local') {
      review.notify('info', 'GitHub comments are edited on GitHub');
      return;
    }
    const { filePath, side, lineNumber } = comment;
    setOverlay({
      kind: 'compose',
      anchor: { filePath, side, lineNumber },
      line: null,
      editing: comment,
    });
  }

  function deleteComment(comment: ReviewComment) {
    if (comment.source !== 'local') {
      review.notify('info', 'GitHub comments are resolved on GitHub');
      return;
    }
    setOverlay({
      kind: 'confirm',
      title: 'Delete comment',
      detail: `“${comment.body.split('\n')[0] ?? ''}”`,
      confirmLabel: 'delete',
      run: () => review.removeComment(comment.id),
    });
  }

  function submitComposer() {
    if (overlay?.kind !== 'compose') return;
    const body = (textarea.current?.plainText ?? '').trim();
    if (body && overlay.editing) {
      review.updateComment(overlay.editing.id, body);
      diff.landOn(stopKey.comment(overlay.editing.id));
    } else if (body) {
      review.addComment({ ...overlay.anchor, body });
    }
    setOverlay(null);
    setFocus('diff');
  }
}
