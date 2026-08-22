import { describe, expect, it } from "vitest";
import {
  checkRunState,
  pullFromRest,
  pullsFromGraphql,
  statusContextState,
} from "./pull-request-mapping.ts";

describe("checkRunState", () => {
  it("reads a conclusion when there is one", () => {
    expect(checkRunState("COMPLETED", "SUCCESS")).toBe("success");
    expect(checkRunState("COMPLETED", "TIMED_OUT")).toBe("failure");
    expect(checkRunState("COMPLETED", "SKIPPED")).toBe("neutral");
  });
  it("treats a run that has not concluded as pending", () => {
    expect(checkRunState("IN_PROGRESS", null)).toBe("pending");
    expect(checkRunState("QUEUED", null)).toBe("pending");
  });
  it("does not call a completed run with no conclusion a pass", () => {
    expect(checkRunState("COMPLETED", null)).toBe("neutral");
  });
});

describe("statusContextState", () => {
  it("folds error onto failure", () => {
    expect(statusContextState("ERROR")).toBe("failure");
    expect(statusContextState("PENDING")).toBe("pending");
    expect(statusContextState("SUCCESS")).toBe("success");
  });
});

describe("pullsFromGraphql", () => {
  const data = {
    repository: {
      pullRequests: {
        nodes: [
          {
            number: 7,
            title: "Rework the pull request view",
            body: "Three columns.",
            url: "https://github.com/o/r/pull/7",
            isDraft: false,
            isCrossRepository: true,
            createdAt: "2026-08-01T00:00:00Z",
            updatedAt: "2026-08-02T00:00:00Z",
            additions: 40,
            deletions: 12,
            changedFiles: 3,
            mergeable: "CONFLICTING",
            baseRefName: "development",
            headRefName: "feature/x",
            headRefOid: "abc123",
            author: { login: "railaru" },
            labels: { nodes: [{ name: "ui", color: "ff0000" }] },
            assignees: { nodes: [{ login: "railaru" }] },
            reviewRequests: {
              nodes: [
                { requestedReviewer: { __typename: "User", login: "octocat" } },
                { requestedReviewer: { __typename: "Team", name: "design" } },
                { requestedReviewer: null },
              ],
            },
            commits: {
              nodes: [
                {
                  commit: {
                    statusCheckRollup: {
                      contexts: {
                        nodes: [
                          {
                            __typename: "CheckRun",
                            name: "typecheck",
                            status: "COMPLETED",
                            conclusion: "SUCCESS",
                            detailsUrl: "https://ci/1",
                          },
                          {
                            __typename: "StatusContext",
                            context: "vercel",
                            state: "PENDING",
                            targetUrl: "https://ci/2",
                          },
                        ],
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    },
  };

  it("reads the whole pull request", () => {
    const [pull] = pullsFromGraphql(data);
    expect(pull).toMatchObject({
      number: 7,
      author: "railaru",
      baseRef: "development",
      headRef: "feature/x",
      headSha: "abc123",
      mergeable: "conflicting",
      fromFork: true,
      additions: 40,
      changedFiles: 3,
      assignees: ["railaru"],
      reviewers: ["octocat", "design"],
      labels: [{ name: "ui", color: "ff0000" }],
    });
    expect(pull.checks).toEqual([
      { name: "typecheck", state: "success", url: "https://ci/1" },
      { name: "vercel", state: "pending", url: "https://ci/2" },
    ]);
  });

  it("survives a repo with no pull requests, and a shape it did not expect", () => {
    expect(
      pullsFromGraphql({ repository: { pullRequests: { nodes: [] } } })
    ).toEqual([]);
    expect(pullsFromGraphql(null)).toEqual([]);
    expect(pullsFromGraphql({ repository: null })).toEqual([]);
  });

  it("leaves checks empty when the head commit ran none", () => {
    const [pull] = pullsFromGraphql({
      repository: {
        pullRequests: {
          nodes: [
            {
              number: 1,
              commits: { nodes: [{ commit: { statusCheckRollup: null } }] },
            },
          ],
        },
      },
    });
    expect(pull.checks).toEqual([]);
  });
});

describe("pullFromRest", () => {
  it("reads the listing, and admits what it cannot know", () => {
    const pull = pullFromRest({
      number: 3,
      title: "A change",
      user: { login: "octocat" },
      base: { ref: "main", repo: { full_name: "o/r" } },
      head: { ref: "topic", sha: "deadbeef", repo: { full_name: "fork/r" } },
      html_url: "https://github.com/o/r/pull/3",
      updated_at: "2026-08-02T00:00:00Z",
      created_at: "2026-08-01T00:00:00Z",
      body: "why",
      draft: true,
      labels: [{ name: "bug", color: "d73a4a" }],
      assignees: [{ login: "hubot" }],
    });
    expect(pull).toMatchObject({
      number: 3,
      author: "octocat",
      baseRef: "main",
      headSha: "deadbeef",
      draft: true,
      fromFork: true,
      body: "why",
      labels: [{ name: "bug", color: "d73a4a" }],
      assignees: ["hubot"],
      // No token, no GraphQL, no answer — and it says so rather than guessing.
      mergeable: "unknown",
      checks: [],
    });
  });
});
