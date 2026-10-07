import {
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  deriveChromeTokens,
  findTheme,
  loadTheme,
} from '@reviewer/core/themes';
import type { Theme } from '../diff/highlight';
import { createPalette } from '../render/palette';
import type { Palette } from '../render/palette';
import { TERMINAL_THEME } from '../store/settings';
import type { Settings } from '../store/settings';
import { schemeOf, terminalThemeLike } from './terminalTheme';
import type { Scheme, TerminalLook } from './terminalTheme';

/** Everything a frame is painted with. */
export interface Look {
  /** The chosen theme: a catalog name or `terminal`. */
  name: string;
  palette: Palette;
  /** The catalog theme code is highlighted with. */
  theme: Theme;
  themeName: string;
}

export interface LookInputs {
  settings: Settings;
  system: Scheme | null;
  terminal: TerminalLook | null;
  /** `--theme` on the command line: wins over the settings for this run. */
  override?: string;
}

/** The scheme the appearance asks for. */
export function wantedScheme(inputs: LookInputs): Scheme {
  const { appearance } = inputs.settings;
  if (appearance !== 'system') return appearance;
  return (
    inputs.system ??
    (inputs.terminal ? schemeOf(inputs.terminal.background) : 'dark')
  );
}

/** Which theme applies right now: the scheme's choice, or the override. */
export function chosenTheme(inputs: LookInputs): string {
  if (inputs.override) return inputs.override;
  const scheme = wantedScheme(inputs);
  return scheme === 'dark'
    ? inputs.settings.darkTheme
    : inputs.settings.lightTheme;
}

export async function resolveLook(inputs: LookInputs): Promise<Look> {
  const name = chosenTheme(inputs);
  if (name === TERMINAL_THEME) return terminalLookFor(inputs);
  const scheme = wantedScheme(inputs);
  const themeName = findTheme(name) ? name : defaultFor(scheme);
  const theme = await loadTheme(themeName)!;
  return {
    name,
    palette: createPalette(deriveChromeTokens(theme)),
    theme,
    themeName,
  };
}

/**
 * The terminal's background and colours. Code keeps the catalog default for
 * the terminal's scheme; a terminal that answers no colour queries still
 * gets its background, under the default theme for the wanted scheme.
 */
async function terminalLookFor(inputs: LookInputs): Promise<Look> {
  const { terminal } = inputs;
  const scheme = terminal
    ? schemeOf(terminal.background)
    : wantedScheme(inputs);
  const themeName = defaultFor(scheme);
  const theme = await loadTheme(themeName)!;
  const chrome = deriveChromeTokens(
    terminal ? terminalThemeLike(terminal) : theme,
  );
  return {
    name: TERMINAL_THEME,
    palette: createPalette(chrome, {
      transparent: true,
      ansi: terminal?.ansi,
    }),
    theme,
    themeName,
  };
}

function defaultFor(scheme: Scheme): string {
  return scheme === 'dark' ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;
}
