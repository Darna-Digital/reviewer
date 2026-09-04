/**
 * One review provider in front of two.
 *
 * Which forge answers is a property of the repository that is open, and the
 * repository that is open changes while the app runs — so the choice cannot be
 * made once when the layer is built. It is made per call instead: every method
 * asks `origin` who hosts it and hands the work to that provider.
 *
 * The routing is a pure function of an Effect and a pair of providers so it can
 * be tested with two in-memory ones and no network at all.
 */
import * as Effect from "effect/Effect";
import type {
  GitProviderError,
  GitProviderShape,
} from "@byconvo/core/ports/git-provider";
import type { GitHost } from "@byconvo/core/ports/git-remote";

export type ProvidersByHost = Readonly<Record<GitHost, GitProviderShape>>;

export const routeByHost = (
  host: Effect.Effect<GitHost, GitProviderError>,
  providers: ProvidersByHost
): GitProviderShape => {
  const on = <A>(
    use: (provider: GitProviderShape) => Effect.Effect<A, GitProviderError>
  ): Effect.Effect<A, GitProviderError> =>
    Effect.flatMap(host, (which) => use(providers[which]));

  return {
    pulls: on((provider) => provider.pulls),
    pullDiff: (pullNumber) => on((p) => p.pullDiff(pullNumber)),
    pullComments: (pullNumber) => on((p) => p.pullComments(pullNumber)),
    createPullComment: (input) => on((p) => p.createPullComment(input)),
    replyToPullComment: (input) => on((p) => p.replyToPullComment(input)),
    deletePullComment: (input) => on((p) => p.deletePullComment(input)),
    mergePull: (pullNumber, method) =>
      on((p) => p.mergePull(pullNumber, method)),
    closePull: (pullNumber) => on((p) => p.closePull(pullNumber)),
  };
};
