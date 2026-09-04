import * as Effect from "effect/Effect";
import { describe, expect, it } from "vitest";
import {
  GitProviderError,
  type GitProviderShape,
  type PullRequestInfo,
  unenrichedPull,
} from "@byconvo/core/ports/git-provider";
import type { GitHost } from "@byconvo/core/ports/git-remote";
import { routeByHost } from "./provider-router.ts";

const pull = (title: string): PullRequestInfo => ({
  ...unenrichedPull,
  number: 1,
  title,
  author: "ada",
  baseRef: "main",
  headRef: "feature",
  headSha: "sha",
  url: "",
  updatedAt: "",
});

/** A provider that only records that it, and not the other one, was asked. */
const named = (name: string, log: Array<string>): GitProviderShape => ({
  pulls: Effect.sync(() => [pull(name)]),
  pullDiff: (n) => Effect.sync(() => `${name} diff ${n}`),
  pullComments: () => Effect.sync(() => []),
  createPullComment: () => Effect.die("not asked"),
  replyToPullComment: () => Effect.die("not asked"),
  deletePullComment: (input) =>
    Effect.sync(() => {
      log.push(`${name} delete ${input.commentId}`);
    }),
  mergePull: (n, method) =>
    Effect.succeed({ sha: "", message: `${name} ${method} ${n}` }),
  closePull: () => Effect.succeed({ message: name }),
});

const router = (host: GitHost | GitProviderError, log: Array<string> = []) =>
  routeByHost(
    host instanceof GitProviderError ? Effect.fail(host) : Effect.succeed(host),
    { github: named("github", log), gitlab: named("gitlab", log) }
  );

describe("routeByHost", () => {
  it("sends the work to the forge origin is on", async () => {
    await expect(Effect.runPromise(router("gitlab").pulls)).resolves.toEqual([
      pull("gitlab"),
    ]);
    await expect(Effect.runPromise(router("github").pullDiff(7))).resolves.toBe(
      "github diff 7"
    );
  });

  it("routes every call, not only the listing", async () => {
    const log: Array<string> = [];
    const gitlab = router("gitlab", log);
    await Effect.runPromise(
      gitlab.deletePullComment({ pullNumber: 1, commentId: "d1-5" })
    );
    await expect(
      Effect.runPromise(gitlab.mergePull(3, "squash"))
    ).resolves.toMatchObject({ message: "gitlab squash 3" });
    expect(log).toEqual(["gitlab delete d1-5"]);
  });

  it("asks the forge again on each call rather than once", async () => {
    const hosts: Array<GitHost> = ["github", "gitlab"];
    let asked = 0;
    const provider = routeByHost(
      Effect.sync(() => hosts[asked++] ?? "github"),
      { github: named("github", []), gitlab: named("gitlab", []) }
    );

    await expect(Effect.runPromise(provider.pullDiff(1))).resolves.toBe(
      "github diff 1"
    );
    await expect(Effect.runPromise(provider.pullDiff(1))).resolves.toBe(
      "gitlab diff 1"
    );
  });

  it("fails with the reason origin could not be read", async () => {
    await expect(
      Effect.runPromise(
        router(new GitProviderError({ reason: "no origin remote" })).pulls
      )
    ).rejects.toThrow(/no origin remote/);
  });
});
