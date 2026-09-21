/**
 * Who a locally written note is by. A comment, a visual comment and a plan
 * annotation are all filed without an author — nothing logs in here — so the
 * name comes from the repository's own git identity, which is the same name the
 * commits beside the comment carry.
 *
 * Falls back to "you" for a git that has no `user.name` set, no repository
 * selected, or no git at all: an unsigned note still has to say something, and
 * the second person is what the UI read as before any of this resolved.
 */
import * as Effect from "effect/Effect";
import { GitExec } from "./git-exec.ts";

export const ANONYMOUS_AUTHOR = "you";

/** The git identity, else `ANONYMOUS_AUTHOR`. */
export const gitUserName: Effect.Effect<string, never, GitExec> = Effect.gen(
  function* () {
    const git = yield* GitExec;
    return yield* git.runTolerant("config", "user.name");
  }
).pipe(
  Effect.catch(() => Effect.succeed("")),
  Effect.map((name) =>
    name.trim().length > 0 ? name.trim() : ANONYMOUS_AUTHOR
  )
);

/**
 * The name to file a note under: the one the request carried, else the git
 * identity, else `ANONYMOUS_AUTHOR`.
 */
export const authorOf = (
  requested: string | undefined
): Effect.Effect<string, never, GitExec> =>
  requested !== undefined && requested.length > 0
    ? Effect.succeed(requested)
    : gitUserName;
