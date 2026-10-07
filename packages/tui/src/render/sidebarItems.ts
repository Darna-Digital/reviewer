import type { ReviewComment } from '@reviewer/core/comments';
import { describeTarget } from '../app/comparison';
import type { FileDiff } from '../diff/parseDiff';
import { splitPath } from '../git/diff';
import type { LogCommit, LogRow } from '../git/log';
import type { Branch } from '../git/refs';
import { truncate, truncateStart } from '../text/measure';
import { ago } from '../text/time';
import { STATUS_LETTER, statusColor } from './diffRows';
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

export interface ListItem {
  key: string;
  selectable: boolean;
  rows: (look: ItemLook) => Seg[][];
  file?: number;
  branch?: Branch;
  commit?: LogCommit;
  comment?: ReviewComment;
}

export function fileItems(
  palette: Palette,
  files: FileDiff[],
  commentsIn: (file: number) => number,
): ListItem[] {
  const items: ListItem[] = [];
  let lastDir: string | null = null;

  files.forEach((file, index) => {
    const [dir, name] = splitPath(file.path);
    if (dir !== lastDir) {
      lastDir = dir;
      if (dir) items.push(folderHeading(palette, dir));
    }
    items.push({
      key: `file:${file.path}`,
      selectable: true,
      file: index,
      rows: (look) => {
        const bg = rowBg(palette, look);
        const comments = commentsIn(index);
        const right: Seg[] = [];
        if (comments > 0)
          right.push({ text: `◆${comments} `, fg: palette.accent, bg });
        if (file.additions > 0)
          right.push({
            text: `+${file.additions}`,
            fg: mix(bg, palette.added, 0.85),
            bg,
          });
        if (file.deletions > 0) {
          right.push({
            text: `${file.additions > 0 ? ' ' : ''}−${file.deletions}`,
            fg: mix(bg, palette.deleted, 0.85),
            bg,
          });
        }
        right.push({ text: ' ', bg });
        return [
          spread(
            [
              bar(palette, look, bg),
              { text: dir ? '   ' : ' ', bg },
              {
                text: STATUS_LETTER[file.status],
                fg: statusColor(palette, file.status),
                bg,
                bold: true,
              },
              { text: ' ', bg },
              {
                text: name,
                fg: look.selected
                  ? palette.text
                  : mix(palette.frame, palette.text, 0.88),
                bg,
                bold: look.selected,
              },
            ],
            right,
            look.width,
            bg,
          ),
        ];
      },
    });
  });
  return items;
}

export interface BranchMarks {
  /** The ref the diff is read against. */
  compared: string | null;
  /** The current branch's recorded target. */
  aim: string | null;
}

export function branchItems(
  palette: Palette,
  branches: Branch[],
  marks: BranchMarks,
  now: number,
): ListItem[] {
  const items: ListItem[] = [];
  section(
    'Local',
    branches.filter((branch) => !branch.remote),
  );
  section(
    'Remote',
    branches.filter((branch) => branch.remote),
  );
  return items;

  function section(label: string, list: Branch[]) {
    if (list.length === 0) return;
    if (items.length > 0) items.push(spacer(`gap:${label}`));
    items.push(heading(palette, `head:${label}`, label, String(list.length)));
    for (const branch of list) {
      items.push({
        key: `branch:${branch.name}`,
        selectable: true,
        branch,
        rows: (look) => branchRows(palette, branch, marks, look, now),
      });
    }
  }
}

function branchRows(
  palette: Palette,
  branch: Branch,
  marks: BranchMarks,
  look: ItemLook,
  now: number,
): Seg[][] {
  const bg = rowBg(palette, look);
  const badges: Seg[] = [];
  if (branch.name === marks.compared)
    badges.push({ text: ' ⇄', fg: palette.accent, bg, bold: true });
  if (branch.name === marks.aim)
    badges.push({ text: ' ◎ target', fg: palette.faint, bg });

  const right: Seg[] = [];
  if (branch.ahead > 0)
    right.push({ text: `↑${branch.ahead}`, fg: palette.added, bg });
  if (branch.behind > 0)
    right.push({
      text: `${branch.ahead > 0 ? ' ' : ''}↓${branch.behind}`,
      fg: palette.warning,
      bg,
    });
  if (branch.gone) right.push({ text: 'gone', fg: palette.deleted, bg });
  right.push({ text: ' ', bg });

  const strong = branch.current || look.selected;
  return [
    spread(
      [
        bar(palette, look, bg),
        { text: branch.current ? ' ● ' : '   ', fg: palette.added, bg },
        {
          text: branch.name,
          fg: strong ? palette.text : mix(palette.frame, palette.text, 0.85),
          bg,
          bold: strong,
        },
        ...badges,
      ],
      right,
      look.width,
      bg,
    ),
    spread(
      [
        { text: '    ', bg },
        { text: branch.subject, fg: palette.faint, bg },
      ],
      [{ text: `${ago(branch.committedAt, now)} `, fg: palette.faint, bg }],
      look.width,
      bg,
    ),
  ];
}

