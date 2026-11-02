/**
 * Which of the workspace's repositories a request is about.
 *
 * With several repositories open at once, "the open repository" no longer
 * answers what a git status or a file read runs against — the request has to
 * say. Clients name the root in the `X-Reviewer-Repo` header (its absolute
 * path, URI-encoded so a path outside ASCII survives as a header value), and
 * this middleware puts it in the fiber's context for the request's lifetime.
 *
 * It is read in exactly one place: `WorkspaceContext.current` and
 * `requireCurrent`, which every repository-scoped service already resolves
 * its root through — the git executor, the terminal, the database scope, the
 * GitHub remote. So naming the root here re-points all of them for this
 * request at once, and a fiber forked from it (a commit-message draft that
 * outlives the request) keeps the root it was started for.
 *
 * Sockets carry the root as a `?repo=` query instead (a browser cannot set
 * headers on a WebSocket); they are served outside Effect and read it there.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { HttpMiddleware, HttpServerRequest } from "effect/http";

export const REPO_HEADER = "x-reviewer-repo";

/** The root the request named, or null for one that named none. */
export const RequestedRepo = Context.Reference<string | null>(
  "reviewer/RequestedRepo",
  { defaultValue: () => null }
);

const decoded = (value: string): string | null => {
  try {
    const path = decodeURIComponent(value).trim();
    return path.length > 0 ? path : null;
  } catch {
    return null;
  }
};

export const scopeToRequestedRepo = HttpMiddleware.make((app) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    const header = request.headers[REPO_HEADER];
    const requested = header === undefined ? null : decoded(header);
    return yield* requested === null
      ? app
      : Effect.provideService(app, RequestedRepo, requested);
  })
);
