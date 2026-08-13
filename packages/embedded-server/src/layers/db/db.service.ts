/**
 * The database as the feature repositories see it.
 *
 * `Database` is infra in the same sense `WorkspaceContext` is: built once as a
 * global singleton and provided to every request, so the connection outlives
 * the (stateless) services built on top of it. It hands back the same handle
 * `database()` returns — there is one database per process, whichever side
 * reaches it.
 *
 * `attempt` / `inRepo` are the shape every repository needs at the boundary:
 * synchronous SQLite work, with a thrown `NotFound` kept as a real 404 and
 * anything else reported as a storage failure. They replace the `withFile`
 * helper each file-backed repository used to redeclare.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { DatabaseSync } from "node:sqlite";
import { NotFound, StorageError } from "@byconvo/core/shared";
import type { NoRepoSelected } from "@byconvo/core/shared";
import type { WorkspaceContextShape } from "../workspace/workspace-context.ts";
import { closeDatabase, database, openDatabase } from "./database.ts";

export interface DatabaseShape {
  readonly db: DatabaseSync;
}

export class Database extends Context.Service<Database, DatabaseShape>()(
  "Database"
) {}

/** Open the configured file (`BYCONVO_DB`, else `~/.byconvo/byconvo.db`). */
export const layer: Layer.Layer<Database> = Layer.effect(Database)(
  Effect.acquireRelease(
    Effect.sync(() => Database.of({ db: openDatabase() })),
    () => Effect.sync(closeDatabase)
  )
);

/**
 * Run synchronous storage work. A thrown `NotFound` is a real 404 and is
 * preserved; every other throw becomes a `StorageError`.
 */
export const attempt = <A>(
  f: () => A
): Effect.Effect<A, NotFound | StorageError> =>
  Effect.try({
    try: f,
    catch: (error) =>
      error instanceof NotFound
        ? error
        : new StorageError({
            reason: error instanceof Error ? error.message : String(error),
          }),
  });

/** The same, for work scoped to the selected repository. */
export const inRepo =
  (ctx: WorkspaceContextShape) =>
  <A>(
    f: (repoPath: string, db: DatabaseSync) => A
  ): Effect.Effect<A, NoRepoSelected | NotFound | StorageError> =>
    Effect.flatMap(ctx.requireCurrent, (repoPath) =>
      attempt(() => f(repoPath, database()))
    );
