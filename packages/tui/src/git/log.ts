import { git, US } from './exec';

export interface LogCommit {
  sha: string;
  shortSha: string;
  author: string;
  date: string;
  subject: string;
  refs: string[];
}

export interface LogRow {
  /** Graph drawing to the left of the row. */
  graph: string;
  /** `null` for rows that only carry graph edges. */
  commit: LogCommit | null;
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

/** The log with its graph; filtered logs drop the graph, which would lie. */
export async function readLog(
  root: string,
  opts: LogOptions,
): Promise<LogRow[]> {
  const grep = opts.grep?.trim() ?? '';
  const filtered = grep.length > 0 || !!opts.path;
  const isHash = /^[0-9a-f]{4,40}$/i.test(grep);
  const out = await git(
    root,
    [
      'log',
      ...(filtered ? [] : ['--graph']),
      '--date-order',
      `-n${opts.limit}`,
      `--format=${US}%H${US}%h${US}%an${US}%aI${US}%s${US}%D`,
      ...(grep && !isHash ? ['-i', '--fixed-strings', `--grep=${grep}`] : []),
      opts.all ? '--all' : 'HEAD',
      ...(opts.path ? ['--', opts.path] : []),
    ],
    [0, 128],
  );
  const rows = out
    .split('\n')
    .filter(Boolean)
    .map((line): LogRow => {
      const at = line.indexOf(US);
      if (at === -1) return { graph: line.trimEnd(), commit: null };
      const [
        sha = '',
        shortSha = '',
        author = '',
        date = '',
        subject = '',
        refs = '',
      ] = line.slice(at + 1).split(US);
      return {
        graph: line.slice(0, at).trimEnd() || '*',
        commit: { sha, shortSha, author, date, subject, refs: parseRefs(refs) },
      };
    });
  return isHash
    ? rows.filter((row) => row.commit?.sha.startsWith(grep.toLowerCase()))
    : rows;
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
    `--format=%H${US}%h${US}%an${US}%ae${US}%aI${US}%s${US}%D${US}%b`,
    sha,
  ]);
  const [
    full = sha,
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
