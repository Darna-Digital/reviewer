import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { describe, expect, it } from "vitest";
import {
  GitExec,
  GitError,
  type GitExecShape,
} from "@reviewer/core/ports/git-exec";
import { ANONYMOUS_AUTHOR, authorOf } from "./git-identity.ts";

const fakeGit = (
  answer: Effect.Effect<string, GitError>
): { git: GitExecShape; calls: Array<ReadonlyArray<string>> } => {
  const calls: Array<ReadonlyArray<string>> = [];
  const unused = () => Effect.succeed("");
  return {
    calls,
    git: {
      run: unused,
      runVerbose: unused,
      runTolerant: (...args) => {
        calls.push(args);
        return answer;
      },
      lines: () => Effect.succeed([]),
    },
  };
};

const resolve = (
  requested: string | undefined,
  answer: Effect.Effect<string, GitError>
) => {
  const { git, calls } = fakeGit(answer);
  return Effect.runPromise(
    authorOf(requested).pipe(
      Effect.provide(Layer.succeed(GitExec)(GitExec.of(git)))
    )
  ).then((author) => ({ author, calls }));
};

const failure = Effect.fail(
  new GitError({
    args: ["config", "user.name"],
    exitCode: 1,
    stderr: "no repo",
  })
);

describe("authorOf", () => {
  it("keeps the name the request carried", async () => {
    const { author, calls } = await resolve("octocat", Effect.succeed("Ada\n"));

    expect(author).toBe("octocat");
    expect(calls).toEqual([]);
  });

  it("falls back to the repository's git identity", async () => {
    const { author, calls } = await resolve(undefined, Effect.succeed("Ada\n"));

    expect(author).toBe("Ada");
    expect(calls).toEqual([["config", "user.name"]]);
  });

  it("answers anonymously when git has no name set", async () => {
    const { author } = await resolve(undefined, Effect.succeed("\n"));

    expect(author).toBe(ANONYMOUS_AUTHOR);
  });

  it("answers anonymously when git cannot be asked", async () => {
    const { author } = await resolve("", failure);

    expect(author).toBe(ANONYMOUS_AUTHOR);
  });
});
