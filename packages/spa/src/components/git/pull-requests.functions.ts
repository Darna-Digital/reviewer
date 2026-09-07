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
} from "@reviewer/core/ports/git-provider";

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

/**
 * The verdict, in as few words as a row can hold. The numbers behind it are
 * `checksTally`'s job and the breakdown is `checksSummary`'s — a headline that
 * carried its own counts would be a sentence, and a sentence does not line up
 * with the rows under it.
 */
export function checksHeadline(pull: PullRequestInfo): string | null {
  switch (checksState(pull)) {
    case "failure":
      return "Checks failing";
    case "pending":
      return "Checks running";
    case "success":
      return "All checks passing";
    case "neutral":
      return "No check reached a verdict";
    default:
      return null;
  }
}

/** How many of them are through and passing, as a row's right-hand figure. */
export function checksTally(pull: PullRequestInfo): string | null {
  const counts = countChecks(pull);
  if (counts.total === 0) return null;
  return counts.failed > 0
    ? `${counts.failed}/${counts.total} failing`
    : `${counts.passed}/${counts.total}`;
}

/** The sentence a CI badge says on hover — the counts, not just the verdict. */
export function checksSummary(pull: PullRequestInfo): string | null {
  const head = checksHeadline(pull);
  if (head === null) return null;
  const counts = countChecks(pull);
  const parts = [
    counts.failed > 0 ? `${counts.failed} failing` : null,
    counts.pending > 0 ? `${counts.pending} running` : null,
    counts.passed > 0 ? `${counts.passed} passing` : null,
    counts.neutral > 0 ? `${counts.neutral} skipped` : null,
  ].filter((part): part is string => part !== null);
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

/**
 * Why the merge button cannot be pressed, or null when it can.
 *
 * Only the two things GitHub itself would refuse: a draft, and a branch that
 * conflicts with its base. Failing checks are deliberately not here — whether a
 * red check should stop a merge is the repository's rule to enforce, not this
 * window's guess at one, and a button greyed out over a check the repo does not
 * require is a button that lies.
 */
export function mergeBlockedReason(pull: PullRequestInfo): string | null {
  if (pull.draft) {
    return `#${pull.number} is a draft. Mark it ready for review on GitHub before merging.`;
  }
  return blockedReason(pull);
}

/**
 * What the confirmation has to say beyond the branch names — the reasons to
 * think twice that are not reasons to refuse.
 */
export function mergeCaution(pull: PullRequestInfo): string | null {
  const counts = countChecks(pull);
  const parts = [
    counts.failed > 0
      ? `${counts.failed} check${counts.failed === 1 ? " is" : "s are"} failing`
      : null,
    counts.pending > 0
      ? `${counts.pending} check${counts.pending === 1 ? " is" : "s are"} still running`
      : null,
    pull.mergeable === "unknown"
      ? "GitHub has not worked out whether this merges cleanly"
      : null,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : `${parts.join(", ")}.`;
}
