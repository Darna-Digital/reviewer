/**
 * What the diff shows. Comments are filed under the same `target` keys the
 * app uses, so a note left in either shows up in both.
 */
export type Comparison =
  | { kind: 'worktree' }
  | { kind: 'branch'; against: string }
  | { kind: 'commit'; sha: string }
  | { kind: 'pull'; number: number };

export const WORKTREE: Comparison = { kind: 'worktree' };

export function targetKey(comparison: Comparison): string {
  switch (comparison.kind) {
    case 'worktree':
      return 'worktree';
    case 'branch':
      return `branch-${comparison.against}`;
    case 'commit':
      return `commit-${comparison.sha}`;
    case 'pull':
      return `pr-${comparison.number}`;
  }
}

/** The comparison a comment was filed under. */
export function comparisonOf(target: string): Comparison | null {
  if (target === 'worktree') return WORKTREE;
  if (target.startsWith('branch-'))
    return { kind: 'branch', against: target.slice(7) };
  if (target.startsWith('commit-'))
    return { kind: 'commit', sha: target.slice(7) };
  if (/^pr-\d+$/.test(target))
    return { kind: 'pull', number: Number(target.slice(3)) };
  return null;
}

export function isSameComparison(a: Comparison, b: Comparison): boolean {
  return targetKey(a) === targetKey(b);
}

export function describeComparison(comparison: Comparison): string {
  switch (comparison.kind) {
    case 'worktree':
      return 'Uncommitted changes';
    case 'branch':
      return `vs ${comparison.against}`;
    case 'commit':
      return `Commit ${comparison.sha.slice(0, 7)}`;
    case 'pull':
      return `Pull request #${comparison.number}`;
  }
}

export function describeTarget(target: string): string {
  const comparison = comparisonOf(target);
  if (comparison?.kind === 'branch') return `Branch vs ${comparison.against}`;
  return comparison ? describeComparison(comparison) : target;
}
