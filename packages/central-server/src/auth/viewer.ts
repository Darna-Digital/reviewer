/**
 * Resolves who a request is acting as.
 *
 * This has to happen per request, which rules out providing it as a layer:
 * `HttpRouter.provideRequest` builds its layer once for the whole server, so a
 * `Viewer` installed that way would be whoever signed in first. Instead the
 * handlers build their service from {@link resolveViewer} on each call — one
 * session lookup and one membership query, both indexed.
 */
import { Viewer, type ViewerShape } from "@byconvo/core/identity"
import { Unauthorized } from "@byconvo/core/shared"
import { and, eq } from "drizzle-orm"
import * as Effect from "effect/Effect"
import { HttpServerRequest } from "effect/unstable/http"
import { auth } from "./auth.ts"
import { Database, type DrizzleDatabase } from "../db/client.ts"
import * as schema from "../db/schema.ts"

const unauthorized = (what: string) => (error: unknown) =>
  new Unauthorized({
    reason: `could not read ${what}: ${
      error instanceof Error ? error.message : String(error)
    }`,
  })

/** A membership row joined to its organization, or undefined. */
const membershipOf = (
  db: DrizzleDatabase,
  userId: string,
  organizationId: string | null
) =>
  Effect.tryPromise({
    try: () =>
      db
        .select({ role: schema.member.role, organization: schema.organization })
        .from(schema.member)
        .innerJoin(
          schema.organization,
          eq(schema.member.organizationId, schema.organization.id)
        )
        .where(
          organizationId === null
            ? eq(schema.member.userId, userId)
            : and(
                eq(schema.member.userId, userId),
                eq(schema.member.organizationId, organizationId)
              )
        )
        .limit(1),
    catch: unauthorized("your membership"),
  }).pipe(Effect.map((rows) => rows[0]))

export const resolveViewer: Effect.Effect<
  ViewerShape,
  Unauthorized,
  Database | HttpServerRequest.HttpServerRequest
> = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  const db = yield* Database

  const session = yield* Effect.tryPromise({
    try: () => auth.api.getSession({ headers: new Headers(request.headers) }),
    catch: unauthorized("the session"),
  })
  if (session === null) {
    return yield* Effect.fail(new Unauthorized({ reason: "not signed in" }))
  }

  /**
   * The session names the organization the user last switched to. That can be
   * absent (a fresh session) or stale (they were removed from it), and both
   * fall back to any membership they still hold rather than locking them out.
   */
  const active = session.session.activeOrganizationId ?? null
  const membership =
    (yield* membershipOf(db, session.user.id, active)) ??
    (active === null
      ? undefined
      : yield* membershipOf(db, session.user.id, null))

  if (membership === undefined) {
    return yield* Effect.fail(
      new Unauthorized({ reason: "you do not belong to any organization" })
    )
  }

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      emailVerified: session.user.emailVerified,
      image: session.user.image ?? null,
    },
    organization: {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      logo: membership.organization.logo,
      createdAt: membership.organization.createdAt.toISOString(),
    },
    role: membership.role,
  }
})

/** Runs `effect` as the request's viewer. */
export const withViewer = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<
  A,
  E | Unauthorized,
  Exclude<R, Viewer> | Database | HttpServerRequest.HttpServerRequest
> =>
  Effect.flatMap(resolveViewer, (viewer) =>
    Effect.provideService(effect, Viewer, viewer)
  )
