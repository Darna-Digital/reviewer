import { describe, expect, it } from "vitest";
import {
  DISCUSSIONS_QUERY,
  MERGE_REQUESTS_QUERY,
  checksFromPipeline,
  commentId,
  commentsFromDiscussions,
  commentsFromGraphqlDiscussions,
  createdDiscussion,
  gidId,
  labelsFrom,
  mergeRequestFrom,
  mergeRequestFromGraphql,
  mergeRequestsFrom,
  mergeRequestsFromGraphql,
  mergeableFrom,
  notePosition,
  parseCommentId,
  parseMergeRequestDiffs,
  pipelineState,
} from "./merge-request-mapping.ts";

const mergeRequest = {
  iid: 12,
  id: 9001,
  title: "Add the thing",
  description: "It does the thing.",
  author: { username: "ada" },
  source_branch: "feature",
  target_branch: "main",
  sha: "deadbeef",
  web_url: "https://gitlab.com/acme/app/-/merge_requests/12",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  draft: false,
  merge_status: "can_be_merged",
  source_project_id: 5,
  target_project_id: 5,
  changes_count: "7",
  labels: [{ name: "backend", color: "#428BCA" }],
  assignees: [{ username: "ada" }],
  reviewers: [{ username: "linus" }, { username: "grace" }],
  head_pipeline: {
    id: 77,
    status: "running",
    web_url: "https://gitlab.com/acme/app/-/pipelines/77",
  },
};

describe("mergeRequestFrom", () => {
  it("reads a merge request as the review pane's pull request", () => {
    expect(mergeRequestFrom(mergeRequest)).toEqual({
      number: 12,
      title: "Add the thing",
      author: "ada",
      baseRef: "main",
      headRef: "feature",
      headSha: "deadbeef",
      url: "https://gitlab.com/acme/app/-/merge_requests/12",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
      body: "It does the thing.",
      draft: false,
      fromFork: false,
      mergeable: "mergeable",
      checks: [
        {
          name: "Pipeline #77",
          state: "pending",
          url: "https://gitlab.com/acme/app/-/pipelines/77",
        },
      ],
      assignees: ["ada"],
      reviewers: ["linus", "grace"],
      labels: [{ name: "backend", color: "428BCA" }],
      // GitLab knows how many files changed, never how many lines, until the
      // diff itself is fetched.
      additions: 0,
      deletions: 0,
      changedFiles: 7,
    });
  });

  it("reads the older spellings of a draft and of a fork", () => {
    const forked = mergeRequestFrom({
      ...mergeRequest,
      draft: undefined,
      work_in_progress: true,
      source_project_id: 6,
    });
    expect(forked.draft).toBe(true);
    expect(forked.fromFork).toBe(true);
  });

  it("keeps a merge request whose numbers and people are missing", () => {
    const sparse = mergeRequestFrom({ iid: 3, title: "Bare" });
    expect(sparse).toMatchObject({
      number: 3,
      author: "",
      checks: [],
      labels: [],
      mergeable: "unknown",
      changedFiles: 0,
    });
  });

  it("drops anything in the listing that is not a merge request", () => {
    expect(
      mergeRequestsFrom([mergeRequest, { title: "no iid" }, null]).map(
        (mr) => mr.number
      )
    ).toEqual([12]);
    expect(mergeRequestsFrom({ message: "404 Not found" })).toEqual([]);
  });
});

describe("pipelineState", () => {
  it("passes only a passing pipeline", () => {
    expect(pipelineState("success")).toBe("success");
  });

  it("fails a failed one", () => {
    expect(pipelineState("failed")).toBe("failure");
  });

  it("treats a stopped or waiting pipeline as neither", () => {
    expect(pipelineState("canceled")).toBe("neutral");
    expect(pipelineState("skipped")).toBe("neutral");
    expect(pipelineState("manual")).toBe("neutral");
  });

  it("treats anything still going as pending", () => {
    expect(pipelineState("running")).toBe("pending");
    expect(pipelineState("created")).toBe("pending");
    expect(pipelineState(undefined)).toBe("pending");
  });
});

