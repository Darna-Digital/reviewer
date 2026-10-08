import * as React from 'react';
import { loadUiState, saveUiState } from '../store/uiState';
import type { UiState } from '../store/uiState';

export type Surface = UiState['surface'];
export type BottomTab = UiState['bottomTab'];
export type Workspace = ReturnType<typeof useWorkspace>;

export const BOTTOM_TABS: BottomTab[] = ['history', 'usages', 'run'];

/** Rows outside the body: the bottom rail. */
export const CHROME_ROWS = 1;

const DEFAULT_SIDEBAR_SHARE = 0.24;
const MIN_SIDEBAR = 24;
const MIN_MAIN = 40;
const MIN_BOTTOM = 6;
const MIN_EDITOR = 6;
const MIN_HISTORY_DETAILS = 24;
const MIN_USAGES_LIST = 30;
const DEFAULT_MESSAGE_ROWS = 4;
const MIN_MESSAGE_ROWS = 2;
/** Rows the changes tree keeps however tall the message grows. */
const MIN_TREE_ROWS = 12;
const SAVE_DELAY_MS = 400;

/** Which surface is up, and where the panes sit; restored per repository. */
export function useWorkspace(
  root: string,
  screen: { width: number; height: number },
) {
  const [state, setState] = React.useState(() => loadUiState(root));
  const [sidebarVisible, setSidebarVisible] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => saveUiState(root, state), SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [root, state]);

  const update = (patch: Partial<UiState>) =>
    setState((prev) => ({ ...prev, ...patch }));
  const sidebarWidth = sidebarVisible
    ? clamp(
        state.sidebarWidth ?? Math.round(screen.width * DEFAULT_SIDEBAR_SHARE),
        MIN_SIDEBAR,
        screen.width - MIN_MAIN,
      )
    : 0;
  const bodyHeight = screen.height - CHROME_ROWS;
  const bottomHeight = state.bottomOpen
    ? clamp(
        state.bottomHeight ?? Math.round(bodyHeight * 0.4),
        MIN_BOTTOM,
        bodyHeight - MIN_EDITOR,
      )
    : 0;

  return {
    surface: state.surface,
    setSurface: (surface: Surface) => update({ surface }),
    sidebarVisible,
    toggleSidebar: () => setSidebarVisible((visible) => !visible),
    showSidebar: () => setSidebarVisible(true),
    sidebarWidth,
    resizeSidebar: (width: number) =>
      update({
        sidebarWidth: clamp(width, MIN_SIDEBAR, screen.width - MIN_MAIN),
      }),
    bottomOpen: state.bottomOpen,
    bottomTab: state.bottomTab,
    bottomHeight,
    resizeBottom: (height: number) =>
      update({
        bottomHeight: clamp(height, MIN_BOTTOM, bodyHeight - MIN_EDITOR),
      }),
    toggleBottom: () => update({ bottomOpen: !state.bottomOpen }),
    /** Opens the pane on `tab`, or closes it when that tab is already up. */
    toggleBottomTab: (tab: BottomTab) =>
      update(
        state.bottomOpen && state.bottomTab === tab
          ? { bottomOpen: false }
          : { bottomOpen: true, bottomTab: tab },
      ),
    openBottom: (tab: BottomTab) =>
      update({ bottomOpen: true, bottomTab: tab }),
    commitMessageRows: clamp(
      state.commitMessageRows ?? DEFAULT_MESSAGE_ROWS,
      MIN_MESSAGE_ROWS,
      Math.max(MIN_MESSAGE_ROWS, bodyHeight - MIN_TREE_ROWS),
    ),
    resizeCommitMessage: (rows: number) =>
      update({
        commitMessageRows: clamp(
          rows,
          MIN_MESSAGE_ROWS,
          Math.max(MIN_MESSAGE_ROWS, bodyHeight - MIN_TREE_ROWS),
        ),
      }),
    usagesListWidth: state.usagesListWidth,
    resizeUsagesList: (width: number) =>
      update({ usagesListWidth: Math.max(MIN_USAGES_LIST, width) }),
    historyDetailsWidth: state.historyDetailsWidth,
    resizeHistoryDetails: (width: number) =>
      update({ historyDetailsWidth: Math.max(MIN_HISTORY_DETAILS, width) }),
    fullFiles: state.fullFiles,
    toggleFullFiles: () =>
      setState((prev) => ({ ...prev, fullFiles: !prev.fullFiles })),
    wrap: state.wrap,
    setWrap: (next: React.SetStateAction<boolean>) =>
      setState((prev) => ({
        ...prev,
        wrap: typeof next === 'function' ? next(prev.wrap) : next,
      })),
    commitMessage: state.commitMessage,
    setCommitMessage: (commitMessage: string) => update({ commitMessage }),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
