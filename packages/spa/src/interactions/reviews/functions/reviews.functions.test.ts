import { describe, expect, it } from "vitest";
import {
  diffSourceHint,
  diffSourceKey,
  diffSourceLabel,
  diffSources,
  filterReviewKind,
  groupReviewsByBase,
  isMergeable,
  reviewFilterCount,
  reviewItems,
  reviewKey,
  worktreeState,
} from "./reviews.functions";
import {
  unenrichedPull,
  type PullRequestInfo,
} from "@byconvo/core/ports/git-provider";
import type { LocalTask } from "@byconvo/core/repo";

const pull = (
  number: number,
  baseRef: string,
  updatedAt: string
): PullRequestInfo => ({
  ...unenrichedPull,
  number,
  title: `PR ${number}`,
  author: "someone",
  baseRef,
  headRef: `feature/${number}`,
  headSha: "abc",
  url: "",
  updatedAt,
});

const worktree = (
  branch: string,
  base: string,
  updatedAt: string,
  rest: Partial<LocalTask> = {}
): LocalTask => ({
  branch,
  base,
  path: `/work/${branch}`,
  name: branch,
  ahead: 2,
  upToDate: true,
  dirty: false,
  subject: `work on ${branch}`,
  author: "me",
  updatedAt,
  ...rest,
});

describe("worktreeState", () => {
  it("is working while nothing has been committed — there is nothing to read yet", () => {
    expect(worktreeState(worktree("a", "dev", "", { ahead: 0 }))).toBe(
      "working"
    );
  });

  it("reports being behind before uncommitted work, since it blocks the merge", () => {
    expect(
      worktreeState(worktree("a", "dev", "", { upToDate: false, dirty: true }))
    ).toBe("behind");
  });

  it("says uncommitted out loud, because merging would leave it behind", () => {
    expect(worktreeState(worktree("a", "dev", "", { dirty: true }))).toBe(
      "uncommitted"
    );
  });

  it("is ready when it has commits, is current with its base and nothing is loose", () => {
    expect(worktreeState(worktree("a", "dev", ""))).toBe("ready");
  });
});

describe("isMergeable", () => {
  it("refuses a worktree with nothing committed", () => {
    expect(isMergeable(worktree("a", "dev", "", { ahead: 0 }))).toBe(false);
  });

  it("refuses a worktree behind its base", () => {
    expect(isMergeable(worktree("a", "dev", "", { upToDate: false }))).toBe(
      false
    );
  });

  it("allows a worktree with loose changes — the commits are what merge", () => {
    expect(isMergeable(worktree("a", "dev", "", { dirty: true }))).toBe(true);
  });
});

describe("reviewItems", () => {
  it("puts worktrees ahead of pull requests, so your own work is not buried", () => {
    const items = reviewItems(
      [pull(1, "dev", "2026-08-18T10:00:00Z")],
      [worktree("mine", "dev", "2026-08-01T10:00:00Z")]
    );
    expect(items.map(reviewKey)).toEqual(["worktree:mine", "pull:1"]);
  });

  it("orders each side newest first", () => {
    const items = reviewItems(
      [
        pull(1, "dev", "2026-08-01T00:00:00Z"),
        pull(2, "dev", "2026-08-18T00:00:00Z"),
      ],
      []
    );
    expect(items.map(reviewKey)).toEqual(["pull:2", "pull:1"]);
  });
});

describe("groupReviewsByBase", () => {
  it("gathers both kinds under the branch they land on", () => {
    const groups = groupReviewsByBase(
      reviewItems(
        [pull(1, "master", "2026-08-18T00:00:00Z")],
        [worktree("mine", "development", "2026-08-18T00:00:00Z")]
      )
    );
    expect(groups.map((group) => group.base)).toEqual([
      "development",
      "master",
    ]);
    expect(groups[0]?.items.map(reviewKey)).toEqual(["worktree:mine"]);
  });
});

describe("diffSources", () => {
  const pulls = [pull(4, "master", "2026-08-18T00:00:00Z")];
  const worktrees = [
    worktree("task/dark-mode", "development", "2026-08-18T00:00:00Z"),
  ];

  it("puts the changes in front of you first, then everything to review", () => {
    expect(diffSources(pulls, worktrees).map(diffSourceKey)).toEqual([
      "local",
      "worktree:task/dark-mode",
      "pull:4",
    ]);
  });

  it("is just the local changes when nothing is waiting", () => {
    expect(diffSources([], []).map(diffSourceKey)).toEqual(["local"]);
  });

  it("labels each source the way its own surface names it", () => {
    expect(diffSources(pulls, worktrees).map(diffSourceLabel)).toEqual([
      "Review",
      "work on task/dark-mode",
      "PR 4",
    ]);
  });

  it("hints at a pull's number and a worktree's destination, and nothing at home", () => {
    expect(diffSources(pulls, worktrees).map(diffSourceHint)).toEqual([
      null,
      "→ development",
      "#4",
    ]);
  });
});

describe("filterReviewKind", () => {
  const pulls = [pull(4, "master", "2026-08-18T00:00:00Z")];
  const worktrees = [
    worktree("task/dark-mode", "development", "2026-08-18T00:00:00Z"),
  ];
  const items = reviewItems(pulls, worktrees);

  it("keeps everything when nothing is narrowed", () => {
    expect(filterReviewKind(items, "all").map(reviewKey)).toEqual([
      "worktree:task/dark-mode",
      "pull:4",
    ]);
  });

  it("narrows to one kind", () => {
    expect(filterReviewKind(items, "worktree").map(reviewKey)).toEqual([
      "worktree:task/dark-mode",
    ]);
    expect(filterReviewKind(items, "pull").map(reviewKey)).toEqual(["pull:4"]);
  });

  it("counts what a tab would show before it is picked", () => {
    expect(reviewFilterCount(items, "all")).toBe(2);
    expect(reviewFilterCount(items, "worktree")).toBe(1);
    expect(reviewFilterCount(items, "pull")).toBe(1);
  });
});
