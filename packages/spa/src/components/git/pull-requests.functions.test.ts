import { describe, expect, it } from "vitest";
import type { PullRequestInfo } from "@byconvo/core/ports/git-provider";
import { firstPullRequest, groupPullsByBase } from "./pull-requests.functions";

const pull = (number: number, baseRef: string): PullRequestInfo => ({
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
