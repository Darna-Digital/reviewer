import type { GrepOptions } from '../git/files';
import { STATUS_LETTER } from '../render/listItems';
import type { Seg } from '../render/styled';
import { fuzzyFilter, matchRange } from '../search/fuzzy';
import type { PaletteMode } from '../search/paletteModes';
import { COMMANDS, shownKey } from './commands';
import type { Command } from './commands';
import { keyLabel } from './keys';
import type { TextSearch } from './useTextSearch';
import type { App } from './useApp';

export type Tone = 'dim' | 'mark' | 'strong';

export interface PaletteItem {
  key: string;
  /** Items are listed under their group's heading. */
  group?: string;
  /** Drawn before the group's heading: its file's icon. */
  groupIcon?: Seg[];
  /** `fg` overrides the tone's colour. */
  label: Array<{ text: string; tone?: Tone; fg?: string }>;
  /** Right-aligned before the label: a match's line number. */
  lead?: string;
  hint?: string;
  hintColor?: string;
  /** Leads into another mode, so the palette stays open. */
  opens?: PaletteMode;
  run?: () => void;
}

export interface ItemsInput {
  app: App;
  mode: PaletteMode;
  query: string;
  search: TextSearch;
  options: GrepOptions;
}

const MAX_FILES = 40;
const ENTRY_IDS = new Set(['palette', 'file.find', 'search']);

export function paletteItems(input: ItemsInput): PaletteItem[] {
  switch (input.mode) {
    case 'commands':
      return commandItems(input);
    case 'files':
      return fileItems(input);
    case 'text':
      return matchItems(input);
    case 'git':
      return gitItems(input);
    case 'branches':
      return branchItems(input);
  }
}

function commandItems({ app, query }: ItemsInput): PaletteItem[] {
  const chords = app.chords;
  const keyOf = (id: string) => {
    const command = COMMANDS.find((c) => c.id === id);
    const key = command && shownKey(command, chords);
    return key ? keyLabel(key) : undefined;
  };
  const entries: PaletteItem[] = [
    entry('files', 'Go to file…', keyOf('file.find')),
    entry('text', 'Search in files…', keyOf('search')),
    entry('git', 'Git…'),
    ...COMMANDS.filter(
      (command) => command.palette && !ENTRY_IDS.has(command.id),
    ).map((command) => commandItem(app, command)),
  ];
  return fuzzyFilter(entries, query, labelText);
}

function entry(mode: PaletteMode, title: string, hint?: string): PaletteItem {
  return { key: `mode:${mode}`, label: [{ text: title }], hint, opens: mode };
}

function commandItem(app: App, command: Command): PaletteItem {
  const key = shownKey(command, app.chords);
  return {
    key: command.id,
    label: [{ text: capitalize(command.title) }],
    hint: key ? keyLabel(key) : undefined,
    run: () => command.run(app, 1),
  };
}

function fileItems({ app, query }: ItemsInput): PaletteItem[] {
  if (!query.trim()) return [];
  const { review, palette, actions } = app;
  return fuzzyFilter(review.projectFiles, query, (path) => path, MAX_FILES).map(
    (path) => {
      const slash = path.lastIndexOf('/') + 1;
      const status = review.statusMap.get(path);
      return {
        key: path,
        label: [
          ...app.icons.file(path).map(({ text, fg }) => ({ text, fg })),
          { text: path.slice(slash), tone: 'strong' },
          { text: slash ? `  ${path.slice(0, slash - 1)}` : '', tone: 'dim' },
        ],
        hint: status ? STATUS_LETTER[status] : undefined,
        hintColor: status ? palette.gitStatus[status] : undefined,
        run: () => {
          actions.openFile(path);
          actions.setFocus('main');
        },
      };
    },
  );
}

function matchItems({
  app,
  query,
  search,
  options,
}: ItemsInput): PaletteItem[] {
  const { actions, icons } = app;
  return (search.result?.matches ?? []).map((match) => {
    const text = match.text.trimStart();
    const range = matchRange(text, query, options);
    const label: PaletteItem['label'] = range
      ? [
          { text: text.slice(0, range[0]) },
          { text: text.slice(range[0], range[1]), tone: 'mark' },
          { text: text.slice(range[1]) },
        ]
      : [{ text }];
    return {
      key: `${match.path}:${match.line}`,
      group: match.path,
      groupIcon: icons.file(match.path),
      lead: String(match.line),
      label,
      run: () => {
        actions.openFile(match.path, { line: match.line });
        actions.setFocus('main');
      },
    };
  });
}

function gitItems({ app, query }: ItemsInput): PaletteItem[] {
  const { actions } = app;
  const items: PaletteItem[] = [
    { key: 'git:refresh', label: [{ text: 'Refresh' }], run: actions.refresh },
    {
      key: 'git:fetch',
      label: [{ text: 'Fetch' }],
      run: () => void actions.fetch(),
    },
    {
      key: 'git:pull',
      label: [{ text: 'Pull' }],
      run: () => void actions.pull(),
    },
    {
      key: 'git:push',
      label: [{ text: 'Push' }],
      run: () => void actions.push(),
    },
    {
      key: 'git:branch',
      label: [{ text: 'Create branch…' }],
      run: () => actions.newBranch(),
    },
    entry('branches', 'Branches…'),
  ];
  return fuzzyFilter(items, query, labelText);
}

function branchItems({ app, query }: ItemsInput): PaletteItem[] {
  const { review, actions, palette } = app;
  const ordered = [
    ...review.branches.filter((branch) => !branch.remote),
    ...review.branches.filter((branch) => branch.remote),
  ];
  return fuzzyFilter(ordered, query, (branch) => branch.name).map((branch) => {
    const drift = [
      branch.ahead ? `↑${branch.ahead}` : '',
      branch.behind ? `↓${branch.behind}` : '',
    ]
      .filter(Boolean)
      .join(' ');
    return {
      key: `branch:${branch.name}`,
      group: branch.remote ? 'Remote' : 'Local',
      label: [
        { text: branch.name, tone: branch.current ? 'strong' : undefined },
      ],
      hint: branch.current
        ? 'current'
        : drift || (branch.remote ? branch.name.split('/')[0] : undefined),
      hintColor: branch.current ? palette.added : undefined,
      run: () => actions.checkoutBranch(branch),
    };
  });
}

function labelText(item: PaletteItem): string {
  return item.label.map((part) => part.text).join('');
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
