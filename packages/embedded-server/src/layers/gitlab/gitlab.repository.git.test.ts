import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { describe, expect, it } from "vitest";
import { GitProviderError } from "@byconvo/core/ports/git-provider";
import type { GitProviderShape } from "@byconvo/core/ports/git-provider";
import { GitLabClient, type GitLabClientShape } from "./gitlab-client.ts";
import { makeGitLabProvider, mergePayload } from "./gitlab.repository.git.ts";

const PROJECT = "acme%2Fteam%2Fapp";

interface Call {
  readonly method: string;
  readonly path: string;
  readonly body?: unknown;
}

/**
 * A GitLab that answers from a table of canned responses and writes down what
 * it was asked. Every question the provider asks is a path, so the paths — and
 * the payloads it puts on them — are exactly what these tests are about.
 */
const fakeGitLab = (
  answers: Record<string, unknown>,
  calls: Array<Call> = [],
  /** What GraphQL answers, or a failure so the REST fallback is taken. */
  graphqlData: unknown = null
): GitLabClientShape => {
  const answer = (method: string, path: string, body?: unknown) => {
    calls.push(body === undefined ? { method, path } : { method, path, body });
    const found = Object.entries(answers).find(([key]) =>
      path.startsWith(key)
    )?.[1];
    return found === undefined
      ? Effect.fail(
          new GitProviderError({ status: 404, reason: `no stub for ${path}` })
        )
      : Effect.succeed(found);
  };
  return {
    project: Effect.succeed({
      path: "acme/team/app",
      id: PROJECT,
      webUrl: "https://gitlab.com",
    }),
    getJson: (path) => answer("GET", path),
    postJson: (path, body) => answer("POST", path, body),
    putJson: (path, body) => answer("PUT", path, body),
    deleteResource: (path) => Effect.asVoid(answer("DELETE", path)),
    graphql: (_query, variables) => {
      calls.push({ method: "GRAPHQL", path: "/api/graphql", body: variables });
      return graphqlData === null
        ? Effect.fail(
            new GitProviderError({
              reason: "Field 'diffStatsSummary' doesn't exist",
            })
          )
        : Effect.succeed(graphqlData);
    },
  };
};

const run = <A>(
  answers: Record<string, unknown>,
  use: (provider: GitProviderShape) => Effect.Effect<A, GitProviderError>,
  calls: Array<Call> = [],
  graphqlData: unknown = null
) =>
  Effect.runPromise(
    Effect.flatMap(makeGitLabProvider, use).pipe(
      Effect.provide(
        Layer.succeed(GitLabClient)(
          GitLabClient.of(fakeGitLab(answers, calls, graphqlData))
        )
      )
    )
  );

const mergeRequests = [
  {
    iid: 12,
    title: "Add the thing",
    author: { username: "ada" },
    source_branch: "feature",
    target_branch: "main",
    sha: "deadbeef",
    web_url: "https://gitlab.com/acme/team/app/-/merge_requests/12",
    updated_at: "2026-01-02T00:00:00Z",
    merge_status: "can_be_merged",
  },
];

describe("pulls", () => {
  it("asks GraphQL first, which is the only answer that carries CI", async () => {
    const calls: Array<Call> = [];
    const pulls = await run({}, (provider) => provider.pulls, calls, {
      project: {
        mergeRequests: {
          nodes: [
            {
              iid: "12",
              title: "Add the thing",
              targetBranch: "main",
              sourceBranch: "feature",
              webUrl: "https://gitlab.com/acme/team/app/-/merge_requests/12",
              mergeStatusEnum: "CAN_BE_MERGED",
              diffStatsSummary: {
                additions: 9,
                deletions: 2,
                fileCount: 3,
              },
              headPipeline: {
                status: "FAILED",
                path: "/acme/team/app/-/pipelines/9",
              },
            },
          ],
        },
      },
    });

    expect(pulls[0]).toMatchObject({
      number: 12,
      additions: 9,
      deletions: 2,
      changedFiles: 3,
      checks: [
        {
          name: "Pipeline",
          state: "failure",
          url: "https://gitlab.com/acme/team/app/-/pipelines/9",
        },
      ],
    });
    expect(calls[0]).toMatchObject({
      method: "GRAPHQL",
      body: { path: "acme/team/app" },
    });
  });

  it("falls back to the listing when GraphQL refuses the query", async () => {
    const calls: Array<Call> = [];
    const pulls = await run(
      { [`/projects/${PROJECT}/merge_requests?`]: mergeRequests },
      (provider) => provider.pulls,
      calls
    );

    expect(pulls.map((pull) => pull.number)).toEqual([12]);
    // The lesser answer: a listing, with no pipeline on it.
    expect(pulls[0]?.checks).toEqual([]);
    expect(calls[1]?.path).toContain("state=opened");
    expect(calls[1]?.path).toContain("order_by=updated_at");
    expect(calls[1]?.path).toContain("with_labels_details=true");
  });
});

