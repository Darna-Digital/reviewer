import { git, US } from './exec';

export interface Branch {
  /** As git takes it: `main`, or `origin/main`. */
  name: string;
  remote: boolean;
  sha: string;
  current: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
  /** Upstream configured but deleted. */
  gone: boolean;
  committedAt: string;
  subject: string;
}

export interface Divergence {
  /** Commits on HEAD not on the ref. */
  ahead: number;
  /** Commits on the ref not on HEAD. */
  behind: number;
}

const REF_FORMAT = [
  '%(refname)',
  '%(refname:short)',
  '%(objectname)',
  '%(HEAD)',
  '%(upstream:short)',
  '%(upstream:track,nobracket)',
  '%(committerdate:iso-strict)',
  '%(contents:subject)',
].join('%1f');

export async function listBranches(root: string): Promise<Branch[]> {
  const out = await git(root, [
    'for-each-ref',
    `--format=${REF_FORMAT}`,
    '--sort=-committerdate',
    'refs/heads',
    'refs/remotes',
  ]);
  return out
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split(US))
    .filter(([ref = '']) => !ref.endsWith('/HEAD'))
    .map(
      ([
        ref = '',
        name = '',
        sha = '',
        head = '',
        upstream = '',
        track = '',
        committedAt = '',
        subject = '',
      ]) => ({
        name,
        remote: ref.startsWith('refs/remotes/'),
        sha,
        current: head === '*',
        upstream: upstream || null,
        ahead: Number(/ahead (\d+)/.exec(track)?.[1] ?? 0),
        behind: Number(/behind (\d+)/.exec(track)?.[1] ?? 0),
        gone: track === 'gone',
        committedAt,
        subject,
      }),
    );
}

/** The remote's default branch (`origin/HEAD`), else a local main/master. */
export async function defaultBranch(
  root: string,
  branches: Branch[],
): Promise<string | null> {
  const remoteHead = await git(
    root,
    ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD'],
    [0, 1, 128],
  );
  if (remoteHead.trim()) return remoteHead.trim();
  const names = new Set(branches.map((branch) => branch.name));
  return (
    ['main', 'master', 'trunk', 'develop'].find((name) => names.has(name)) ??
    null
  );
}

export async function divergence(
  root: string,
  ref: string,
): Promise<Divergence | null> {
  const out = await git(
    root,
    ['rev-list', '--left-right', '--count', `HEAD...${ref}`],
    [0, 128],
  );
  const [ahead, behind] = out.trim().split(/\s+/).map(Number);
  if (ahead === undefined || behind === undefined || Number.isNaN(ahead))
    return null;
  return { ahead, behind };
}

/**
 * Switches branches. A remote branch with no local twin is checked out as a
 * new tracking branch rather than a detached HEAD.
 */
export async function checkout(
  root: string,
  branch: Branch,
  all: Branch[],
): Promise<string> {
  if (!branch.remote) {
    await git(root, ['switch', branch.name]);
    return branch.name;
  }
  const local = branch.name.slice(branch.name.indexOf('/') + 1);
  const exists = all.some((other) => !other.remote && other.name === local);
  await git(
    root,
    exists ? ['switch', local] : ['switch', '--track', branch.name],
  );
  return local;
}
