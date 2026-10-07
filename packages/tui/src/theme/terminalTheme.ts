import type { TerminalColors } from '@opentui/core';
import type { deriveChromeTokens } from '@reviewer/core/themes';

export type Scheme = 'light' | 'dark';
type ThemeLike = Parameters<typeof deriveChromeTokens>[0];

/** The terminal's ANSI slots a palette borrows. */
export interface AnsiColors {
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
}

/** What the terminal reported, or `null` when it answers no colour queries. */
export interface TerminalLook {
  background: string;
  foreground: string;
  ansi: AnsiColors | null;
}

export function terminalLook(
  colors: TerminalColors | null,
): TerminalLook | null {
  const background = colors?.defaultBackground;
  const foreground = colors?.defaultForeground;
  if (!background || !foreground) return null;
  const [, red, green, yellow, blue, magenta, cyan] = colors.palette;
  const ansi =
    red && green && yellow && blue && magenta && cyan
      ? { red, green, yellow, blue, magenta, cyan }
      : null;
  return { background, foreground, ansi };
}

export function schemeOf(background: string): Scheme {
  const raw = background.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(raw.slice(at, at + 2), 16));
  return (r! * 299 + g! * 587 + b! * 114) / 1000 > 128 ? 'light' : 'dark';
}

/** The terminal's colours dressed as a VS Code theme, so core derives the chrome. */
export function terminalThemeLike(look: TerminalLook): ThemeLike {
  const { background, foreground, ansi } = look;
  return {
    name: 'terminal',
    type: schemeOf(background),
    bg: background,
    fg: foreground,
    colors: {
      'editor.background': background,
      'editor.foreground': foreground,
      ...(ansi
        ? {
            focusBorder: ansi.blue,
            'gitDecoration.addedResourceForeground': ansi.green,
            'gitDecoration.modifiedResourceForeground': ansi.blue,
            'gitDecoration.deletedResourceForeground': ansi.red,
          }
        : {}),
    },
  };
}
