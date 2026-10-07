/** The palette's modes, as the Mac app nests them: Commands is the root. */
export type PaletteMode = 'commands' | 'files' | 'text' | 'git' | 'branches';

interface ModeInfo {
  crumb: string;
  placeholder: string;
  parent: PaletteMode | null;
  /** Shown when nothing has been typed. */
  idle?: string;
  empty: string;
}

export const MODES: Record<PaletteMode, ModeInfo> = {
  commands: {
    crumb: 'Commands',
    placeholder: 'Type a command…',
    parent: null,
    empty: 'No commands found.',
  },
  files: {
    crumb: 'Files',
    placeholder: 'Go to file…',
    parent: 'commands',
    idle: 'Type to find a file by name.',
    empty: 'No files match.',
  },
  text: {
    crumb: 'Search',
    placeholder: 'Search in files…',
    parent: 'commands',
    idle: 'Type to search.',
    empty: 'No matches found.',
  },
  git: {
    crumb: 'Git',
    placeholder: 'Git…',
    parent: 'commands',
    empty: 'No commands found.',
  },
  branches: {
    crumb: 'Branches',
    placeholder: 'Check out a branch…',
    parent: 'git',
    empty: 'No branches match.',
  },
};

/** Root first: `['commands', 'git', 'branches']`. */
export function trail(mode: PaletteMode): PaletteMode[] {
  const parent = MODES[mode].parent;
  return parent ? [...trail(parent), mode] : [mode];
}