describe("pullDiff", () => {
  const diffs = [
    { old_path: "a.ts", new_path: "a.ts", diff: "@@ -1 +1 @@\n-a\n+b" },
  ];

  it("stitches the file patches into one diff", async () => {
    const diff = await run(
      { [`/projects/${PROJECT}/merge_requests/12/diffs`]: diffs },
      (provider) => provider.pullDiff(12)
    );

    expect(diff).toBe(
      [
        "diff --git a/a.ts b/a.ts",
        "--- a/a.ts",
        "+++ b/a.ts",
        "@@ -1 +1 @@",
        "-a",
        "+b",
        "",
      ].join("\n")
    );
  });

  it("falls back to /changes on a GitLab too old to have /diffs", async () => {
    const calls: Array<Call> = [];
    const diff = await run(
      {
        [`/projects/${PROJECT}/merge_requests/12/changes`]: { changes: diffs },
      },
      (provider) => provider.pullDiff(12),
      calls
    );

    expect(diff).toContain("diff --git a/a.ts b/a.ts");
    expect(calls.map((call) => call.path)).toEqual([
      `/projects/${PROJECT}/merge_requests/12/diffs?per_page=100&page=1`,
      `/projects/${PROJECT}/merge_requests/12/changes`,
    ]);
  });
});

describe("pullComments", () => {
  it("reads the discussions as line comments", async () => {
    const comments = await run(
      {
        [`/projects/${PROJECT}/merge_requests/12/discussions`]: [
          {
            id: "d1",
            notes: [
              {
                id: 5,
                body: "nit",
                author: { username: "ada" },
                created_at: "2026-01-03T00:00:00Z",
                position: { new_path: "a.ts", new_line: 3 },
              },
            ],
          },
        ],
      },
      (provider) => provider.pullComments(12)
    );

    expect(comments).toEqual([
      {
        id: "gl-d1-5",
        filePath: "a.ts",
        side: "additions",
        lineNumber: 3,
        body: "nit",
        author: "ada",
        createdAt: "2026-01-03T00:00:00Z",
        target: "pr-12",
        source: "gitlab",
      },
    ]);
  });
});

describe("createPullComment", () => {
  const answers = {
    [`/projects/${PROJECT}/merge_requests/12/discussions`]: {
      id: "d7",
      notes: [
        {
          id: 8,
          body: "please rename this",
          author: { username: "ada" },
          created_at: "2026-01-05T00:00:00Z",
        },
      ],
    },
    [`/projects/${PROJECT}/merge_requests/12`]: {
      diff_refs: { base_sha: "b1", head_sha: "h1", start_sha: "s1" },
    },
  };

  it("anchors a new comment to the diff the merge request is against", async () => {
    const calls: Array<Call> = [];
    const created = await run(
      answers,
      (provider) =>
        provider.createPullComment({
          pullNumber: 12,
          filePath: "src/a.ts",
          side: "additions",
          lineNumber: 42,
          body: "please rename this",
        }),
      calls
    );

    expect(created).toMatchObject({
      id: "gl-d7-8",
      filePath: "src/a.ts",
      lineNumber: 42,
      source: "gitlab",
      author: "ada",
    });
    expect(calls.at(-1)?.body).toEqual({
      body: "please rename this",
      position: {
        base_sha: "b1",
        head_sha: "h1",
        start_sha: "s1",
        position_type: "text",
        new_path: "src/a.ts",
        old_path: "src/a.ts",
        new_line: 42,
      },
    });
  });

  it("puts a comment on a removed line on the old side", async () => {
    const calls: Array<Call> = [];
    await run(
      answers,
      (provider) =>
        provider.createPullComment({
          pullNumber: 12,
          filePath: "src/a.ts",
          side: "deletions",
          lineNumber: 7,
          body: "why did this go?",
        }),
      calls
    );

    expect(calls.at(-1)?.body).toMatchObject({
      position: { old_line: 7 },
    });
    expect(calls.at(-1)?.body).not.toMatchObject({
      position: { new_line: 7 },
    });
  });

  it("says so when GitLab cannot name the diff to anchor against", async () => {
    await expect(
      run({ [`/projects/${PROJECT}/merge_requests/12`]: {} }, (provider) =>
        provider.createPullComment({
          pullNumber: 12,
          filePath: "a.ts",
          side: "additions",
          lineNumber: 1,
          body: "hi",
        })
      )
    ).rejects.toThrow(/could not resolve the diff/);
  });
});

