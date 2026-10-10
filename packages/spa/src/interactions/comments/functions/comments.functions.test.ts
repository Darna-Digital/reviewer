import { describe, expect, it } from "vitest";
import type { ReviewComment } from "@reviewer/core/comments";
import {
  unenrichedPull,
  type PullRequestInfo,
} from "@reviewer/core/ports/git-provider";
import { createCommentsFunctions } from "./comments.functions";
import { createCommentsDependenciesMock } from "./comments.functions.mock";

const pull: PullRequestInfo = {
  ...unenrichedPull,
  number: 5,
  title: "t",
  author: "a",
  baseRef: "main",
  headRef: "f",
  headSha: "s",
  url: "u",
  updatedAt: "",
};

const draft = {
  filePath: "src/a.ts",
  side: "additions" as const,
  lineNumber: 12,
};

describe("submit", () => {
  it("local comment in commit/browse mode carries the target key", async () => {
    const deps = createCommentsDependenciesMock();
    const fns = createCommentsFunctions(deps);
    const created = await fns.submit(
      { mode: "commit", selectedPull: null, targetKey: "worktree" },
      draft,
      "hi"
    );
    expect(created.source).toBe("local");
    expect(deps.sideEffects.addLocalComment).toHaveBeenCalledWith(
      expect.objectContaining({ target: "worktree", filePath: "src/a.ts" })
    );
  });

  it("PR comment in review mode goes to the selected pull", async () => {
    const deps = createCommentsDependenciesMock();
    const fns = createCommentsFunctions(deps);
    const created = await fns.submit(
      { mode: "review", selectedPull: pull, targetKey: "pr-5" },
      draft,
      "nit"
    );
    expect(created.source).toBe("github");
    expect(deps.sideEffects.addPullComment).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ body: "nit" })
    );
  });
});

describe("remove", () => {
  it("deletes local comments", async () => {
    const deps = createCommentsDependenciesMock();
    const fns = createCommentsFunctions(deps);
    const ok = await fns.remove(null, {
      id: "x",
      source: "local",
    } as ReviewComment);
    expect(ok).toBe(true);
    expect(deps.sideEffects.deleteComment).toHaveBeenCalledWith("x");
  });

  it("deletes a GitHub comment from the pull request being reviewed", async () => {
    const deps = createCommentsDependenciesMock();
    const fns = createCommentsFunctions(deps);
    const ok = await fns.remove(pull, {
      id: "gh-42",
      source: "github",
    } as ReviewComment);
    expect(ok).toBe(true);
    expect(deps.sideEffects.deletePullComment).toHaveBeenCalledWith(5, 42);
  });

  it("leaves a GitHub comment alone with no pull request in hand", async () => {
    const deps = createCommentsDependenciesMock();
    const fns = createCommentsFunctions(deps);
    expect(
      await fns.remove(null, { id: "gh-1", source: "github" } as ReviewComment)
    ).toBe(false);
    expect(deps.sideEffects.deleteComment).not.toHaveBeenCalled();
    expect(deps.sideEffects.deletePullComment).not.toHaveBeenCalled();
  });

  it("leaves a GitHub comment alone when its id is not GitHub's", async () => {
    const deps = createCommentsDependenciesMock();
    const fns = createCommentsFunctions(deps);
    expect(
      await fns.remove(pull, {
        id: "optimistic-1",
        source: "github",
      } as ReviewComment)
    ).toBe(false);
    expect(deps.sideEffects.deletePullComment).not.toHaveBeenCalled();
  });
});

describe("update", () => {
  it("updates local comments", async () => {
    const deps = createCommentsDependenciesMock();
    const fns = createCommentsFunctions(deps);
    const updated = await fns.update(
      null,
      { id: "c-1", source: "local" } as ReviewComment,
      "revised"
    );
    expect(updated).not.toBeNull();
    expect(updated!.body).toBe("revised");
    expect(deps.sideEffects.updateLocalComment).toHaveBeenCalledWith(
      "c-1",
      "revised"
    );
  });

  it("updates a GitHub comment on the pull request being reviewed", async () => {
    const deps = createCommentsDependenciesMock();
    const fns = createCommentsFunctions(deps);
    const original = {
      id: "gh-42",
      source: "github",
      filePath: "src/a.ts",
      lineNumber: 12,
      thread: "T_1",
      resolved: false,
      body: "before",
    } as ReviewComment;
    const updated = await fns.update(pull, original, "after");
    expect(deps.sideEffects.updatePullComment).toHaveBeenCalledWith(
      5,
      42,
      "after"
    );
    expect(updated).toEqual({ ...original, body: "after" });
  });

  it("leaves a GitHub comment alone with no pull request in hand", async () => {
    const deps = createCommentsDependenciesMock();
    const fns = createCommentsFunctions(deps);
    expect(
      await fns.update(
        null,
        { id: "gh-1", source: "github" } as ReviewComment,
        "nope"
      )
    ).toBeNull();
    expect(deps.sideEffects.updateLocalComment).not.toHaveBeenCalled();
    expect(deps.sideEffects.updatePullComment).not.toHaveBeenCalled();
  });
});

describe("reply", () => {
  it("anchors the reply to the parent comment's line", async () => {
    const deps = createCommentsDependenciesMock();
    const fns = createCommentsFunctions(deps);
    const parent: ReviewComment = {
      id: "gh-42",
      filePath: "src/x.ts",
      side: "deletions",
      lineNumber: 7,
      body: "parent",
      author: "o",
      createdAt: "",
      target: "pr-5",
      source: "github",
    };
    const reply = await fns.reply(pull, parent, "agreed");
    expect(reply).not.toBeNull();
    expect(reply!.filePath).toBe("src/x.ts");
    expect(reply!.side).toBe("deletions");
    expect(reply!.lineNumber).toBe(7);
    expect(deps.sideEffects.replyPullComment).toHaveBeenCalledWith(
      5,
      42,
      "agreed"
    );
  });

  it("returns null for non-GitHub comments", async () => {
    const fns = createCommentsFunctions(createCommentsDependenciesMock());
    expect(
      await fns.reply(
        pull,
        { id: "local", source: "local" } as ReviewComment,
        "x"
      )
    ).toBeNull();
  });
});

describe("setResolved", () => {
  const threaded: ReviewComment = {
    id: "gh-42",
    filePath: "src/x.ts",
    side: "additions",
    lineNumber: 7,
    body: "nit",
    author: "o",
    createdAt: "",
    target: "pr-5",
    source: "github",
    thread: "PRRT_1",
    resolved: false,
  };

  it("resolves the thread the comment is in, on the pull request in hand", async () => {
    const deps = createCommentsDependenciesMock();
    const fns = createCommentsFunctions(deps);
    expect(await fns.setResolved(pull, threaded, true)).toBe(true);
    expect(deps.sideEffects.setPullThreadResolved).toHaveBeenCalledWith(
      5,
      "PRRT_1",
      true
    );
  });

  it("has nothing to resolve without a thread or a pull request", async () => {
    const deps = createCommentsDependenciesMock();
    const fns = createCommentsFunctions(deps);
    const { thread: _thread, ...unthreaded } = threaded;
    expect(await fns.setResolved(pull, unthreaded, true)).toBe(false);
    expect(await fns.setResolved(null, threaded, true)).toBe(false);
    expect(
      await fns.setResolved(pull, { ...threaded, source: "local" }, true)
    ).toBe(false);
    expect(deps.sideEffects.setPullThreadResolved).not.toHaveBeenCalled();
  });
});
