import * as React from 'react';
import type { Palette } from '../render/palette';
import {
  branchItems,
  commentItems,
  fileItems,
  historyItems,
} from '../render/sidebarItems';
import type { ListItem } from '../render/sidebarItems';
import { targetKey } from './comparison';
import type { DiffView } from './useDiffView';
import type { Review } from './useReview';

export type Tab = 'files' | 'branches' | 'history' | 'comments';
export type SidebarLayout = ReturnType<typeof useSidebarLayout>;
export type SidebarList = ReturnType<typeof useSidebarList>;

export const TABS: Tab[] = ['files', 'branches', 'history', 'comments'];

/** Share of the screen each tab wants until the divider is dragged. */
const TAB_SHARE: Record<Tab, number> = {
  files: 0.26,
  branches: 0.3,
  history: 0.42,
  comments: 0.32,
};
const MIN_WIDTH = 24;
const MIN_DIFF_WIDTH = 40;

/** Which tab is open and how wide the sidebar is. */
export function useSidebarLayout(screenWidth: number) {
  const [tab, setTab] = React.useState<Tab>('files');
  const [visible, setVisible] = React.useState(true);
  const [dragWidth, setDragWidth] = React.useState<number | null>(null);
  const clampWidth = (width: number) =>
    Math.max(MIN_WIDTH, Math.min(width, screenWidth - MIN_DIFF_WIDTH));

  return {
    tab,
    setTab,
    visible,
    setVisible,
    width: visible
      ? clampWidth(dragWidth ?? Math.round(screenWidth * TAB_SHARE[tab]))
      : 0,
    resize: (width: number) => setDragWidth(clampWidth(width)),
  };
}

interface SidebarListOptions {
  tab: Tab;
  palette: Palette;
  review: Review;
  diff: Pick<DiffView, 'stop' | 'commentsIn'>;
  now: number;
}

/** The open tab's items and its selection, remembered per tab by item key. */
export function useSidebarList(opts: SidebarListOptions) {
  const { tab, palette, review, diff, now } = opts;
  const { comparison } = review;
  const [selection, setSelection] = React.useState<Record<Tab, string | null>>({
    files: null,
    branches: null,
    history: null,
    comments: null,
  });

  const items = React.useMemo((): ListItem[] => {
    switch (tab) {
      case 'files':
        return fileItems(palette, review.files, diff.commentsIn);
      case 'branches':
        return branchItems(
          palette,
          review.branches,
          {
            compared: comparison.kind === 'branch' ? comparison.against : null,
            aim: review.aim,
          },
          now,
        );
      case 'history':
        return historyItems(
          palette,
          review.log,
          comparison.kind === 'commit' ? comparison.sha : null,
          now,
        );
      case 'comments':
        return commentItems(
          palette,
          review.comments,
          targetKey(comparison),
          now,
        );
    }
  }, [
    tab,
    palette,
    review.files,
    review.branches,
    review.log,
    review.comments,
    review.aim,
    comparison,
    diff.commentsIn,
    now,
  ]);

  const selectable = React.useMemo(
    () => items.flatMap((item, index) => (item.selectable ? [index] : [])),
    [items],
  );

  // the files list follows the diff cursor
  const selected =
    tab === 'files' && diff.stop
      ? items.findIndex((item) => item.file === diff.stop?.file)
      : rememberedOrFirst();

  return {
    items,
    selected,
    selectedItem: items[selected],
    /** Remembers `index` as the tab's selection. */
    select(index: number): ListItem | undefined {
      const item = items[index];
      if (!item?.selectable) return undefined;
      setSelection((all) => ({ ...all, [tab]: item.key }));
      return item;
    },
    /** Index of the selectable item `delta` steps from the selection. */
    step(delta: number): number | undefined {
      if (selectable.length === 0) return undefined;
      const at = Math.max(0, selectable.indexOf(selected));
      return selectable[
        Math.max(0, Math.min(selectable.length - 1, at + delta))
      ];
    },
  };

  function rememberedOrFirst(): number {
    const index = items.findIndex((item) => item.key === selection[tab]);
    return index !== -1 && items[index]!.selectable
      ? index
      : (selectable[0] ?? -1);
  }
}
