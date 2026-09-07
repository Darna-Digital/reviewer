/**
 * Where a branch's work is aimed — reviewer's own record, not git's.
 *
 * Git knows a branch's tip and its upstream, never what it is meant to land
 * on, so the answer is recorded when the branch is made and read back here
 * whenever a diff of that branch needs something to be read against.
 */
export const targetOf = (
  targets: ReadonlyArray<{ readonly branch: string; readonly target: string }>,
  branch: string | null
): string | null =>
  branch === null
    ? null
    : (targets.find((entry) => entry.branch === branch)?.target ?? null);
