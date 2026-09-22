import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FileSystem from "effect/FileSystem";
import { describe, expect, it } from "vitest";
import { GitExec, type GitExecShape } from "@reviewer/core/ports/git-exec";
import { makeGitRepoRepository } from "./repo.repository.git.ts";

const NEW_DIR_FILES = [
  "packages/new-package/package.json",
  "packages/new-package/src/index.ts",
];

/**
 * Models the behaviour that caused the bug: without `--untracked-files=all`,
 * git reports a wholly-untracked directory as a single `?? dir/` entry instead
 * of one entry per file.
 */
const ROOT = "/repos/reviewer";

const fakeGit = (): GitExecShape => {
  const notUsed = () => Effect.succeed("");
  return {
    run: (...args) =>
      Effect.succeed(args[0] === "rev-parse" ? `${ROOT}\n` : ""),
    runVerbose: notUsed,
    runTolerant: notUsed,
    lines: (...args) => {
      if (args[0] === "ls-files" && args[1] === "--others") {
        return Effect.succeed(
          args.includes("--exclude-standard") ? NEW_DIR_FILES : []
        );
      }
      if (args[0] === "ls-files") return Effect.succeed(["README.md"]);
      if (args[0] === "status") {
        return Effect.succeed(
          args.includes("--untracked-files=all")
            ? NEW_DIR_FILES.map((path) => `?? ${path}`)
            : ["?? packages/new-package/"]
        );
      }
      return Effect.succeed([]);
    },
  };
};

const runFiles = () =>
  Effect.runPromise(
    Effect.flatMap(makeGitRepoRepository, (repo) => repo.files).pipe(
      Effect.provide(
        Layer.mergeAll(
          Layer.succeed(GitExec)(GitExec.of(fakeGit())),
          FileSystem.layerNoop({})
        )
      )
    )
  );

describe("files", () => {
  it("reports every untracked file in a brand-new directory", async () => {
    const { gitStatus } = await runFiles();

    expect(gitStatus.map((entry) => entry.path)).toEqual(NEW_DIR_FILES);
  });

  it("never yields a directory entry, which no file in the tree could match", async () => {
    const { gitStatus } = await runFiles();

    expect(gitStatus.filter((entry) => entry.path.endsWith("/"))).toEqual([]);
  });

  it("names the repository it lists, so a client can tell whose listing it is", async () => {
    const { root } = await runFiles();

    expect(root).toBe(ROOT);
  });
});
