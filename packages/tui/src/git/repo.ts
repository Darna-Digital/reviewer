import { basename } from 'node:path';
import { git } from './exec';

export interface RepoInfo {
  root: string;
  name: string;
  /** `null` on a detached HEAD. */
  branch: string | null;
  head: string;
  /** `user.name`, or `you`. */
  user: string;
}

export interface RepoStatus {
  upstream: string | null;
  ahead: number;
  behind: number;
  staged: number;
  unstaged: number;
  untracked: number;
  conflicted: number;
}

export async function repoRoot(cwd: string): Promise<string> {
  return (await git(cwd, ['rev-parse', '--show-toplevel'])).trim();
}

export async function repoInfo(root: string): Promise<RepoInfo> {
  const [branch, head, user] = await Promise.all([
    git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], [0, 1]),
    git(root, ['rev-parse', '--verify', '--quiet', 'HEAD'], [0, 1]),
    git(root, ['config', 'user.name'], [0, 1]),
  ]);
  return {
    root,
    name: basename(root),
    branch: branch.trim() || null,
    head: head.trim(),
    user: user.trim() || 'you',
  };
}

export async function repoStatus(root: string): Promise<RepoStatus> {
  const out = await git(root, ['status', '--porcelain=v2', '--branch', '-z']);
  const status: RepoStatus = {
    upstream: null,
    ahead: 0,
    behind: 0,
    staged: 0,
    unstaged: 0,
    untracked: 0,
    conflicted: 0,
  };
  const entries = out.split('\0');
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i]!;
    if (entry.startsWith('# branch.upstream ')) {
      status.upstream = entry.slice('# branch.upstream '.length);
    } else if (entry.startsWith('# branch.ab ')) {
      const [, ahead = '+0', behind = '-0'] = entry.slice(2).split(' ');
      status.ahead = Math.abs(Number(ahead.slice(1)));
      status.behind = Math.abs(Number(behind.slice(1)));
    } else if (entry.startsWith('1 ') || entry.startsWith('2 ')) {
      if (entry[2] !== '.') status.staged += 1;
      if (entry[3] !== '.') status.unstaged += 1;
      // a rename carries its original path in the next field
      if (entry.startsWith('2 ')) i += 1;
    } else if (entry.startsWith('u ')) {
      status.conflicted += 1;
    } else if (entry.startsWith('? ')) {
      status.untracked += 1;
    }
  }
  return status;
}

/** Changes whenever anything a review shows could have changed. */
export async function worktreeFingerprint(root: string): Promise<string> {
  const [head, status] = await Promise.all([
    git(root, ['rev-parse', '--verify', '--quiet', 'HEAD'], [0, 1]),
    git(root, ['status', '--porcelain=v1', '-z']),
  ]);
  return `${head}\n${status}`;
}
