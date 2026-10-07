import type { DevCommand } from '@reviewer/core/local-dev';
import type { BranchRow } from '../app/useBranches';
import type { FileStatus } from '../git/files';
import type { CommitFile, LogRow } from '../git/log';
import type { SessionStatus } from '../process/ptySession';
import type { TreeNode, TreeRow } from '../tree/fileTree';
import { padEnd, truncate } from '../text/measure';
import { ago } from '../text/time';
import { mix } from './palette';
import type { Palette } from './palette';
import { fitSegs, spread } from './styled';
import type { Seg } from './styled';

export interface ItemLook {
  selected: boolean;
  /** The list has the keyboard. */
  focused: boolean;
  hovered: boolean;
  width: number;
}

export interface ListItem<TValue = unknown> {
  key: string;
  selectable: boolean;
  rows: (look: ItemLook) => Seg[][];
  value?: TValue;
}

export const STATUS_LETTER: Record<FileStatus, string> = {
  added: 'A',
  untracked: 'U',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
};

export type Check = 'all' | 'some' | 'none';

const CHECK_GLYPH: Record<Check, string> = { all: '☑', some: '◩', none: '☐' };

/** Sidebar tree rows; `checkOf` adds the commit composer's checkboxes. */
export function treeItems(
  palette: Palette,
  rows: TreeRow[],
  checkOf: ((node: TreeNode) => Check) | null,
): Array<ListItem<TreeNode>> {
  return rows.map(({ node, depth, expanded }) => ({
    key: node.path,
    selectable: true,
    value: node,
    rows: (look) => {
      const bg = rowBg(palette, look);
      const color = node.status ? palette.gitStatus[node.status] : undefined;
      const left: Seg[] = [
        bar(palette, look, bg),
        { text: '  '.repeat(depth), bg },
        {
          text: node.kind === 'dir' ? (expanded ? '▾ ' : '▸ ') : '  ',
          fg: palette.faint,
          bg,
        },
      ];
      if (checkOf) {
        const check = checkOf(node);
        left.push({
          text: `${CHECK_GLYPH[check]} `,
          fg: check === 'none' ? palette.faint : palette.accent,
          bg,
        });
      }
      left.push({
        text: node.name,
        fg:
          color ??
          (node.kind === 'dir'
            ? palette.muted
            : mix(palette.frame, palette.text, 0.9)),
        bg,
        bold: look.selected,
      });
      const right: Seg[] =
        node.kind === 'file'
          ? [
              {
                text: node.status ? `${STATUS_LETTER[node.status]} ` : '  ',
                fg: color,
                bg,
                bold: true,
              },
            ]
          : [{ text: node.changed ? '• ' : '  ', fg: palette.faint, bg }];
      return [spread(left, right, look.width, bg)];
    },
  }));
}

export function branchItems(
  palette: Palette,
  rows: BranchRow[],
  opts: {
    remoteOpen: boolean;
    remoteCount: number;
    compared: string | null;
    aim: string | null;
  },
): Array<ListItem<BranchRow>> {
  const items: Array<ListItem<BranchRow>> = [];
  let section: string | null = null;
  for (const row of rows) {
    if (row.section !== section) {
      section = row.section;
      const count = rows.filter(
        (other) => other.section === row.section,
      ).length;
      items.push(heading(palette, `head:${section}`, section, String(count)));
    }
    items.push({
      key: `${row.section}:${row.branch.name}`,
      selectable: true,
      value: row,
      rows: (look) => {
        const { branch } = row;
        const bg = rowBg(palette, look);
        const right: Seg[] = [];
        if (branch.remote)
          right.push({
            text: branch.name.split('/')[0] ?? '',
            fg: palette.faint,
            bg,
          });
        if (branch.ahead > 0)
          right.push({ text: `↑${branch.ahead}`, fg: palette.added, bg });
        if (branch.behind > 0)
          right.push({ text: ` ↓${branch.behind}`, fg: palette.modified, bg });
        right.push({
          text: ` ${ago(branch.committedAt)} `,
          fg: palette.faint,
          bg,
        });
        const badges: Seg[] = [];
        if (branch.name === opts.compared)
          badges.push({ text: ' ⇄', fg: palette.accent, bg, bold: true });
        if (branch.name === opts.aim)
          badges.push({ text: ' ◎', fg: palette.faint, bg });
        return [
          spread(
            [
              bar(palette, look, bg),
              {
                text: branch.current ? ' ★ ' : ' ⎇ ',
                fg: branch.current ? '#ff9f0a' : palette.faint,
                bg,
              },
              {
                text: branch.name,
                fg:
                  branch.current || look.selected
                    ? palette.text
                    : palette.muted,
                bg,
                bold: branch.current,
              },
              ...badges,
            ],
            right,
            look.width,
            bg,
          ),
        ];
      },
    });
  }
  if (!opts.remoteOpen && opts.remoteCount > 0) {
    items.push(
      heading(palette, 'head:remote', '▸ Remote', String(opts.remoteCount)),
    );
  }
  return items;
}

