import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname } from 'node:path';

/** The theme that takes the terminal's own colours and background. */
export const TERMINAL_THEME = 'terminal';

export type Appearance = 'system' | 'light' | 'dark';

/** Preferences shared by every repository. */
export interface Settings {
  appearance: Appearance;
  /** A catalog theme name, or `terminal`. */
  lightTheme: string;
  darkTheme: string;
}

export const DEFAULT_SETTINGS: Settings = {
  appearance: 'system',
  lightTheme: TERMINAL_THEME,
  darkTheme: TERMINAL_THEME,
};

export function settingsPath(): string {
  return (
    process.env['REVIEWER_TUI_SETTINGS'] ||
    `${homedir()}/.reviewer/tui-settings.json`
  );
}

export function loadSettings(path = settingsPath()): Settings {
  try {
    const saved = JSON.parse(readFileSync(path, 'utf8')) as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...saved };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings, path = settingsPath()) {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(settings, null, 2));
  } catch {
    // a preference that fails to save is still applied for this session
  }
}
