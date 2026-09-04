/**
 * Which forge answers for the repository that is open, read from `origin`.
 *
 * One question, asked in three places — the GitHub client, the GitLab client
 * and the router that picks between them — so it is asked here once. It takes
 * the git executor rather than requiring it, so what comes back is an Effect
 * with nothing left to provide: all three callers are built inside a layer
 * that already holds one.
 *
 * It stays an Effect, re-read on every call, because the open repository
 * changes while the app runs: a checkout on GitLab can be selected in a window
 * that opened on a GitHub one, and the answer has to change with it.
 */
import * as Effect from "effect/Effect";
import { GitProviderError } from "@byconvo/core/ports/git-provider";
import type { GitExecShape } from "@byconvo/core/ports/git-exec";
import {
  parseGitRemote,
  type GitRemoteInfo,
} from "@byconvo/core/ports/git-remote";
import { gitHostHints } from "./git-host-hints.ts";

export const NO_REMOTE =
  "this repository has no origin remote on a forge byconvo can review " +
  "(GitHub or GitLab). Set BYCONVO_GITLAB_HOSTS / BYCONVO_GITHUB_HOSTS for a " +
  "self-hosted install.";

/** `origin`, read into the forge, the namespace and the project. */
export const originRemote = (
  git: GitExecShape
): Effect.Effect<GitRemoteInfo, GitProviderError> =>
  Effect.gen(function* () {
    const url = yield* git
      .run("remote", "get-url", "origin")
      .pipe(
        Effect.mapError(
          (error) => new GitProviderError({ reason: error.message })
        )
      );
    const remote = parseGitRemote(url.trim(), gitHostHints());
    return remote === null
      ? yield* Effect.fail(new GitProviderError({ reason: NO_REMOTE }))
      : remote;
  });
