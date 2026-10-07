import { join } from 'node:path';
import { parseDiff } from '../diff/parseDiff';
import type { DiffLine, FileDiff } from '../diff/parseDiff';
import { printable } from '../text/measure';
import { git } from './exec';

const DIFF_ARGS = [
  '--no-color',
  '--no-ext-diff',
  '--src-prefix=a/',
  '--dst-prefix=b/',
  '-M',
];

/** Untracked files past this are listed but not read. */
const MAX_UNTRACKED_BYTES = 512 * 1024;
/** Bytes sniffed for a NUL to call a file binary — git's own rule. */
const BINARY_SNIFF = 8000;

/** Working tree against `HEAD`, untracked files included. */
export async function worktreeDiff(root: string): Promise<FileDiff[]> {
  const tracked = await git(root, ['diff', ...DIFF_ARGS, 'HEAD']).catch(
    () => '',
  );
  return withUntracked(root, tracked);
}

/** Merge base with `target` through to the working tree. */
export async function branchDiff(
  root: string,
  target: string,
): Promise<FileDiff[]> {
  const base = (await git(root, ['merge-base', target, 'HEAD'])).trim();
  return withUntracked(root, await git(root, ['diff', ...DIFF_ARGS, base]));
}

export async function commitDiff(
  root: string,
  sha: string,
): Promise<FileDiff[]> {
  return sortByFolder(
    parseDiff(
      await git(root, ['show', '--format=', '--patch', ...DIFF_ARGS, sha]),
    ),
  );
}

/** Folder by folder, files by name — the order the sidebar lists them. */
export function sortByFolder(files: FileDiff[]): FileDiff[] {
  return [...files].sort((a, b) => {
    const [dirA, nameA] = splitPath(a.path);
    const [dirB, nameB] = splitPath(b.path);
    return dirA === dirB
      ? nameA.localeCompare(nameB)
      : dirA.localeCompare(dirB);
  });
}

export function splitPath(path: string): [dir: string, name: string] {
  const slash = path.lastIndexOf('/');
  return [slash === -1 ? '' : path.slice(0, slash), path.slice(slash + 1)];
}

async function withUntracked(
  root: string,
  tracked: string,
): Promise<FileDiff[]> {
  const listing = await git(root, [
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z',
  ]);
  const files = parseDiff(tracked);
  const seen = new Set(files.map((file) => file.path));
  const untracked = await Promise.all(
    listing
      .split('\0')
      .filter((path) => path.length > 0 && !seen.has(path))
      .map((path) => readUntracked(root, path).catch(() => null)),
  );
  return sortByFolder([
    ...files,
    ...untracked.filter((file): file is FileDiff => file !== null),
  ]);
}

/** An untracked file as the added-file patch git would print once staged. */
async function readUntracked(root: string, path: string): Promise<FileDiff> {
  const blank: FileDiff = {
    path,
    oldPath: null,
    status: 'added',
    binary: false,
    hunks: [],
    additions: 0,
    deletions: 0,
  };
  const file = Bun.file(join(root, path));
  if (file.size > MAX_UNTRACKED_BYTES) {
    const kb = Math.round(file.size / 1024);
    return { ...blank, skipped: `New file, ${kb} KB — too large to show` };
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.subarray(0, BINARY_SNIFF).includes(0))
    return { ...blank, binary: true };

  const text = new TextDecoder().decode(bytes);
  if (text.length === 0) return blank;
  const lines: DiffLine[] = text
    .replace(/\n$/, '')
    .split('\n')
    .map((line, i) => ({
      kind: 'add',
      text: printable(line),
      oldNo: null,
      newNo: i + 1,
    }));
  return {
    ...blank,
    hunks: [{ oldStart: 0, newStart: 1, section: '', lines }],
    additions: lines.length,
  };
}
