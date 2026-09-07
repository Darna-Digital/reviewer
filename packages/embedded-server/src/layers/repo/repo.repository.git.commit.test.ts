import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FileSystem from "effect/FileSystem";
import { describe, expect, it } from "vitest";
import {
  GitExec,
  GitError,
  type GitExecShape,
} from "@reviewer/core/ports/git-exec";
import { makeGitRepoRepository } from "./repo.repository.git.ts";

const STAGED_DELETION = "packages/visual-picker/src/index.ts";
const UNTRACKED = "packages/spa/src/new-file.ts";
const LOCKED = "fatal: Unable to create '/repo/.git/index.lock': File exists.";

interface FakeGitOptions {
  readonly indexLocked?: boolean;
}

/**
 * Models the behaviour that caused the bug: a path already staged as a deletion
 * is in neither the worktree nor the index, so `git add` rejects its pathspec —
 * and a single rejected pathspec aborts the batch without staging anything.
 */
const fakeGit = (
  options?: FakeGitOptions
): { git: GitExecShape; commands: Array<string> } => {
  const commands: Array<string> = [];
  const run = (...args: ReadonlyArray<string>) => {
    commands.push(args.join(" "));
    if (args[0] === "add" && options?.indexLocked === true) {
      return Effect.fail(new GitError({ args, exitCode: 128, stderr: LOCKED }));
    }
    if (args[0] === "add" && args.includes(STAGED_DELETION)) {
      return Effect.fail(
        new GitError({
          args,
          exitCode: 128,
          stderr: `fatal: pathspec '${STAGED_DELETION}' did not match any files`,
        })
      );
    }
    return Effect.succeed(args[0] === "rev-parse" ? "abc1234\n" : "");
  };
  return {
    commands,
    git: {
      run,
      runVerbose: run,
      runTolerant: run,
      lines: () => Effect.succeed([]),
    },
  };
};

const runCommit = (paths: ReadonlyArray<string>, options?: FakeGitOptions) => {
  const { git, commands } = fakeGit(options);
  return Effect.runPromise(
    Effect.flatMap(makeGitRepoRepository, (repo) =>
      repo.commit("Remove visual picker", paths)
    ).pipe(
      Effect.provide(
        Layer.mergeAll(
          Layer.succeed(GitExec)(GitExec.of(git)),
          FileSystem.layerNoop({})
        )
      ),
      Effect.map((sha) => ({ sha, commands }))
    )
  );
};

describe("commit", () => {
  it("commits a path whose deletion git has already staged", async () => {
    const { sha, commands } = await runCommit([STAGED_DELETION]);

    expect(sha).toBe("abc1234");
    expect(commands).toContain(
      `commit -m Remove visual picker -- ${STAGED_DELETION}`
    );
  });

  it("still stages the other paths when one pathspec is rejected", async () => {
    const { commands } = await runCommit([STAGED_DELETION, UNTRACKED]);

    expect(commands).toContain(`add -A -- ${UNTRACKED}`);
    expect(commands).toContain(
      `commit -m Remove visual picker -- ${STAGED_DELETION} ${UNTRACKED}`
    );
  });

  it("surfaces a staging failure that is not a rejected pathspec", async () => {
    await expect(runCommit([UNTRACKED], { indexLocked: true })).rejects.toThrow(
      /index\.lock/
    );
  });
});
