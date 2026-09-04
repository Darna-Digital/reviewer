import { describe, expect, it } from "vitest";
import {
  cloudAppHref,
  pullNumberOf,
  reviewDestination,
  sameRepo,
} from "./cloud-review.functions";

const run = (
  pullRequestUrl: string | null,
  repoFullName = "darna/byconvo"
) => ({
  pullRequestUrl,
  repoFullName,
});
const open = (owner: string, repo: string) => ({ github: { owner, repo } });

describe("where a cloud run's pull request is reviewed", () => {
  it("reads the number out of a pull request URL", () => {
    expect(pullNumberOf("https://github.com/darna/byconvo/pull/12")).toBe(12);
    expect(pullNumberOf("https://github.com/darna/byconvo/pull/12/files")).toBe(
      12
    );
    expect(pullNumberOf("https://github.com/darna/byconvo/pull/7?w=1")).toBe(7);
  });

  it("answers nothing for a URL it cannot route to", () => {
    expect(
      pullNumberOf("https://github.com/darna/byconvo/pull/abc")
    ).toBeNull();
    expect(pullNumberOf("https://github.com/darna/byconvo/pulls")).toBeNull();
    expect(
      pullNumberOf("https://example.com/darna/byconvo/issues/12")
    ).toBeNull();
    expect(pullNumberOf("")).toBeNull();
    // A number that is not a pull request number.
    expect(pullNumberOf("https://github.com/d/b/pull/0")).toBeNull();
  });

  it("compares repositories the way GitHub does — without case", () => {
    expect(sameRepo("darna/byconvo", { owner: "Darna", repo: "ByConvo" })).toBe(
      true
    );
    expect(sameRepo("darna/byconvo", { owner: "darna", repo: "other" })).toBe(
      false
    );
    expect(sameRepo("darna/byconvo", null)).toBe(false);
  });

  it("reviews it here when the run's repository is the open one", () => {
    expect(
      reviewDestination(
        run("https://github.com/darna/byconvo/pull/12"),
        open("darna", "byconvo")
      )
    ).toEqual({
      kind: "byconvo",
      href: "/modes/code/review/pull/12",
      number: 12,
    });
  });

  it("sends you out when the run was against another repository", () => {
    // The trap this exists for: #12 here is not #12 there.
    expect(
      reviewDestination(
        run("https://github.com/darna/byconvo/pull/12"),
        open("darna", "byconvo-cloud")
      )
    ).toEqual({
      kind: "elsewhere",
      url: "https://github.com/darna/byconvo/pull/12",
      repoFullName: "darna/byconvo",
    });
  });

  it("sends you out when byconvo has no repository, or a repository with no GitHub remote", () => {
    for (const local of [null, undefined, { github: null }]) {
      expect(
        reviewDestination(
          run("https://github.com/darna/byconvo/pull/12"),
          local
        ).kind
      ).toBe("elsewhere");
    }
  });

  it("offers nothing while there is no pull request", () => {
    expect(reviewDestination(run(null), open("darna", "byconvo"))).toEqual({
      kind: "none",
    });
    expect(reviewDestination(run(""), open("darna", "byconvo"))).toEqual({
      kind: "none",
    });
  });
});

describe("a page of the cloud app", () => {
  it("joins the server URL and the path without doubling the slash", () => {
    expect(cloudAppHref("https://byconvo.com", "/app/repos")).toBe(
      "https://byconvo.com/app/repos"
    );
    expect(cloudAppHref("https://byconvo.com/", "/app/repos")).toBe(
      "https://byconvo.com/app/repos"
    );
    expect(cloudAppHref("http://localhost:3000///", "app/repos")).toBe(
      "http://localhost:3000/app/repos"
    );
  });
});
