import type {
  CheckState,
  PullRequestInfo,
} from '@reviewer/core/ports/git-provider';

export type { CheckState };

export interface CheckCounts {
  passed: number;
  failed: number;
  pending: number;
  neutral: number;
  total: number;
}

/** What CI says, as one word; `null` when the repository runs no checks. */
export function checksState(pull: PullRequestInfo): CheckState | null {
  const { checks } = pull;
  if (checks.length === 0) return null;
  if (checks.some((check) => check.state === 'failure')) return 'failure';
  if (checks.some((check) => check.state === 'pending')) return 'pending';
  if (checks.some((check) => check.state === 'success')) return 'success';
  return 'neutral';
}

export function countChecks(pull: PullRequestInfo): CheckCounts {
  const of = (state: CheckState) =>
    pull.checks.filter((check) => check.state === state).length;
  return {
    passed: of('success'),
    failed: of('failure'),
    pending: of('pending'),
    neutral: of('neutral'),
    total: pull.checks.length,
  };
}

const HEADLINE: Record<CheckState, string> = {
  failure: 'Checks failing',
  pending: 'Checks running',
  success: 'All checks passing',
  neutral: 'No check reached a verdict',
};

export function checksHeadline(pull: PullRequestInfo): string | null {
  const state = checksState(pull);
  return state && HEADLINE[state];
}

/** `2/9 failing`, or `7/9` passed. */
export function checksTally(pull: PullRequestInfo): string | null {
  const counts = countChecks(pull);
  if (counts.total === 0) return null;
  return counts.failed > 0
    ? `${counts.failed}/${counts.total} failing`
    : `${counts.passed}/${counts.total}`;
}

/** Failures first, then running, skipped and passed — what to read first. */
export function sortedChecks(pull: PullRequestInfo) {
  const order: Record<CheckState, number> = {
    failure: 0,
    pending: 1,
    neutral: 2,
    success: 3,
  };
  return [...pull.checks].sort((a, b) => order[a.state] - order[b.state]);
}

/**
 * A conflict with the base. GitHub works mergeability out lazily, so
 * `unknown` is not drawn as a blocker.
 */
export function blockedReason(pull: PullRequestInfo): string | null {
  return pull.mergeable === 'conflicting'
    ? `#${pull.number} conflicts with ${pull.baseRef} — merge ${pull.baseRef} into ${pull.headRef} and resolve them first`
    : null;
}

/** Only what GitHub itself would refuse; failing checks are the repository's rule. */
export function mergeBlockedReason(pull: PullRequestInfo): string | null {
  if (pull.draft)
    return `#${pull.number} is a draft — mark it ready for review on GitHub first`;
  return blockedReason(pull);
}

/** Reasons to think twice that are not reasons to refuse. */
export function mergeCaution(pull: PullRequestInfo): string | null {
  const counts = countChecks(pull);
  const parts = [
    counts.failed > 0
      ? `${counts.failed} check${counts.failed === 1 ? ' is' : 's are'} failing`
      : null,
    counts.pending > 0
      ? `${counts.pending} check${counts.pending === 1 ? ' is' : 's are'} still running`
      : null,
    pull.mergeable === 'unknown'
      ? 'GitHub has not worked out whether this merges cleanly'
      : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join('; ') : null;
}

/**
 * The local branch a pull request is checked out onto: its own name, or for
 * a fork one named after the pull request — a stranger's `main` is not ours.
 */
export function localBranchForPull(pull: PullRequestInfo): string {
  if (!pull.fromFork) return pull.headRef;
  const safe = pull.headRef
    .replace(/[\s~^:?*[\\]+/g, '-')
    .replace(/\.\.+/g, '.')
    .replace(/^[./]+|[./]+$/g, '');
  return safe.length > 0 ? `pr-${pull.number}-${safe}` : `pr-${pull.number}`;
}

/** Number, title, author and branch, for the list's search. */
export function pullHaystack(pull: PullRequestInfo): string {
  return `#${pull.number} ${pull.title} ${pull.author} ${pull.headRef}`;
}

/** The sidebar's search: a substring of number, title, author or branch; `#` optional. */
export function matchesPull(pull: PullRequestInfo, query: string): boolean {
  const needle = query.trim().replace(/^#/, '').toLowerCase();
  return pullHaystack(pull).toLowerCase().includes(needle);
}

/** By target branch, the branches in name order and GitHub's order within each. */
export function groupByBase(pulls: PullRequestInfo[]) {
  return [...new Set(pulls.map((pull) => pull.baseRef))].sort().map((base) => ({
    base,
    pulls: pulls.filter((pull) => pull.baseRef === base),
  }));
}