const DATE = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });

export function historyItems(
  palette: Palette,
  rows: LogRow[],
  shownSha: string | null,
): Array<ListItem<LogRow>> {
  return rows.map((row, index) => {
    const { commit } = row;
    if (!commit) {
      return {
        key: `graph:${index}`,
        selectable: false,
        rows: ({ width }) => [
          fitSegs(
            [{ text: ' ' }, ...graphSegs(palette, row.graph, palette.frame)],
            width,
            palette.frame,
          ),
        ],
      };
    }
    return {
      key: commit.sha,
      selectable: true,
      value: row,
      rows: (look) => {
        const bg = rowBg(palette, look);
        const shown = commit.sha === shownSha;
        const left: Seg[] = [
          bar(palette, look, bg),
          ...graphSegs(palette, row.graph, bg),
          { text: ' ', bg },
          ...commit.refs
            .slice(0, 3)
            .flatMap((ref) => refChip(palette, ref, bg)),
          { text: ' ', bg },
          {
            text: commit.subject,
            fg:
              look.selected || shown
                ? palette.text
                : mix(palette.frame, palette.text, 0.85),
            bg,
          },
        ];
        const right: Seg[] = [
          {
            text: `${padEnd(truncate(commit.author, 16), 16)} `,
            fg: palette.faint,
            bg,
          },
          {
            text: `${padEnd(DATE.format(new Date(commit.date)), 6)} `,
            fg: palette.faint,
            bg,
          },
          {
            text: `${commit.shortSha} `,
            fg: shown ? palette.accent : palette.faint,
            bg,
          },
        ];
        return [
          spread(
            left,
            look.width > 90 ? right : right.slice(1),
            look.width,
            bg,
          ),
        ];
      },
    };
  });
}

export function commitFileItems(
  palette: Palette,
  files: CommitFile[],
): Array<ListItem<CommitFile>> {
  return files.map((file) => ({
    key: file.path,
    selectable: true,
    value: file,
    rows: (look) => {
      const bg = rowBg(palette, look);
      const slash = file.path.lastIndexOf('/');
      return [
        spread(
          [
            bar(palette, look, bg),
            { text: ' ', bg },
            {
              text: file.path.slice(slash + 1),
              fg: palette.text,
              bg,
              bold: look.selected,
            },
            {
              text: `  ${file.path.slice(0, slash + 1)}`,
              fg: palette.faint,
              bg,
            },
          ],
          [
            {
              text: `${STATUS_LETTER[file.status]} `,
              fg: palette.gitStatus[file.status],
              bg,
              bold: true,
            },
          ],
          look.width,
          bg,
        ),
      ];
    },
  }));
}

export interface ServiceColumns {
  name: number;
  command: number;
  status: number;
}

/** Column widths for the Run table at `width`. */
export function serviceColumns(width: number): ServiceColumns {
  const status = 12;
  const name = Math.max(10, Math.min(22, Math.floor(width * 0.3)));
  return { name, status, command: Math.max(8, width - name - status - 8) };
}

