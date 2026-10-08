import {
  EXTRA_BY_EXTENSION,
  EXTRA_BY_FILE_NAME,
  FOLDER_GLYPH,
  TOKEN_GLYPHS,
} from './fileIconGlyphs';
import {
  BY_EXTENSION,
  BY_FILE_NAME,
  EXTENSION_OVERRIDES,
  HUES,
  TOKEN_HUES,
} from './fileIconRules.generated';
import type { HueName } from './fileIconRules.generated';
import type { Palette } from './palette';
import type { Seg } from './styled';

export interface FileIcon {
  glyph: string;
  hue: HueName;
}

/** Draws file-type icons, or nothing when they are turned off. */
export interface FileIcons {
  /** `tint` paints the glyph in a git-status colour instead of its own hue. */
  file: (path: string, bg?: string, tint?: string) => Seg[];
  folder: (open: boolean, bg?: string) => Seg[];
}

export const NO_ICONS: FileIcons = {
  file: () => [],
  folder: () => [],
};

export function fileIcons(palette: Palette, enabled: boolean): FileIcons {
  if (!enabled) return NO_ICONS;
  const shade = palette.scheme === 'dark' ? 1 : 0;
  return {
    file: (path, bg, tint) => {
      const icon = resolveFileIcon(path);
      return [
        { text: `${icon.glyph} `, fg: tint ?? HUES[icon.hue][shade], bg },
      ];
    },
    folder: (open, bg) => [
      {
        text: `${open ? FOLDER_GLYPH.open : FOLDER_GLYPH.closed} `,
        fg: palette.muted,
        bg,
      },
    ],
  };
}

const resolved = new Map<string, FileIcon>();

/**
 * The Mac tree's pick: the whole name, then each extension longest first
 * (`d.ts` before `ts`), then the plain document.
 */
export function resolveFileIcon(path: string): FileIcon {
  const name = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
  let icon = resolved.get(name);
  if (!icon) {
    icon = pick(name);
    resolved.set(name, icon);
  }
  return icon;
}

function pick(name: string): FileIcon {
  const byName = BY_FILE_NAME[name];
  if (byName) return tokenIcon(byName);
  const extraByName = EXTRA_BY_FILE_NAME[name];
  if (extraByName) return extraByName;
  const segments = name.split('.');
  for (let start = 1; start < segments.length; start += 1) {
    const candidate = segments.slice(start).join('.');
    const token = EXTENSION_OVERRIDES[candidate] ?? BY_EXTENSION[candidate];
    if (token) return tokenIcon(token);
    const extra = EXTRA_BY_EXTENSION[candidate];
    if (extra) return extra;
  }
  return tokenIcon('default');
}

function tokenIcon(token: string): FileIcon {
  return {
    glyph: TOKEN_GLYPHS[token] ?? TOKEN_GLYPHS['default']!,
    hue: TOKEN_HUES[token] ?? 'gray',
  };
}
