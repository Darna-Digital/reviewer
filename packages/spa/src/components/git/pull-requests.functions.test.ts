import { describe, expect, it } from "vitest";
import {
  unenrichedPull,
  type PullRequestInfo,
} from "@byconvo/core/ports/git-provider";
import {
  blockedReason,
  checksState,
  checksSummary,
  firstPullRequest,
  groupPullsByBase,
  localBranchForPull,
} from "./pull-requests.functions";

const pull = (number: number, baseRef: string): PullRequestInfo => ({
  ...unenrichedPull,
  number,
  title: `#${number}`,
  author: "someone",
  baseRef,
  headRef: `branch-${number}`,
  headSha: "",
  url: "",
  updatedAt: "",
});

describe("groupPullsByBase", () => {
  it("gathers pulls under their target branch, branches alphabetical", () => {
    const groups = groupPullsByBase([
      pull(3, "release"),
      pull(1, "main"),
      pull(2, "main"),
    ]);
    expect(groups.map((group) => group.base)).toEqual(["main", "release"]);
    expect(groups[0]?.pulls.map((p) => p.number)).toEqual([1, 2]);
  });

  it("keeps the order the list was given inside a group", () => {
    const groups = groupPullsByBase([pull(9, "main"), pull(4, "main")]);
    expect(groups[0]?.pulls.map((p) => p.number)).toEqual([9, 4]);
  });
});

describe("firstPullRequest", () => {
  it("is the row the sidebar draws at the top", () => {
    expect(
      firstPullRequest([pull(3, "release"), pull(1, "main"), pull(2, "main")])
        ?.number
    ).toBe(1);
  });

  it("is nothing when there is nothing to review", () => {
    expect(firstPullRequest([])).toBeNull();
  });
});

const withChecks = (
  states: ReadonlyArray<"success" | "failure" | "pending" | "neutral">
): PullRequestInfo => ({
  ...pull(1, "main"),
  checks: states.map((state, index) => ({
    name: `${state}-${index}`,
    state,
    url: "",
  })),
});

describe("checksState", () => {
  it("is null when the repo runs no checks", () => {
    expect(checksState(withChecks([]))).toBeNull();
  });

  it("reports a failure over anything else", () => {
    expect(checksState(withChecks(["success", "pending", "failure"]))).toBe(
      "failure"
    );
  });

  it("is pending while anything is still running", () => {
    expect(checksState(withChecks(["success", "pending"]))).toBe("pending");
  });

  it("passes only when something passed and nothing else is outstanding", () => {
    expect(checksState(withChecks(["success", "neutral"]))).toBe("success");
    expect(checksState(withChecks(["neutral"]))).toBe("neutral");
  });
});

describe("checksSummary", () => {
  it("counts what it found", () => {
    expect(checksSummary(withChecks(["success", "success", "failure"]))).toBe(
      "Checks failing — 1 failing, 2 passing of 3"
    );
  });

  it("says nothing at all when there is nothing to say", () => {
    expect(checksSummary(withChecks([]))).toBeNull();
  });
});

describe("blockedReason", () => {
  it("names the branch to merge in", () => {
    const conflicting = {
      ...pull(4, "main"),
      mergeable: "conflicting" as const,
    };
    expect(blockedReason(conflicting)).toContain("conflicts with main");
    expect(blockedReason(conflicting)).toContain("branch-4");
  });

  it("does not cry wolf over a mergeability GitHub has not worked out", () => {
    expect(
      blockedReason({ ...pull(4, "main"), mergeable: "unknown" })
    ).toBeNull();
    expect(
      blockedReason({ ...pull(4, "main"), mergeable: "mergeable" })
    ).toBeNull();
  });
});

describe("localBranchForPull", () => {
  it("uses the pull request's own branch when it is one of ours", () => {
    expect(localBranchForPull(pull(4, "main"))).toBe("branch-4");
  });

  it("keeps a fork's branch off ours of the same name", () => {
    const fork = {
      ...pull(12, "main"),
      headRef: "development",
      fromFork: true,
    };
    expect(localBranchForPull(fork)).toBe("pr-12-development");
  });

  it("scrubs a name git would refuse", () => {
    const fork = {
      ...pull(12, "main"),
      headRef: "feat/a b~c..d",
      fromFork: true,
    };
    expect(localBranchForPull(fork)).toBe("pr-12-feat/a-b-c.d");
  });

  it("still names a branch when a fork's is unusable", () => {
    const fork = { ...pull(12, "main"), headRef: "...", fromFork: true };
    expect(localBranchForPull(fork)).toBe("pr-12");
  });
});
