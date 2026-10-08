import type { DevCommand } from '@reviewer/core/local-dev';
import type { FileStatus } from '../git/files';
import { graphWidth } from '../git/graph';
import type { GraphRow } from '../git/graph';
import type { CommitFile, LogCommit } from '../git/log';
import type { SessionStatus } from '../process/ptySession';
import type { TreeNode, TreeRow } from '../tree/fileTree';
import { padEnd, truncate } from '../text/measure';
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

const DATE = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });

export function historyItems(
  palette: Palette,
  commits: LogCommit[],
  graph: GraphRow[] | null,
  shownSha: string | null,
  /** The commits near the viewport, whose lanes set the graph's width. */
  around: { from: number; to: number },
): Array<ListItem<LogCommit>> {
  const laneCells = graph
    ? Math.min(MAX_GRAPH_CELLS, graphWidth(graph.slice(around.from, around.to)))
    : 1;
  return commits.map((commit, index) => ({
    key: commit.sha,
    selectable: true,
    value: commit,
    rows: (look) => {
      const bg = rowBg(palette, look);
      const shown = commit.sha === shownSha;
      const left: Seg[] = [
        bar(palette, look, bg),
        ...graphSegs(palette, graph?.[index], laneCells, bg),
        { text: ' ', bg },
        ...commit.refs.slice(0, 3).flatMap((ref) => refChip(palette, ref, bg)),
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
        spread(left, look.width > 90 ? right : right.slice(1), look.width, bg),
      ];
    },
  }));
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
export const SERVICE_NAME_COLUMN = 22;
export const SERVICE_STATUS_COLUMN = 12;

export function serviceColumns(width: number): ServiceColumns {
  const status = SERVICE_STATUS_COLUMN;
  const name = Math.max(
    10,
    Math.min(SERVICE_NAME_COLUMN, Math.floor(width * 0.3)),
  );
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

const MAX_GRAPH_CELLS = 24;

/** A graph row padded to `width`, so every subject starts in one column. */
function graphSegs(
  palette: Palette,
  row: GraphRow | undefined,
  width: number,
  bg: string,
): Seg[] {
  const cells = row?.cells ?? [{ glyph: '●', lane: 0 }];
  const shown = cells.slice(0, width);
  return [
    ...shown.map((cell) => ({
      text: cell.glyph,
      fg:
        cell.lane === null
          ? palette.faint
          : palette.lanes[cell.lane % palette.lanes.length],
      bg,
    })),
    { text: ' '.repeat(Math.max(0, width - shown.length)), bg },
  ];
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
