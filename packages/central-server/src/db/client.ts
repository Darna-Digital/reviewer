/**
 * The Postgres connection, as an Effect service.
 *
 * Drizzle has no Effect v4 binding of its own (`@effect/sql-drizzle` is still
 * pinned to Effect 3), so rather than hold the whole workspace back a beta line
 * we keep drizzle's own `node-postgres` driver and wrap it here. Every query
 * the repositories run goes through {@link runQuery}, which is the single place
 * a driver rejection becomes a typed `StorageError` — no repository ever sees a
 * raw promise, and no `pg` error escapes into the domain.
 */
import { StorageError } from "@byconvo/core/shared"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Pool } from "pg"
import * as schema from "./schema.ts"

export type DrizzleDatabase = NodePgDatabase<typeof schema>

export class Database extends Context.Service<Database, DrizzleDatabase>()(
  "Database"
) {}

export const DEFAULT_DATABASE_URL =
  "postgres://byconvo:byconvo@localhost:5432/byconvo"

export const databaseUrl = (): string =>
  process.env["BYCONVO_DATABASE_URL"] ?? DEFAULT_DATABASE_URL

/**
 * A pooled connection, closed when the layer's scope ends. Kept small: this
 * server fronts a desktop app, not a fleet, and an idle pool of twenty
 * connections per developer is how a shared Postgres runs out of slots.
 */
export const layer = Layer.effect(Database)(
  Effect.gen(function* () {
    const pool = yield* Effect.acquireRelease(
      Effect.sync(() => new Pool({ connectionString: databaseUrl(), max: 10 })),
      (pool) => Effect.promise(() => pool.end())
    )
    return drizzle(pool, { schema })
  })
)

/**
 * Runs one drizzle query, turning a driver rejection into a `StorageError`.
 * `context` names the operation, so a failure reads as "listing tasks: relation
 * does not exist" rather than just the driver's text.
 */
export interface QueryRunner {
  <A, E = never>(
    context: string,
    query: (db: DrizzleDatabase) => Promise<A>,
    /**
     * Turn a recognised driver error into a domain failure. Returning null
     * (or leaving it out) falls through to `StorageError`.
     */
    mapError?: (error: unknown) => E | null
  ): Effect.Effect<A, StorageError | E>
}

/** Binds {@link QueryRunner} to a connection a repository already resolved. */
export const makeQueryRunner =
  (db: DrizzleDatabase): QueryRunner =>
  (context, query, mapError) =>
    Effect.tryPromise({
      try: () => query(db),
      catch: (error) =>
        mapError?.(error) ??
        new StorageError({
          reason: `${context}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        }),
    })

/** Postgres' unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = "23505"

/**
 * The constraint a write collided with, or null when the error is something
 * else. Lets a repository turn one specific race into a `Conflict` and leave
 * every other driver failure as a `StorageError`.
 */
export const uniqueViolationOf = (error: unknown): string | null => {
  if (typeof error !== "object" || error === null) return null
  const candidate = error as { code?: unknown; constraint?: unknown }
  if (candidate.code !== UNIQUE_VIOLATION) return null
  return typeof candidate.constraint === "string" ? candidate.constraint : ""
}
