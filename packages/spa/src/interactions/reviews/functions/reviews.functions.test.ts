import { describe, expect, it } from "vitest";
import {
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
