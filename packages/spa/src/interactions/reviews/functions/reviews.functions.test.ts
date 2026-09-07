import { describe, expect, it } from "vitest";
import {
  diffSourceHint,
  diffSourceKey,
  diffSourceLabel,
  diffSources,
  groupReviewsByBase,
  reviewItems,
  reviewKey,
} from "./reviews.functions";
import {
  unenrichedPull,
  type PullRequestInfo,
} from "@reviewer/core/ports/git-provider";

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

describe("reviewItems", () => {
  it("orders them newest first", () => {
    const items = reviewItems([
      pull(1, "dev", "2026-08-01T00:00:00Z"),
      pull(2, "dev", "2026-08-18T00:00:00Z"),
    ]);
    expect(items.map(reviewKey)).toEqual(["pull:2", "pull:1"]);
  });
});

describe("groupReviewsByBase", () => {
  it("gathers them under the branch they land on", () => {
    const groups = groupReviewsByBase(
      reviewItems([
        pull(1, "master", "2026-08-18T00:00:00Z"),
        pull(2, "development", "2026-08-17T00:00:00Z"),
      ])
    );
    expect(groups.map((group) => group.base)).toEqual([
      "development",
      "master",
    ]);
    expect(groups[0]?.items.map(reviewKey)).toEqual(["pull:2"]);
  });
});

describe("diffSources", () => {
  const pulls = [pull(4, "master", "2026-08-18T00:00:00Z")];

  it("puts the changes in front of you first, then everything to review", () => {
    expect(diffSources(pulls).map(diffSourceKey)).toEqual(["local", "pull:4"]);
  });

  it("is just the local changes when nothing is waiting", () => {
    expect(diffSources([]).map(diffSourceKey)).toEqual(["local"]);
  });

  it("labels each source the way its own surface names it", () => {
    expect(diffSources(pulls).map(diffSourceLabel)).toEqual(["Review", "PR 4"]);
  });

  it("hints at a pull's number, and nothing at home", () => {
    expect(diffSources(pulls).map(diffSourceHint)).toEqual([null, "#4"]);
  });
});
