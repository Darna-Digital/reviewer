import { describe, expect, it } from "vitest";
import {
  cloudAppHref,
  pullNumberOf,
  reviewDestination,
  sameRepo,
} from "./cloud-review.functions";

const run = (
  pullRequestUrl: string | null,
  repoFullName = "darna/reviewer"
) => ({
  pullRequestUrl,
  repoFullName,
});
const open = (owner: string, repo: string) => ({ github: { owner, repo } });

describe("where a cloud run's pull request is reviewed", () => {
  it("reads the number out of a pull request URL", () => {
    expect(pullNumberOf("https://github.com/darna/reviewer/pull/12")).toBe(12);
    expect(
      pullNumberOf("https://github.com/darna/reviewer/pull/12/files")
    ).toBe(12);
    expect(pullNumberOf("https://github.com/darna/reviewer/pull/7?w=1")).toBe(
      7
    );
  });

  it("answers nothing for a URL it cannot route to", () => {
    expect(
      pullNumberOf("https://github.com/darna/reviewer/pull/abc")
    ).toBeNull();
    expect(pullNumberOf("https://github.com/darna/reviewer/pulls")).toBeNull();
    expect(
      pullNumberOf("https://example.com/darna/reviewer/issues/12")
    ).toBeNull();
    expect(pullNumberOf("")).toBeNull();
    // A number that is not a pull request number.
    expect(pullNumberOf("https://github.com/d/b/pull/0")).toBeNull();
  });

  it("compares repositories the way GitHub does — without case", () => {
    expect(
      sameRepo("darna/reviewer", { owner: "Darna", repo: "Reviewer" })
    ).toBe(true);
    expect(sameRepo("darna/reviewer", { owner: "darna", repo: "other" })).toBe(
      false
    );
    expect(sameRepo("darna/reviewer", null)).toBe(false);
  });

  it("reviews it here when the run's repository is the open one", () => {
    expect(
      reviewDestination(
        run("https://github.com/darna/reviewer/pull/12"),
        open("darna", "reviewer")
      )
    ).toEqual({
      kind: "reviewer",
      href: "/modes/code/review/pull/12",
      number: 12,
    });
  });

  it("sends you out when the run was against another repository", () => {
    // The trap this exists for: #12 here is not #12 there.
    expect(
      reviewDestination(
        run("https://github.com/darna/reviewer/pull/12"),
        open("darna", "reviewer-cloud")
      )
    ).toEqual({
      kind: "elsewhere",
      url: "https://github.com/darna/reviewer/pull/12",
      repoFullName: "darna/reviewer",
    });
  });

  it("sends you out when reviewer has no repository, or a repository with no GitHub remote", () => {
    for (const local of [null, undefined, { github: null }]) {
      expect(
        reviewDestination(
          run("https://github.com/darna/reviewer/pull/12"),
          local
        ).kind
      ).toBe("elsewhere");
    }
  });

  it("offers nothing while there is no pull request", () => {
    expect(reviewDestination(run(null), open("darna", "reviewer"))).toEqual({
      kind: "none",
    });
    expect(reviewDestination(run(""), open("darna", "reviewer"))).toEqual({
      kind: "none",
    });
  });
});

describe("a page of the cloud app", () => {
  it("joins the server URL and the path without doubling the slash", () => {
    expect(
      cloudAppHref("https://reviewer.darnadigital.com", "/app/repos")
    ).toBe("https://reviewer.darnadigital.com/app/repos");
    expect(
      cloudAppHref("https://reviewer.darnadigital.com/", "/app/repos")
    ).toBe("https://reviewer.darnadigital.com/app/repos");
    expect(cloudAppHref("http://localhost:3000///", "app/repos")).toBe(
      "http://localhost:3000/app/repos"
    );
  });
});
