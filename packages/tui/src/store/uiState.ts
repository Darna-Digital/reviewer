import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname } from 'node:path';

/** Per-repository UI state the TUI restores on the next launch. */
export interface UiState {
  surface: 'browse' | 'review';
  sidebarWidth: number | null;
  bottomOpen: boolean;
  bottomTab: 'history' | 'usages' | 'run';
  bottomHeight: number | null;
  /** The commit details beside the history list. */
  historyDetailsWidth: number | null;
  /** Rows of the commit message field. */
  commitMessageRows: number | null;
  /** The usages tree beside its preview. */
  usagesListWidth: number | null;
  commitMessage: string;
  /** Long lines wrap; off, they scroll sideways. Shared by the diff and the viewer. */
  wrap: boolean;
  /** Diffs show whole files instead of the changed hunks. */
  fullFiles: boolean;
}

const BOTTOM_TABS: string[] = ['history', 'usages', 'run'];

export const DEFAULT_UI_STATE: UiState = {
  surface: 'review',
  sidebarWidth: null,
  bottomOpen: false,
  bottomTab: 'history',
  bottomHeight: null,
  historyDetailsWidth: null,
  usagesListWidth: null,
  commitMessageRows: null,
  commitMessage: '',
  wrap: true,
  fullFiles: false,
};

export function uiStatePath(): string {
  return process.env['REVIEWER_TUI_STATE'] || `${homedir()}/.reviewer/tui.json`;
}

export function loadUiState(root: string, path = uiStatePath()): UiState {
  const state = { ...DEFAULT_UI_STATE, ...readAll(path)[root] };
  return BOTTOM_TABS.includes(state.bottomTab)
    ? state
    : { ...state, bottomTab: DEFAULT_UI_STATE.bottomTab };
}

export function saveUiState(
  root: string,
  state: UiState,
  path = uiStatePath(),
) {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify({ ...readAll(path), [root]: state }, null, 2),
    );
  } catch {
    // losing a layout preference is not worth interrupting the user
  }
}

function readAll(path: string): Record<string, Partial<UiState>> {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<
      string,
      Partial<UiState>
    >;
  } catch {
    return {};
  }
}