export function serviceItems(
  palette: Palette,
  commands: DevCommand[],
  state: (id: string) => { status: SessionStatus; exitCode: number | null },
): Array<ListItem<DevCommand>> {
  return commands.map((command) => ({
    key: command.id,
    selectable: true,
    value: command,
    rows: (look) => {
      const bg = rowBg(palette, look);
      const columns = serviceColumns(look.width);
      const { status, exitCode } = state(command.id);
      return [
        fitSegs(
          [
            bar(palette, look, bg),
            processDot(palette, status, exitCode, bg),
            {
              text: ` ${padEnd(command.name, columns.name)} `,
              fg: palette.text,
              bg,
              bold: look.selected,
            },
            {
              text: `${padEnd(command.command, columns.command)} `,
              fg: palette.muted,
              bg,
            },
            {
              text: padEnd(statusLabel(status, exitCode), columns.status),
              fg: exitCode ? palette.deleted : palette.faint,
              bg,
            },
            { text: command.cwd || '.', fg: palette.faint, bg },
          ],
          look.width,
          bg,
        ),
      ];
    },
  }));
}

export function processDot(
  palette: Palette,
  status: SessionStatus,
  exitCode: number | null,
  bg?: string,
): Seg {
  if (status === 'running')
    return { text: '●', fg: palette.process.running, bg };
  if (status === 'exited')
    return {
      text: '●',
      fg: exitCode ? palette.process.failed : palette.process.idle,
      bg,
    };
  return { text: '○', fg: palette.process.idle, bg };
}

export function statusLabel(
  status: SessionStatus,
  exitCode: number | null,
): string {
  if (status === 'running') return 'Running';
  if (status === 'exited') return exitCode ? `Exited (${exitCode})` : 'Exited';
  return 'Not running';
}

export function heading<TValue>(
  palette: Palette,
  key: string,
  label: string,
  count?: string,
): ListItem<TValue> {
  return {
    key,
    selectable: false,
    rows: ({ width }) => [
      fitSegs(
        [
          { text: ' ' },
          { text: label.toUpperCase(), fg: palette.faint, bold: true },
          ...(count ? [{ text: `  ${count}`, fg: palette.faint }] : []),
        ],
        width,
      ),
    ],
  };
}

export function rowBg(palette: Palette, look: ItemLook): string {
  if (look.selected)
    return look.focused ? palette.selection : palette.selectionIdle;
  return look.hovered
    ? mix(palette.frame, palette.selectionIdle, 0.6)
    : palette.frame;
}

function bar(palette: Palette, look: ItemLook, bg: string): Seg {
  return {
    text: look.selected ? (look.focused ? '▌' : '▏') : ' ',
    fg: palette.accent,
    bg,
  };
}

const GRAPH_GLYPHS: Record<string, string> = {
  '*': '●',
  '|': '│',
  '/': '╱',
  '\\': '╲',
  _: '─',
  '-': '─',
  '.': '·',
};

function graphSegs(palette: Palette, graph: string, bg: string): Seg[] {
  return Array.from(graph, (char, i) => ({
    text: GRAPH_GLYPHS[char] ?? char,
    fg:
      char === '*'
        ? palette.text
        : palette.lanes[Math.floor(i / 2) % palette.lanes.length],
    bg,
    bold: char === '*',
  }));
}

function refChip(palette: Palette, ref: string, bg: string): Seg[] {
  const head = ref.startsWith('HEAD -> ');
  const tag = ref.startsWith('tag: ');
  const name = head ? ref.slice(8) : tag ? ref.slice(5) : ref;
  const color = tag
    ? palette.warning
    : head
      ? palette.accent
      : name.includes('/')
        ? palette.renamed
        : palette.added;
  return [
    { text: ' ', bg },
    {
      text: `${tag ? '◇ ' : ''}${name}`,
      fg: color,
      bg: mix(bg, color, 0.16),
      bold: head,
    },
  ];
}
