import type { Store } from './createStore';

/** Per-repository UI state the TUI restores on the next launch. */
export interface UiState {
  surface: 'browse' | 'review';
  /** On Review, the sidebar lists the changed files or the open pull requests. */
  sidebarList: 'files' | 'pulls';
  sidebarWidth: number | null;
  bottomOpen: boolean;
  bottomTab: 'history' | 'usages' | 'run' | 'pull';
  bottomHeight: number | null;
  /** The commit details beside the history list. */
  historyDetailsWidth: number | null;
  /** Rows of the commit message field. */
  commitMessageRows: number | null;
  /** The usages tree beside its preview. */
  usagesListWidth: number | null;
  /** Rows of the pull request list above the files of the one under review. */
  pullListRows: number | null;
  commitMessage: string;
  /** Long lines wrap; off, they scroll sideways. Shared by the diff and the viewer. */
  wrap: boolean;
  /** Diffs show whole files instead of the changed hunks. */
  fullFiles: boolean;
}

const BOTTOM_TABS: string[] = ['history', 'usages', 'run', 'pull'];

export const DEFAULT_UI_STATE: UiState = {
  surface: 'review',
  sidebarList: 'files',
  sidebarWidth: null,
  bottomOpen: false,
  bottomTab: 'history',
  bottomHeight: null,
  historyDetailsWidth: null,
  usagesListWidth: null,
  pullListRows: null,
  commitMessageRows: null,
  commitMessage: '',
  wrap: true,
  fullFiles: false,
};

/** Kept per repository in the shared database, `tui_ui_state`. */
export function loadUiState(store: Store, root: string): UiState {
  const state = { ...DEFAULT_UI_STATE, ...saved(store, root) };
  return BOTTOM_TABS.includes(state.bottomTab)
    ? state
    : { ...state, bottomTab: DEFAULT_UI_STATE.bottomTab };
}

export function saveUiState(store: Store, root: string, state: UiState) {
  try {
    store.saveUiState(root, state);
  } catch {
    // losing a layout preference is not worth interrupting the user
  }
}

function saved(store: Store, root: string): Partial<UiState> {
  try {
    return store.uiState(root) ?? {};
  } catch {
    return {};
  }
}
