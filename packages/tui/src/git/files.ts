import { join } from 'node:path';
import { git } from './exec';

export type FileStatus =
  'added' | 'untracked' | 'modified' | 'deleted' | 'renamed';

export interface FileContent {
  text: string;
  binary: boolean;
  /** Set when the file was too large to read. */
  skipped?: string;
}

export interface GrepMatch {
  path: string;
  line: number;
  /** 1-based, where the first match on the line starts. */
  column: number;
  text: string;
}

const MAX_VIEW_BYTES = 2 * 1024 * 1024;
const GREP_LIMIT = 500;
const MAX_LINE_CHARS = 400;

/** Every file a browse tree shows: tracked plus untracked, ignored left out. */
export async function listFiles(root: string): Promise<string[]> {
  const out = await git(root, [
    'ls-files',
    '--cached',
    '--others',
    '--exclude-standard',
    '-z',
  ]);
  return [...new Set(out.split('\0').filter(Boolean))].sort();
}

/** Working-tree status by path. */
export async function statusMap(
  root: string,
): Promise<Map<string, FileStatus>> {
  const out = await git(root, [
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
  ]);
  const map = new Map<string, FileStatus>();
  const entries = out.split('\0');
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]!;
    if (entry.length < 4) continue;
    const xy = entry.slice(0, 2);
    const path = entry.slice(3);
    if (xy === '??') map.set(path, 'untracked');
    else if (xy.includes('R')) {
      map.set(path, 'renamed');
      i += 1;
    } else if (xy.includes('A')) map.set(path, 'added');
    else if (xy.includes('D')) map.set(path, 'deleted');
    else map.set(path, 'modified');
  }
  return map;
}

export async function readFile(
  root: string,
  path: string,
): Promise<FileContent> {
  const file = Bun.file(join(root, path));
  if (!(await file.exists()))
    return {
      text: '',
      binary: false,
      skipped: 'Deleted from the working tree',
    };
  if (file.size > MAX_VIEW_BYTES) {
    return {
      text: '',
      binary: false,
      skipped: `${Math.round(file.size / 1024)} KB — too large to show`,
    };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.subarray(0, 8000).includes(0)) return { text: '', binary: true };
  return { text: new TextDecoder().decode(bytes), binary: false };
}

export interface GrepOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export interface GrepResult {
  matches: GrepMatch[];
  /** More matched than `GREP_LIMIT`. */
  truncated: boolean;
}

/** `git grep` over the working tree with untracked files, as the server runs it. */
export async function grep(
  root: string,
  query: string,
  opts: GrepOptions,
): Promise<GrepResult> {
  if (query.trim().length < 2) return { matches: [], truncated: false };
  const out = await git(
    root,
    [
      'grep',
      '--no-color',
      '-n',
      '--column',
      '--null',
      '-I',
      '--untracked',
      ...(opts.caseSensitive ? [] : ['-i']),
      ...(opts.wholeWord ? ['-w'] : []),
      opts.regex ? '-E' : '-F',
      '-e',
      query,
    ],
    [0, 1],
  );
  const lines = out.split('\n').filter(Boolean);
  return {
    truncated: lines.length > GREP_LIMIT,
    matches: lines.slice(0, GREP_LIMIT).flatMap((line) => {
      const [path, lineNo, column, ...text] = line.split('\0');
      if (!path || !lineNo || !column) return [];
      return [
        {
          path,
          line: Number(lineNo),
          column: Number(column),
          text: text.join('\0').slice(0, MAX_LINE_CHARS),
        },
      ];
    }),
  };
}
