import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { ChildProcessSpawner } from "effect/unstable/process";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import { Api } from "../../api.ts";
import {
  CommentsService,
  type CommentsServiceShape,
} from "@reviewer/core/comments";
import { InvalidRepo } from "@reviewer/core/workspace";
import { authorOf } from "../git/git-identity.ts";
import {
  pinnedTo,
  resolveRepo,
  WorkspaceContext,
} from "../workspace/workspace-context.ts";
import { makeSqliteCommentsRepository } from "./comments.repository.sqlite.ts";

const ok = { ok: true } as const;

const repositoryRoot = (path: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const root = yield* resolveRepo(fs, spawner, path);
    if (root === null) {
      return yield* Effect.fail(
        new InvalidRepo({ path, reason: "not a git repository" })
      );
    }
    return root;
  });

/**
 * Comments act on the repository the window has open, unless the request
 * names one (`?repo=`, any path inside it). Then the same store is built
 * against that repository's root instead — the window's open project is left
 * as it is. This is what lets a coding agent resolve its own repository's
 * comments through whichever server answers, whatever that window shows.
 *
 * The store is made directly rather than by providing `CommentsLive` again:
 * layers are memoised per request, so a second provide would hand back the
 * store this request already built on the window's repository.
 */
const withCommentsOf =
  (repo: string | undefined) =>
  <A, E>(use: (comments: CommentsServiceShape) => Effect.Effect<A, E>) =>
    Effect.gen(function* () {
      if (repo === undefined)
        return yield* Effect.flatMap(CommentsService, use);
      const root = yield* repositoryRoot(repo);
      const context = yield* WorkspaceContext;
      const comments = yield* makeSqliteCommentsRepository.pipe(
        Effect.provideService(WorkspaceContext, pinnedTo(context, root))
      );
      return yield* use(comments);
    });

export const CommentsHandler = HttpApiBuilder.group(
  Api,
  "comments",
  (handlers) =>
    handlers
      .handle("list", ({ query }) => withCommentsOf(query.repo)((s) => s.list))
      .handle("add", ({ payload }) =>
        Effect.gen(function* () {
          const comments = yield* CommentsService;
          return yield* comments.add({
            filePath: payload.filePath,
            side: payload.side,
            lineNumber: payload.lineNumber,
            body: payload.body,
            author: yield* authorOf(payload.author),
            target: payload.target ?? "worktree",
          });
        })
      )
      .handle("update", ({ params, payload }) =>
        Effect.flatMap(CommentsService, (s) =>
          s.update(params.id, { body: payload.body })
        )
      )
      .handle("remove", ({ params, query }) =>
        withCommentsOf(query.repo)((s) => s.remove(params.id)).pipe(
          Effect.as(ok)
        )
      )
);
