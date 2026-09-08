import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FileSystem from "effect/FileSystem";
import { describe, expect, it } from "vitest";
import { GitExec, type GitExecShape } from "@reviewer/core/ports/git-exec";
import type { RepoRepo } from "@reviewer/core/repo";
import { makeGitRepoRepository } from "./repo.repository.git.ts";

const MERGE_BASE = "abc1234";
const ROOT = "/repo";

/**
 * Records every `git` invocation and answers the two the comparison needs: the
 * merge base, and the diff taken from it.
 */
const recordingGit = (calls: Array<ReadonlyArray<string>>): GitExecShape => {
  const run = (...args: ReadonlyArray<string>) => {
    calls.push(args);
    if (args[0] === "merge-base") return Effect.succeed(`${MERGE_BASE}\n`);
    if (args[0] === "rev-parse") return Effect.succeed(`${ROOT}\n`);
    if (args[0] === "diff") return Effect.succeed("diff --git a/a.ts b/a.ts\n");
    if (args[0] === "show") return Effect.succeed("old contents");
    return Effect.succeed("");
  };
  return {
    run,
    runVerbose: run,
    runTolerant: run,
    lines: () => Effect.succeed([]),
  };
};

const withGit = <A>(
  use: (repo: RepoRepo) => Effect.Effect<A, unknown>
): Promise<{
  readonly value: A;
  readonly calls: Array<ReadonlyArray<string>>;
}> => {
  const calls: Array<ReadonlyArray<string>> = [];
  return Effect.runPromise(
    Effect.flatMap(makeGitRepoRepository, (repo) => {
      // The repository builds a few effects as it is made — `git diff HEAD`
      // among them — and building one runs the recorder. Only what the call
      // under test issues is of interest.
      calls.length = 0;
      return use(repo);
    }).pipe(
      Effect.map((value) => ({ value, calls })),
      Effect.provide(
        Layer.mergeAll(
          Layer.succeed(GitExec)(GitExec.of(recordingGit(calls))),
          FileSystem.layerNoop({
            readFileString: () => Effect.succeed("new contents"),
          })
        )
      )
    ) as Effect.Effect<{
      readonly value: A;
      readonly calls: Array<ReadonlyArray<string>>;
    }>
  );
};

/**
 * The contract the compare picker rests on: choosing a branch to read against
 * has to answer "what has this branch done that the other one hasn't" —
 * everything since the two parted, uncommitted work included.
 */
describe("targetDiff", () => {
  it("diffs the working tree against the merge base, not against the branch tip", async () => {
    const { calls } = await withGit((repo) => repo.targetDiff("main"));

    expect(calls).toEqual([
      ["merge-base", "main", "HEAD"],
      // No second ref: the right-hand side is the working tree, so work that
      // is written but not yet committed is part of the answer.
      ["diff", MERGE_BASE],
    ]);
  });

  it("reads a remote-tracking ref the same way", async () => {
    const { calls } = await withGit((repo) => repo.targetDiff("origin/main"));

    expect(calls[0]).toEqual(["merge-base", "origin/main", "HEAD"]);
  });
});

describe("diffFileContents for a branch comparison", () => {
  it("expands context from the merge base and the file on disk", async () => {
    const { value, calls } = await withGit((repo) =>
      repo.diffFileContents(
        { kind: "branch", target: "main" },
        "src/a.ts",
        null
      )
    );

    expect(calls[0]).toEqual(["merge-base", "main", "HEAD"]);
    expect(calls[1]).toEqual(["show", `${MERGE_BASE}:src/a.ts`]);
    expect(value).toEqual({
      oldContents: "old contents",
      newContents: "new contents",
    });
  });

  it("follows a rename back to the name the old side knows it by", async () => {
    const { calls } = await withGit((repo) =>
      repo.diffFileContents(
        { kind: "branch", target: "main" },
        "src/b.ts",
        "src/a.ts"
      )
    );

    expect(calls[1]).toEqual(["show", `${MERGE_BASE}:src/a.ts`]);
  });
});
