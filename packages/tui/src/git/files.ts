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
  text: string;
}

const MAX_VIEW_BYTES = 2 * 1024 * 1024;
const GREP_LIMIT = 300;

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

/** `git grep`, fixed-string and case-insensitive unless the query has capitals. */
export async function grep(root: string, query: string): Promise<GrepMatch[]> {
  if (query.trim().length < 2) return [];
  const caseFlag = query === query.toLowerCase() ? ['-i'] : [];
  const out = await git(
    root,
    [
      'grep',
      '-n',
      '-I',
      '--untracked',
      '--fixed-strings',
      ...caseFlag,
      '-e',
      query,
    ],
    [0, 1],
  );
  return out
    .split('\n')
    .filter(Boolean)
    .slice(0, GREP_LIMIT)
    .flatMap((line) => {
      const match = /^(.*?):(\d+):(.*)$/.exec(line);
      if (!match) return [];
      return [
        { path: match[1]!, line: Number(match[2]), text: match[3]!.trim() },
      ];
    });
}