export function historyItems(
  palette: Palette,
  rows: LogRow[],
  shownSha: string | null,
  now: number,
): ListItem[] {
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
      key: `commit:${commit.sha}`,
      selectable: true,
      commit,
      rows: (look) => {
        const bg = rowBg(palette, look);
        const shown = commit.sha === shownSha;
        const left: Seg[] = [
          bar(palette, look, bg),
          ...graphSegs(palette, row.graph, bg),
          { text: ' ', bg },
          {
            text: commit.shortSha,
            fg: shown ? palette.accent : palette.faint,
            bg,
            bold: shown,
          },
          ...commit.refs
            .slice(0, 2)
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
            text: `${truncate(commit.author.split(' ')[0] ?? '', 10)} `,
            fg: palette.faint,
            bg,
          },
          {
            text: `${ago(commit.date, now).padStart(3)} `,
            fg: palette.faint,
            bg,
          },
        ];
        return [
          spread(
            left,
            look.width > 70 ? right : right.slice(1),
            look.width,
            bg,
          ),
        ];
      },
    };
  });
}

export function commentItems(
  palette: Palette,
  comments: ReviewComment[],
  currentTarget: string,
  now: number,
): ListItem[] {
  const groups = new Map<string, ReviewComment[]>();
  for (const comment of comments) {
    groups.set(comment.target, [
      ...(groups.get(comment.target) ?? []),
      comment,
    ]);
  }
  const latest = (target: string) => groups.get(target)!.at(-1)!.createdAt;
  const order = [...groups.keys()].sort((a, b) => {
    if (a === currentTarget) return -1;
    if (b === currentTarget) return 1;
    return latest(b).localeCompare(latest(a));
  });

  const items: ListItem[] = [];
  for (const target of order) {
    const list = groups.get(target)!;
    if (items.length > 0) items.push(spacer(`gap:${target}`));
    items.push({
      key: `target:${target}`,
      selectable: false,
      rows: ({ width }) => [
        fitSegs(
          [
            { text: '  ' },
            {
              text: describeTarget(target).toUpperCase(),
              fg: palette.faint,
              bold: true,
            },
            { text: `  ${list.length}`, fg: palette.faint },
            ...(target === currentTarget
              ? [{ text: '  ● on screen', fg: palette.accent }]
              : []),
          ],
          width,
        ),
      ],
    });
    for (const comment of list) {
      items.push({
        key: `comment:${comment.id}`,
        selectable: true,
        comment,
        rows: (look) => {
          const bg = rowBg(palette, look);
          const firstLine =
            comment.body.split('\n').find((line) => line.trim()) ?? '';
          const time = `${ago(comment.createdAt, now)} `;
          return [
            spread(
              [
                bar(palette, look, bg),
                { text: '  ', bg },
                {
                  text: truncateStart(
                    `${comment.filePath}:${comment.lineNumber}`,
                    look.width - time.length - 5,
                  ),
                  fg: look.selected ? palette.text : palette.muted,
                  bg,
                  bold: look.selected,
                },
              ],
              [{ text: time, fg: palette.faint, bg }],
              look.width,
              bg,
            ),
            fitSegs(
              [
                { text: '   ', bg },
                { text: firstLine, fg: mix(bg, palette.text, 0.8), bg },
              ],
              look.width,
              bg,
            ),
          ];
        },
      });
    }
  }
  return items;
}

function rowBg(palette: Palette, look: ItemLook): string {
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

function heading(
  palette: Palette,
  key: string,
  label: string,
  count?: string,
): ListItem {
  return {
    key,
    selectable: false,
    rows: ({ width }) => [
      fitSegs(
        [
          { text: '  ' },
          { text: label.toUpperCase(), fg: palette.faint, bold: true },
          ...(count ? [{ text: `  ${count}`, fg: palette.faint }] : []),
        ],
        width,
      ),
    ],
  };
}

function spacer(key: string): ListItem {
  return { key, selectable: false, rows: ({ width }) => [fitSegs([], width)] };
}

/** The part a folder shares with its parent dimmed; the last segment stands out. */
function folderHeading(palette: Palette, dir: string): ListItem {
  return {
    key: `dir:${dir}`,
    selectable: false,
    rows: ({ width }) => {
      const full = truncateStart(`${dir}/`, width - 4);
      const cut = full.lastIndexOf('/', full.length - 2) + 1;
      return [
        fitSegs(
          [
            { text: '  ' },
            { text: '▾ ', fg: palette.faint },
            { text: full.slice(0, cut), fg: palette.faint },
            { text: full.slice(cut), fg: palette.muted, bold: true },
          ],
          width,
        ),
      ];
    },
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
