/**
 * Which repository a pull-request request is about.
 *
 * Normally the one the window has open. A request may instead name its own
 * with `?repo=` — the root of a git work tree — and is then answered for that
 * repository's `origin`, the way language and comments requests are scoped.
 * That is what lets a terminal UI in its own checkout review that checkout's
 * pull requests through whichever server answers.
 *
 * Only the owner/repo lookup depends on the repository, so the shared client
 * is reused — its token and HTTP plumbing included — with that one lookup
 * swapped for the named root's.
 */
import * as Effect from "effect/Effect";
import {
  GitProvider,
  GitProviderError,
  type GitProviderShape,
} from "@reviewer/core/ports/git-provider";
import { makeAt } from "../git/git-exec.ts";
import { requireRepoRoot } from "../language/language.scope.ts";
import { GitHubClient, remoteOf } from "./github-client.ts";
import { makeGitHubProvider } from "./github.repository.git.ts";

export const withGitHubOf =
  (repo: string | undefined) =>
  <A>(use: (github: GitProviderShape) => Effect.Effect<A, GitProviderError>) =>
    Effect.gen(function* () {
      if (repo === undefined) return yield* Effect.flatMap(GitProvider, use);
      const root = yield* requireRepoRoot(repo).pipe(
        Effect.mapError(
          (error) => new GitProviderError({ reason: error.message })
        )
      );
      const git = yield* makeAt(root);
      const client = yield* GitHubClient;
      const github = yield* makeGitHubProvider.pipe(
        Effect.provideService(GitHubClient, { ...client, repo: remoteOf(git) })
      );
      return yield* use(github);
    });