describe("replyToPullComment", () => {
  it("posts into the discussion and keeps the parent's line", async () => {
    const calls: Array<Call> = [];
    const reply = await run(
      {
        [`/projects/${PROJECT}/merge_requests/12/discussions/d1/notes`]: {
          id: 9,
          body: "done",
          author: { username: "linus" },
          created_at: "2026-01-06T00:00:00Z",
        },
        [`/projects/${PROJECT}/merge_requests/12/discussions/d1`]: {
          id: "d1",
          notes: [
            {
              id: 5,
              body: "nit",
              position: { new_path: "a.ts", new_line: 3 },
            },
          ],
        },
      },
      (provider) =>
        provider.replyToPullComment({
          pullNumber: 12,
          commentId: "d1-5",
          body: "done",
        }),
      calls
    );

    expect(reply).toMatchObject({
      id: "gl-d1-9",
      filePath: "a.ts",
      side: "additions",
      lineNumber: 3,
      body: "done",
      author: "linus",
      source: "gitlab",
    });
    expect(calls.at(-1)).toMatchObject({
      method: "POST",
      path: `/projects/${PROJECT}/merge_requests/12/discussions/d1/notes`,
      body: { body: "done" },
    });
  });

  it("refuses an id that is not a GitLab comment", async () => {
    await expect(
      run({}, (provider) =>
        provider.replyToPullComment({
          pullNumber: 12,
          commentId: "1234",
          body: "done",
        })
      )
    ).rejects.toThrow(/not a GitLab comment id/);
  });
});

describe("deletePullComment", () => {
  it("deletes the note from its discussion", async () => {
    const calls: Array<Call> = [];
    await run(
      { [`/projects/${PROJECT}/merge_requests/12/discussions/d1/notes/5`]: {} },
      (provider) =>
        provider.deletePullComment({ pullNumber: 12, commentId: "d1-5" }),
      calls
    );

    expect(calls).toEqual([
      {
        method: "DELETE",
        path: `/projects/${PROJECT}/merge_requests/12/discussions/d1/notes/5`,
      },
    ]);
  });
});

describe("mergePull", () => {
  it("squashes when asked to squash", async () => {
    const calls: Array<Call> = [];
    const merged = await run(
      {
        [`/projects/${PROJECT}/merge_requests/12/merge`]: {
          state: "merged",
          squash_commit_sha: "abc123",
        },
      },
      (provider) => provider.mergePull(12, "squash"),
      calls
    );

    expect(merged).toEqual({ sha: "abc123", message: "Merged !12" });
    expect(calls[0]?.body).toEqual({ squash: true });
  });

  it("fails rather than merging some other way when asked to rebase", async () => {
    expect(mergePayload("rebase")).toBeNull();
    await expect(
      run({}, (provider) => provider.mergePull(12, "rebase"))
    ).rejects.toThrow(/no rebase merge/);
  });

  it("fails when GitLab did not actually merge it", async () => {
    await expect(
      run(
        {
          [`/projects/${PROJECT}/merge_requests/12/merge`]: {
            state: "opened",
          },
        },
        (provider) => provider.mergePull(12, "merge")
      )
    ).rejects.toThrow(/left !12 opened/);
  });
});

describe("closePull", () => {
  it("closes the merge request", async () => {
    const calls: Array<Call> = [];
    const closed = await run(
      { [`/projects/${PROJECT}/merge_requests/12`]: { state: "closed" } },
      (provider) => provider.closePull(12),
      calls
    );

    expect(closed).toEqual({ message: "Closed !12" });
    expect(calls[0]).toMatchObject({
      method: "PUT",
      body: { state_event: "close" },
    });
  });

  it("fails when GitLab left it open", async () => {
    await expect(
      run(
        { [`/projects/${PROJECT}/merge_requests/12`]: { state: "opened" } },
        (provider) => provider.closePull(12)
      )
    ).rejects.toThrow(/left !12 opened/);
  });
});
