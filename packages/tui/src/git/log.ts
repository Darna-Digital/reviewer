import { git, US } from './exec';

export interface LogCommit {
  sha: string;
  parents: string[];
  shortSha: string;
  author: string;
  date: string;
  subject: string;
  refs: string[];
}

export interface CommitDetail extends LogCommit {
  email: string;
  body: string;
}

export interface CommitFile {
  path: string;
  oldPath: string | null;
  status: 'added' | 'deleted' | 'modified' | 'renamed';
}

export interface LogOptions {
  all: boolean;
  limit: number;
  /** Matched against messages, or a commit hash prefix. */
  grep?: string;
  path?: string | null;
}

/** Whether a log is narrowed, so its parent links no longer make a graph. */
export function isFilteredLog(
  opts: Pick<LogOptions, 'grep' | 'path'>,
): boolean {
  return (opts.grep?.trim() ?? '').length > 0 || !!opts.path;
}

/** The log, children first, with each commit's parents for the graph. */
export async function readLog(
  root: string,
  opts: LogOptions,
): Promise<LogCommit[]> {
  const grep = opts.grep?.trim() ?? '';
  const isHash = /^[0-9a-f]{4,40}$/i.test(grep);
  const out = await git(
    root,
    [
      'log',
      '--date-order',
      `-n${opts.limit}`,
      `--format=%H${US}%P${US}%h${US}%an${US}%aI${US}%s${US}%D`,
      ...(grep && !isHash ? ['-i', '--fixed-strings', `--grep=${grep}`] : []),
      opts.all ? '--all' : 'HEAD',
      ...(opts.path ? ['--', opts.path] : []),
    ],
    [0, 128],
  );
  const commits = out
    .split('\n')
    .filter(Boolean)
    .map((line): LogCommit => {
      const [
        sha = '',
        parents = '',
        shortSha = '',
        author = '',
        date = '',
        subject = '',
        refs = '',
      ] = line.split(US);
      return {
        sha,
        parents: parents.split(' ').filter(Boolean),
        shortSha,
        author,
        date,
        subject,
        refs: parseRefs(refs),
      };
    });
  return isHash
    ? commits.filter((commit) => commit.sha.startsWith(grep.toLowerCase()))
    : commits;
}

export async function readCommitFiles(
  root: string,
  sha: string,
): Promise<CommitFile[]> {
  const out = await git(root, [
    'show',
    '--format=',
    '--name-status',
    '-M',
    '-z',
    sha,
  ]);
  const fields = out.split('\0').filter(Boolean);
  const files: CommitFile[] = [];
  for (let i = 0; i < fields.length; i += 1) {
    const code = fields[i]!;
    if (code.startsWith('R') || code.startsWith('C')) {
      files.push({
        status: 'renamed',
        oldPath: fields[i + 1] ?? '',
        path: fields[i + 2] ?? '',
      });
      i += 2;
    } else {
      const status =
        code === 'A' ? 'added' : code === 'D' ? 'deleted' : 'modified';
      files.push({ status, oldPath: null, path: fields[i + 1] ?? '' });
      i += 1;
    }
  }
  return files;
}

export async function readCommit(
  root: string,
  sha: string,
): Promise<CommitDetail> {
  const out = await git(root, [
    'show',
    '-s',
    `--format=%H${US}%P${US}%h${US}%an${US}%ae${US}%aI${US}%s${US}%D${US}%b`,
    sha,
  ]);
  const [
    full = sha,
    parents = '',
    shortSha = '',
    author = '',
    email = '',
    date = '',
    subject = '',
    refs = '',
    body = '',
  ] = out.split(US);
  return {
    sha: full,
    parents: parents.split(' ').filter(Boolean),
    shortSha,
    author,
    email,
    date,
    subject,
    refs: parseRefs(refs),
    body: body.trim(),
  };
}

function parseRefs(decoration: string): string[] {
  return decoration
    .split(',')
    .map((ref) => ref.trim())
    .filter((ref) => ref.length > 0 && !ref.endsWith('/HEAD'));
}
