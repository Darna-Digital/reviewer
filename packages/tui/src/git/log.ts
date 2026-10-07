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

export async function readLog(
  root: string,
  opts: { all: boolean; limit: number },
): Promise<LogRow[]> {
  const out = await git(
    root,
    [
      'log',
      '--graph',
      '--date-order',
      `-n${opts.limit}`,
      `--format=${US}%H${US}%h${US}%an${US}%aI${US}%s${US}%D`,
      opts.all ? '--all' : 'HEAD',
    ],
    [0, 128],
  );
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => {
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
        graph: line.slice(0, at).trimEnd(),
        commit: { sha, shortSha, author, date, subject, refs: parseRefs(refs) },
      };
    });
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
