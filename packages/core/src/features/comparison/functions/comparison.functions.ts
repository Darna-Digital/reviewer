/**
 * What a local diff is read against, as plain answers.
 *
 * Reading your own work is always a comparison, even when nothing has been
 * chosen: the branch as it is committed, against the branch as it sits on
 * disk. Naming a branch moves the left-hand side back to where the two parted —
 * the merge base — which is what makes "how does my feature branch differ from
 * `main`" a question you can ask without opening a pull request.
 *
 * Pure, and held in core rather than in the SPA, because the server resolves
 * the same target (`/api/diff?target=`) and both sides should agree on what an
 * absent, empty, or named target means.
 */

/**
 * The left-hand side of a local diff.
 *
 * `uncommitted` is `HEAD` — what the branch has committed. `branch` is the
 * merge base with the named ref, so the target's own later commits stay out of
 * it. The right-hand side is the working tree either way: work that is written
 * but not yet committed is the part of a review most worth looking at.
 */
export type LocalComparison =
  | { readonly kind: "uncommitted" }
  | { readonly kind: "branch"; readonly against: string };

export const UNCOMMITTED: LocalComparison = { kind: "uncommitted" };

/** A ref that is only whitespace is no ref at all. */
const named = (ref: string | null | undefined): string | null => {
  if (ref === null || ref === undefined) return null;
  const trimmed = ref.trim();
  return trimmed.length === 0 ? null : trimmed;
};

/**
 * What the diff is read against, given what was asked for and where the branch
 * is aimed.
 *
 * `requested` is the choice in front of you — the URL's `target`. It wins even
 * when it is empty, because the empty string is how "I meant uncommitted only"
 * is said out loud; only its absence lets the recorded aim answer. `aim` is
 * where the branch was pointed when it was made, so arriving at a task's
 * changes does not ask a question that has already been answered.
 */
export const resolveComparison = (
  requested: string | null | undefined,
  aim: string | null | undefined
): LocalComparison => {
  const chosen =
    requested === null || requested === undefined ? null : requested;
  const ref = chosen === null ? named(aim) : named(chosen);
  return ref === null ? UNCOMMITTED : { kind: "branch", against: ref };
};

/** The `target` query the diff endpoint wants; null asks for the worktree diff. */
export const comparisonTarget = (comparison: LocalComparison): string | null =>
  comparison.kind === "branch" ? comparison.against : null;

/**
 * What the URL should carry for a choice, so that choosing "uncommitted only"
 * is recorded rather than left to the branch's aim to answer again.
 */
export const comparisonSearch = (comparison: LocalComparison): string =>
  comparison.kind === "branch" ? comparison.against : "";

/** Whether a menu row is the one that is on. */
export const isComparing = (
  comparison: LocalComparison,
  branch: string | null
): boolean =>
  branch === null
    ? comparison.kind === "uncommitted"
    : comparison.kind === "branch" && comparison.against === branch;

/** How a comparison reads: the two sides, and the sentence they make. */
export interface ComparisonLabels {
  /** The left-hand side — what the changes are measured from. */
  readonly base: string;
  /** The right-hand side — always the branch as it sits on disk. */
  readonly head: string;
  /**
   * The right-hand side without repeating a name the left-hand side has just
   * said. Comparing a branch against itself-with-changes, "feature/x ⇄
   * feature/x with changes" spends a header row saying the branch twice; on a
   * strip that is one line wide, both halves end up ellipsed and neither is
   * readable. The whole sentence is still a hover away in `summary`.
   */
  readonly headShort: string;
  /** The whole of it in one line, for a tooltip or a screen reader. */
  readonly summary: string;
}

/** A detached head has no name to put on either side of the comparison. */
const DETACHED = "this checkout";

export const comparisonLabels = (
  comparison: LocalComparison,
  branch: string | null
): ComparisonLabels => {
  const here = named(branch) ?? DETACHED;
  const base = comparison.kind === "branch" ? comparison.against : here;
  const head = `${here} with changes`;
  return {
    base,
    head,
    headShort: comparison.kind === "branch" ? head : "with changes",
    summary: `Comparing ‘${base}’ against ‘${head}’`,
  };
};

/** A branch offered as something to compare against. */
export interface ComparisonCandidate {
  /** The ref as git knows it — `main`, or `origin/main` for a remote. */
  readonly ref: string;
  /** How it reads in the menu: a remote keeps its remote in the name. */
  readonly label: string;
  /** Where the branch's work is meant to land, when this is that branch. */
  readonly aimed: boolean;
}

export interface ComparisonCandidates {
  readonly local: ReadonlyArray<ComparisonCandidate>;
  readonly remote: ReadonlyArray<ComparisonCandidate>;
}

const matching = (query: string) => {
  const q = query.trim().toLowerCase();
  return (ref: string) => q.length === 0 || ref.toLowerCase().includes(q);
};

/**
 * The branches worth offering, split by where they live.
 *
 * The checked-out branch is left out of the local list: a branch diffed with
 * itself says nothing that "uncommitted only" does not already say. Its remote
 * counterpart stays in, because `origin/feature` against `feature` is exactly
 * the question "what have I not pushed yet".
 */
export const comparisonCandidates = ({
  branches,
  remoteBranches,
  current,
  aim,
  query = "",
}: {
  readonly branches: ReadonlyArray<string>;
  readonly remoteBranches: ReadonlyArray<string>;
  readonly current: string | null;
  readonly aim?: string | null;
  readonly query?: string;
}): ComparisonCandidates => {
  const keep = matching(query);
  const aimed = named(aim);
  const candidate = (ref: string): ComparisonCandidate => ({
    ref,
    label: ref,
    aimed: ref === aimed,
  });
  return {
    local: branches
      .filter((ref) => ref !== current)
      .filter(keep)
      .map(candidate),
    remote: remoteBranches.filter(keep).map(candidate),
  };
};

/** Nothing left to pick from once a search has ruled everything out. */
export const noCandidates = (candidates: ComparisonCandidates): boolean =>
  candidates.local.length === 0 && candidates.remote.length === 0;
