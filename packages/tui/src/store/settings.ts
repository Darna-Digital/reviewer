import type { CommitAgent } from '../git/commitMessage';
import type { Store } from './createStore';

/** The theme that takes the terminal's own colours and background. */
export const TERMINAL_THEME = 'terminal';

export type Appearance = 'system' | 'light' | 'dark';

/** Preferences shared by every repository. */
export interface Settings {
  appearance: Appearance;
  /** A catalog theme name, or `terminal`. */
  lightTheme: string;
  darkTheme: string;
  /** The agent that drafts commit messages; unset follows the Mac app's choice. */
  commitAgent: CommitAgent | null;
  /** File-type icons beside file names; they need a Nerd Font. */
  fileIcons: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  appearance: 'system',
  lightTheme: TERMINAL_THEME,
  darkTheme: TERMINAL_THEME,
  commitAgent: null,
  fileIcons: true,
};

/** Kept in the shared database, `tui_settings`. */
export function loadSettings(store: Store): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...(store.settings() as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(store: Store, settings: Settings) {
  try {
    store.saveSettings(settings);
  } catch {
    // a preference that fails to save is still applied for this session
  }
}
