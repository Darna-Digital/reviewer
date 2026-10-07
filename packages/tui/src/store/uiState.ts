import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname } from 'node:path';

/** Per-repository UI state the TUI restores on the next launch. */
export interface UiState {
  surface: 'browse' | 'review';
  sidebarWidth: number | null;
  bottomOpen: boolean;
  bottomTab: 'branches' | 'history' | 'terminal' | 'run';
  bottomHeight: number | null;
  commitMessage: string;
}

export const DEFAULT_UI_STATE: UiState = {
  surface: 'review',
  sidebarWidth: null,
  bottomOpen: false,
  bottomTab: 'branches',
  bottomHeight: null,
  commitMessage: '',
};

export function uiStatePath(): string {
  return process.env['REVIEWER_TUI_STATE'] || `${homedir()}/.reviewer/tui.json`;
}

export function loadUiState(root: string, path = uiStatePath()): UiState {
  return { ...DEFAULT_UI_STATE, ...readAll(path)[root] };
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