describe("checksFromPipeline", () => {
  it("names a pipeline that has a name of its own", () => {
    expect(
      checksFromPipeline({
        id: 1,
        name: "Merge request pipeline",
        status: "success",
      })
    ).toEqual([{ name: "Merge request pipeline", state: "success", url: "" }]);
  });

  it("shows no check at all when there is no pipeline", () => {
    expect(checksFromPipeline(null)).toEqual([]);
    expect(checksFromPipeline({ id: 4 })).toEqual([]);
  });
});

describe("mergeableFrom", () => {
  it("calls a merge request with known conflicts conflicting", () => {
    expect(mergeableFrom({ has_conflicts: true })).toBe("conflicting");
    expect(mergeableFrom({ merge_status: "cannot_be_merged" })).toBe(
      "conflicting"
    );
  });

  it("leaves an unchecked merge request unknown", () => {
    expect(mergeableFrom({ merge_status: "unchecked" })).toBe("unknown");
    expect(mergeableFrom({})).toBe("unknown");
  });
});

describe("labelsFrom", () => {
  it("takes the hash off a colour and keeps bare names", () => {
    expect(labelsFrom([{ name: "bug", color: "#FF0000" }, "chore"])).toEqual([
      { name: "bug", color: "FF0000" },
      { name: "chore", color: "" },
    ]);
  });
});

describe("comment ids", () => {
  it("round-trips the discussion and the note", () => {
    const id = commentId("abc123def", 55);
    expect(id).toBe("gl-abc123def-55");
    expect(parseCommentId("abc123def-55")).toEqual({
      discussionId: "abc123def",
      noteId: 55,
    });
  });

  it("refuses an id that is not a GitLab one", () => {
    expect(parseCommentId("42")).toBeNull();
    expect(parseCommentId("abc-")).toBeNull();
  });
});

describe("notePosition", () => {
  it("puts a note with a new line on the additions side", () => {
    expect(
      notePosition({
        position: { new_path: "src/a.ts", old_path: "src/a.ts", new_line: 9 },
      })
    ).toEqual({ filePath: "src/a.ts", side: "additions", lineNumber: 9 });
  });

  it("puts a note with only an old line on the deletions side", () => {
    expect(
      notePosition({ position: { old_path: "src/a.ts", old_line: 4 } })
    ).toEqual({ filePath: "src/a.ts", side: "deletions", lineNumber: 4 });
  });

  it("has no position for a note on no line at all", () => {
    expect(notePosition({ position: { new_path: "a.png" } })).toBeNull();
    expect(notePosition({ body: "general comment" })).toBeNull();
  });
});

describe("commentsFromDiscussions", () => {
  const discussions = [
    {
      id: "d1",
      notes: [
        {
          id: 1,
          body: "nit",
          author: { username: "ada" },
          created_at: "2026-01-03T00:00:00Z",
          position: { new_path: "src/a.ts", new_line: 9 },
        },
        {
          id: 2,
          body: "fixed",
          author: { username: "linus" },
          created_at: "2026-01-04T00:00:00Z",
        },
      ],
    },
    {
      id: "d2",
      notes: [{ id: 3, body: "changed the title", system: true }],
    },
    { id: "d3", notes: [{ id: 4, body: "looks good" }] },
  ];

  it("hangs every note in a discussion on the line the discussion is about", () => {
    const comments = commentsFromDiscussions(discussions, 12);
    expect(comments).toEqual([
      {
        id: "gl-d1-1",
        filePath: "src/a.ts",
        side: "additions",
        lineNumber: 9,
        body: "nit",
        author: "ada",
        createdAt: "2026-01-03T00:00:00Z",
        target: "pr-12",
        source: "gitlab",
      },
      {
        id: "gl-d1-2",
        filePath: "src/a.ts",
        side: "additions",
        lineNumber: 9,
        body: "fixed",
        author: "linus",
        createdAt: "2026-01-04T00:00:00Z",
        target: "pr-12",
        source: "gitlab",
      },
    ]);
  });

  it("drops GitLab narrating itself, and discussions on no line", () => {
    const ids = commentsFromDiscussions(discussions, 12).map((c) => c.id);
    expect(ids).not.toContain("gl-d2-3");
    expect(ids).not.toContain("gl-d3-4");
  });
});

