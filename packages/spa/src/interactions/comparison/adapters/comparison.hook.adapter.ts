/**
 * What the local diff is being read against, and how to change it.
 *
 * One hook rather than two readings of the same state: the header's picker and
 * the page's diff both have to agree on what is on screen, and they are
 * mounted separately — the header by the layout, the diff by the page under
 * it. Both ask here.
 *
 * The choice lives in the URL (`?target=`), not in a store, so a comparison is
 * something you can link to, go back out of, and reload into.
 */
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import {
  comparisonSearch,
  resolveComparison,
  type LocalComparison,
} from "@reviewer/core/comparison";
import { targetOf } from "@/interactions/branch-targets/functions/branch-targets.functions";
import {
  useBranchTargets,
  useBranches,
  useRemoteBranches,
  useRepo,
} from "@/lib/queries";
import { REVIEW_HREF } from "@/lib/shell-route";

export interface LocalComparisonState {
  /** What the diff is read against right now. */
  readonly comparison: LocalComparison;
  /** The branch the work is on — the right-hand side of every comparison. */
  readonly branch: string | null;
  /** Where this branch's work is aimed, when it has been aimed anywhere. */
  readonly aim: string | null;
  readonly branches: ReadonlyArray<string>;
  readonly remoteBranches: ReadonlyArray<string>;
  /** Read the changes against `ref`, or against nothing when it is null. */
  readonly compareAgainst: (ref: string | null) => void;
}

export function useLocalComparison(): LocalComparisonState {
  const navigate = useNavigate();
  const search = useSearch({ strict: false });
  const repo = useRepo();
  const branches = useBranches();
  const remoteBranches = useRemoteBranches();
  const branchTargets = useBranchTargets();

  const branch = repo.data?.currentBranch ?? null;
  const aim = targetOf(branchTargets.data ?? [], branch);
  const comparison = resolveComparison(search.target, aim);

  const compareAgainst = useCallback(
    (ref: string | null) =>
      void navigate({
        to: REVIEW_HREF,
        search: {
          // Written even when it is empty: an absent target would only let the
          // branch's own aim answer again, and this is how you say otherwise.
          target: comparisonSearch(
            ref === null
              ? { kind: "uncommitted" }
              : { kind: "branch", against: ref }
          ),
        },
      }),
    [navigate]
  );

  const names = useMemo(
    () => (branches.data ?? []).map((entry) => entry.name),
    [branches.data]
  );
  const remoteNames = useMemo(
    () => (remoteBranches.data ?? []).map((entry) => entry.name),
    [remoteBranches.data]
  );

  return {
    comparison,
    branch,
    aim,
    branches: names,
    remoteBranches: remoteNames,
    compareAgainst,
  };
}
