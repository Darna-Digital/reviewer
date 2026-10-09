import type { PullRequestInfo } from '@reviewer/core/ports/git-provider';

/** A plain open pull request for tests, with `patch` on top. */
export function pullFixture(
  patch: Partial<PullRequestInfo> = {},
): PullRequestInfo {
  return {
    number: 7,
    title: 'Connect onboarding to the backend',
    author: 'rutenis',
    baseRef: 'main',
    headRef: 'onboarding',
    headSha: 'abc123',
    url: 'https://github.com/darna/reviewer/pull/7',
    updatedAt: '2026-10-09T10:00:00Z',
    createdAt: '2026-10-08T10:00:00Z',
    body: '',
    draft: false,
    fromFork: false,
    mergeable: 'mergeable',
    checks: [],
    assignees: [],
    reviewers: [],
    labels: [],
    additions: 10,
    deletions: 2,
    changedFiles: 3,
    ...patch,
  };
}