describe("createdDiscussion", () => {
  it("finds the note in the discussion a POST answers with", () => {
    expect(
      createdDiscussion({ id: "d9", notes: [{ id: 7, body: "hi" }] })
    ).toEqual({ discussionId: "d9", note: { id: 7, body: "hi" } });
  });

  it("answers null when GitLab described no discussion", () => {
    expect(createdDiscussion({ id: "d9", notes: [] })).toBeNull();
    expect(createdDiscussion("nope")).toBeNull();
  });
});

describe("parseMergeRequestDiffs", () => {
  const diffs = [
    {
      old_path: "src/a.ts",
      new_path: "src/a.ts",
      diff: "@@ -1 +1 @@\n-old\n+new\n",
    },
    {
      old_path: "src/new.ts",
      new_path: "src/new.ts",
      new_file: true,
      diff: "@@ -0,0 +1 @@\n+a",
    },
    {
      old_path: "src/gone.ts",
      new_path: "src/gone.ts",
      deleted_file: true,
      diff: "@@ -1 +0,0 @@\n-a",
    },
    { old_path: "src/was.ts", new_path: "src/is.ts", renamed_file: true },
    { old_path: "logo.png", new_path: "logo.png", diff: "" },
  ];

  it("reads each file's status and trims GitLab's trailing newline", () => {
    expect(parseMergeRequestDiffs(diffs)).toEqual([
      {
        previousPath: "src/a.ts",
        path: "src/a.ts",
        status: "modified",
        patch: "@@ -1 +1 @@\n-old\n+new",
      },
      {
        previousPath: "src/new.ts",
        path: "src/new.ts",
        status: "added",
        patch: "@@ -0,0 +1 @@\n+a",
      },
      {
        previousPath: "src/gone.ts",
        path: "src/gone.ts",
        status: "removed",
        patch: "@@ -1 +0,0 @@\n-a",
      },
      { previousPath: "src/was.ts", path: "src/is.ts", status: "renamed" },
      // A binary file has no patch — "" is not a patch of no lines.
      { previousPath: "logo.png", path: "logo.png", status: "modified" },
    ]);
  });

  it("reads the older /changes shape as well as /diffs", () => {
    expect(parseMergeRequestDiffs({ changes: [diffs[0]] })).toHaveLength(1);
    expect(parseMergeRequestDiffs({ message: "404" })).toEqual([]);
  });
});

describe("mergeRequestFromGraphql", () => {
  const node = {
    iid: "12",
    title: "Add the thing",
    description: "It does the thing.",
    webUrl: "https://gitlab.com/acme/app/-/merge_requests/12",
    draft: false,
    conflicts: false,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    sourceBranch: "feature",
    targetBranch: "main",
    diffHeadSha: "deadbeef",
    mergeStatusEnum: "CAN_BE_MERGED",
    sourceProjectId: 5,
    targetProjectId: 5,
    author: { username: "ada" },
    assignees: { nodes: [{ username: "ada" }] },
    reviewers: { nodes: [{ username: "linus" }] },
    labels: { nodes: [{ title: "backend", color: "#428BCA" }] },
    diffStatsSummary: { additions: 165, deletions: 1, fileCount: 4 },
    headPipeline: { status: "FAILED", path: "/acme/app/-/pipelines/77" },
  };

  it("reads the answers REST cannot give: line counts and the pipeline", () => {
    expect(mergeRequestFromGraphql(node, "https://gitlab.com")).toEqual({
      number: 12,
      title: "Add the thing",
      author: "ada",
      baseRef: "main",
      headRef: "feature",
      headSha: "deadbeef",
      url: "https://gitlab.com/acme/app/-/merge_requests/12",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
      body: "It does the thing.",
      draft: false,
      fromFork: false,
      mergeable: "mergeable",
      checks: [
        {
          name: "Pipeline",
          state: "failure",
          url: "https://gitlab.com/acme/app/-/pipelines/77",
        },
      ],
      assignees: ["ada"],
      reviewers: ["linus"],
      labels: [{ name: "backend", color: "428BCA" }],
      additions: 165,
      deletions: 1,
      changedFiles: 4,
    });
  });

  it("calls a merge request with conflicts conflicting, whatever its status says", () => {
    expect(
      mergeRequestFromGraphql(
        { ...node, conflicts: true },
        "https://gitlab.com"
      ).mergeable
    ).toBe("conflicting");
  });

  it("reads a fork from the two project ids", () => {
    expect(
      mergeRequestFromGraphql(
        { ...node, sourceProjectId: 6 },
        "https://gitlab.com"
      ).fromFork
    ).toBe(true);
  });

  it("holds a merge request with no pipeline and no stats at the unenriched zero", () => {
    const bare = mergeRequestFromGraphql(
      { iid: "3", title: "Bare" },
      "https://gitlab.com"
    );
    expect(bare).toMatchObject({
      number: 3,
      checks: [],
      additions: 0,
      changedFiles: 0,
      mergeable: "unknown",
    });
  });

  it("drops anything in the answer that is not a merge request", () => {
    const data = {
      project: { mergeRequests: { nodes: [node, { title: "no iid" }] } },
    };
    expect(
      mergeRequestsFromGraphql(data, "https://gitlab.com").map(
        (mr) => mr.number
      )
    ).toEqual([12]);
    expect(
      mergeRequestsFromGraphql({ project: null }, "https://gitlab.com")
    ).toEqual([]);
  });

  it("asks for the fields it reads", () => {
    for (const field of [
      "diffStatsSummary",
      "headPipeline",
      "mergeStatusEnum",
      "diffHeadSha",
      "sourceProjectId",
    ]) {
      expect(MERGE_REQUESTS_QUERY).toContain(field);
    }
  });
});

