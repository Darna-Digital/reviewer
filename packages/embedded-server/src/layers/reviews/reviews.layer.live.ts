/**
 * The review provider this server actually runs: GitHub and GitLab both built,
 * and `origin` asked per call which of them answers for the open repository.
 *
 * Both are built even when only one can ever be used, because building either
 * costs nothing — a client is a handful of closures over the HTTP client — and
 * because the alternative is deciding at startup something that changes when
 * the reader opens a different repository.
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { GitProvider } from "@byconvo/core/ports/git-provider";
import { GitExec } from "../git/git-exec.ts";
import { makeGitHubProvider } from "../github/github.repository.git.ts";
import { makeGitLabProvider } from "../gitlab/gitlab.repository.git.ts";
import { originRemote } from "./origin-remote.ts";
import { routeByHost } from "./provider-router.ts";

export const ReviewsLive = Layer.effect(GitProvider)(
  Effect.gen(function* () {
    const git = yield* GitExec;
    const github = yield* makeGitHubProvider;
    const gitlab = yield* makeGitLabProvider;
    return routeByHost(
      Effect.map(originRemote(git), (remote) => remote.host),
      { github, gitlab }
    );
  })
);
