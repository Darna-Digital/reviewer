/**
 * The order the review sidebar reads in: pull requests gathered under the branch
 * they target, the branches alphabetical, each group keeping the order GitHub
 * listed them in.
 *
 * Held apart from the list because it is the shape of the page rather than a
 * detail of how the page is drawn, and because an ordering is worth testing on
 * its own.
 */
import type {
  CheckState,
  PullRequestInfo,
} from "@byconvo/core/ports/git-provider";

export interface PullRequestGroup {
  readonly base: string;
  readonly pulls: ReadonlyArray<PullRequestInfo>;
}

export function groupPullsByBase(
  pulls: ReadonlyArray<PullRequestInfo>
): ReadonlyArray<PullRequestGroup> {
  return [...new Set(pulls.map((pull) => pull.baseRef))].sort().map((base) => ({
    base,
    pulls: pulls.filter((pull) => pull.baseRef === base),
  }));
}

/**
 * What CI says about a pull request, as one word.
 *
 * `null` is "this repository runs no checks on this commit", which is not the
 * same as passing and must not be drawn as one — a green tick nobody earned is
 * worse than no tick at all.
 */
export function checksState(pull: PullRequestInfo): CheckState | null {
  const { checks } = pull;
  if (checks.length === 0) return null;
  if (checks.some((check) => check.state === "failure")) return "failure";
  if (checks.some((check) => check.state === "pending")) return "pending";
  if (checks.some((check) => check.state === "success")) return "success";
  return "neutral";
}

export interface CheckCounts {
  readonly passed: number;
  readonly failed: number;
  readonly pending: number;
  readonly neutral: number;
  readonly total: number;
}

export function countChecks(pull: PullRequestInfo): CheckCounts {
  const of = (state: CheckState) =>
    pull.checks.filter((check) => check.state === state).length;
  return {
    passed: of("success"),
    failed: of("failure"),
    pending: of("pending"),
    neutral: of("neutral"),
    total: pull.checks.length,
  };
}

/** The sentence a CI badge says on hover — the counts, not just the verdict. */
export function checksSummary(pull: PullRequestInfo): string | null {
  const state = checksState(pull);
  if (state === null) return null;
  const counts = countChecks(pull);
  const parts = [
    counts.failed > 0 ? `${counts.failed} failing` : null,
    counts.pending > 0 ? `${counts.pending} running` : null,
    counts.passed > 0 ? `${counts.passed} passing` : null,
    counts.neutral > 0 ? `${counts.neutral} skipped` : null,
  ].filter((part): part is string => part !== null);
  const head =
    state === "failure"
      ? "Checks failing"
      : state === "pending"
        ? "Checks running"
        : state === "success"
          ? "All checks passing"
          : "Checks finished without a verdict";
  return `${head} — ${parts.join(", ")} of ${counts.total}`;
}

/**
 * Why this pull request cannot be merged as it stands, or null when nothing is
 * in the way that we know of.
 *
 * "Unknown" says nothing: GitHub works mergeability out lazily, so a pull
 * request nobody has opened lately reports it as unknown for a moment and then
 * settles. Drawing a blocker for that would cry wolf on every cold list.
 */
export function blockedReason(pull: PullRequestInfo): string | null {
  return pull.mergeable === "conflicting"
    ? `#${pull.number} conflicts with ${pull.baseRef}. ` +
        `Merge ${pull.baseRef} into ${pull.headRef} and resolve the ` +
        "conflicts before this can be merged."
    : null;
}

/**
 * The local branch a pull request should be checked out onto.
 *
 * Its own branch name, unless it came from a fork — in which case the name is
 * someone else's and may well be one of ours too. Fast-forwarding your
 * `development` onto a stranger's `development` because both happen to be
 * called that is not what "check out this pull request" asked for, so a fork
 * lands on a branch named after the pull request instead.
 */
export function localBranchForPull(pull: PullRequestInfo): string {
  if (!pull.fromFork) return pull.headRef;
  // Ref names may not hold a space, `~^:?*[`, a backslash, or two dots in a
  // row; a fork's branch name has been through none of our validation.
  const safe = pull.headRef
    .replace(/[\s~^:?*[\\]+/g, "-")
    .replace(/\.\.+/g, ".")
    .replace(/^[./]+|[./]+$/g, "");
  return safe.length > 0 ? `pr-${pull.number}-${safe}` : `pr-${pull.number}`;
}