describe("commentsFromGraphqlDiscussions", () => {
  const data = {
    project: {
      mergeRequest: {
        discussions: {
          nodes: [
            {
              id: "gid://gitlab/Discussion/013828bb",
              notes: {
                nodes: [
                  {
                    id: "gid://gitlab/Note/3789320686",
                    body: "requested review from @duo",
                    system: true,
                    author: { username: "ada" },
                    createdAt: "2026-01-03T00:00:00Z",
                    position: null,
                  },
                ],
              },
            },
            {
              id: "gid://gitlab/Discussion/c88928b9",
              notes: {
                nodes: [
                  {
                    id: "gid://gitlab/Note/42",
                    body: "nit",
                    system: false,
                    author: { username: "ada" },
                    createdAt: "2026-01-04T00:00:00Z",
                    position: {
                      newLine: 9,
                      oldLine: null,
                      newPath: "src/a.ts",
                      oldPath: "src/a.ts",
                    },
                  },
                  {
                    id: "gid://gitlab/Note/43",
                    body: "fixed",
                    system: false,
                    author: { username: "linus" },
                    createdAt: "2026-01-05T00:00:00Z",
                    position: null,
                  },
                ],
              },
            },
          ],
        },
      },
    },
  };

  it("reads the same ids the REST reading produces, out of GraphQL's gids", () => {
    expect(commentsFromGraphqlDiscussions(data, 12)).toEqual([
      {
        id: "gl-c88928b9-42",
        filePath: "src/a.ts",
        side: "additions",
        lineNumber: 9,
        body: "nit",
        author: "ada",
        createdAt: "2026-01-04T00:00:00Z",
        target: "pr-12",
        source: "gitlab",
      },
      {
        id: "gl-c88928b9-43",
        filePath: "src/a.ts",
        side: "additions",
        lineNumber: 9,
        body: "fixed",
        author: "linus",
        createdAt: "2026-01-05T00:00:00Z",
        target: "pr-12",
        source: "gitlab",
      },
    ]);
  });

  it("drops GitLab narrating itself, and answers nothing for an empty read", () => {
    const ids = commentsFromGraphqlDiscussions(data, 12).map((c) => c.id);
    expect(ids).not.toContain("gl-013828bb-3789320686");
    expect(commentsFromGraphqlDiscussions({ project: null }, 12)).toEqual([]);
  });

  it("takes the id off the end of a global id", () => {
    expect(gidId("gid://gitlab/Note/42")).toBe("42");
    expect(gidId(undefined)).toBe("");
  });

  it("asks for the fields it reads", () => {
    for (const field of ["position", "system", "author", "notes"]) {
      expect(DISCUSSIONS_QUERY).toContain(field);
    }
  });
});
