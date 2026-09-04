import * as Effect from "effect/Effect";
import { describe, expect, it } from "vitest";
import { GitError, type GitExecShape } from "@byconvo/core/ports/git-exec";
import { gitHostHints } from "./git-host-hints.ts";
import { originRemote } from "./origin-remote.ts";

const gitWith = (origin: string | GitError): GitExecShape => {
  const answer = () =>
    origin instanceof GitError
      ? Effect.fail(origin)
      : Effect.succeed(`${origin}\n`);
  return {
    run: answer,
    runVerbose: answer,
    runTolerant: answer,
    lines: () => Effect.succeed([]),
  };
};

describe("originRemote", () => {
  it("recognises a GitLab checkout from its remote alone", async () => {
    await expect(
      Effect.runPromise(
        originRemote(gitWith("git@gitlab.com:acme/team/app.git"))
      )
    ).resolves.toMatchObject({
      host: "gitlab",
      owner: "acme/team",
      repo: "app",
      webUrl: "https://gitlab.com",
    });
  });

  it("recognises a GitHub checkout the same way", async () => {
    await expect(
      Effect.runPromise(
        originRemote(gitWith("https://github.com/Darna-Digital/byconvo.git"))
      )
    ).resolves.toMatchObject({ host: "github", path: "Darna-Digital/byconvo" });
  });

  it("says what to set when the remote is on neither forge", async () => {
    await expect(
      Effect.runPromise(originRemote(gitWith("git@bitbucket.org:team/app.git")))
    ).rejects.toThrow(/BYCONVO_GITLAB_HOSTS/);
  });

  it("carries git's own words when there is no origin at all", async () => {
    await expect(
      Effect.runPromise(
        originRemote(
          gitWith(
            new GitError({
              args: ["remote", "get-url", "origin"],
              exitCode: 2,
              stderr: "error: No such remote 'origin'",
            })
          )
        )
      )
    ).rejects.toThrow(/No such remote/);
  });
});

describe("gitHostHints", () => {
  it("reads the self-hosted forges from the environment", () => {
    expect(
      gitHostHints({
        BYCONVO_GITLAB_HOSTS: "git.acme.internal, code.acme.dev",
        BYCONVO_GITHUB_HOSTS: "",
      })
    ).toEqual({
      gitlabHosts: ["git.acme.internal", "code.acme.dev"],
      githubHosts: [],
    });
  });

  it("is empty when nothing is set", () => {
    expect(gitHostHints({})).toEqual({ gitlabHosts: [], githubHosts: [] });
  });
});
