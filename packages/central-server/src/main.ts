/**
 * byconvo central-server entry point.
 *
 * Where the embedded server is one developer's machine talking to one git
 * checkout, this one is shared: several people, several clients, one Postgres.
 * That is the whole reason it exists separately — the workspace (projects,
 * tasks, docs, labels and their comments) outlives any single checkout, so it
 * cannot live in a repo-local JSON file.
 *
 * Two things are mounted on the same port:
 *   /api/auth/*  better-auth, verbatim — it owns sign-in, verification,
 *                organizations and invitations, and the SPA talks to it with
 *                better-auth's own typed client.
 *   /api/*       the workspace API, described as an Effect HttpApi so the SPA
 *                gets a generated, typed client for it.
 *
 * Every workspace route resolves a viewer first and fails with 401 without one,
 * so there is no unauthenticated path into the domain.
 */
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from "effect/unstable/http"
import { HttpApiBuilder, HttpApiScalar } from "effect/unstable/httpapi"
import { createServer } from "node:http"
import { Api } from "./api.ts"
import { appUrl, auth } from "./auth/auth.ts"
import { layer as databaseLayer } from "./db/client.ts"
import { runMigrations } from "./db/migrate.ts"
import { DocsHandler } from "./layers/docs/docs.handler.ts"
import { LabelsHandler } from "./layers/labels/labels.handler.ts"
import { ProjectsHandler } from "./layers/projects/projects.handler.ts"
import { TasksHandler } from "./layers/tasks/tasks.handler.ts"
import { WorkspaceCommentsHandler } from "./layers/workspace-comments/workspace-comments.handler.ts"

const port = Number(process.env["BYCONVO_CENTRAL_PORT"] ?? 41821)

const ApiLive = Layer.mergeAll(
  HttpApiBuilder.layer(Api, { openapiPath: "/api/openapi.json" }),
  HttpApiScalar.layer(Api, { path: "/api/reference" })
).pipe(
  Layer.provide(ProjectsHandler),
  Layer.provide(TasksHandler),
  Layer.provide(DocsHandler),
  Layer.provide(LabelsHandler),
  Layer.provide(WorkspaceCommentsHandler)
)

/**
 * better-auth speaks the web `Request`/`Response` pair, so the route just
 * converts in and out. Handing it the whole subtree keeps the library's own
 * routing intact — including the endpoints its client adds through plugins.
 */
const AuthRoutes = HttpRouter.add("*", "/api/auth/*", (request) =>
  HttpServerRequest.toWeb(request).pipe(
    Effect.flatMap((web) => Effect.promise(() => auth.handler(web))),
    Effect.map(HttpServerResponse.fromWeb),
    Effect.orDie
  )
)

/**
 * The session lives in a cookie, so the SPA's fetches are credentialed and the
 * allowed origins have to be named — a wildcard is not permitted alongside
 * credentials, and would be wrong here anyway.
 */
const Cors = HttpRouter.cors({
  allowedOrigins: [appUrl(), "http://localhost:41812", "byconvo://app"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
})

const HttpLive = HttpRouter.serve(
  Layer.mergeAll(ApiLive, AuthRoutes, Cors)
).pipe(
  Layer.provide(databaseLayer),
  Layer.provide(NodeHttpServer.layer(createServer, { port }))
)

/**
 * Migrate before serving. The schema is small and the migrations are additive,
 * so a developer bringing the stack up should never have to remember a second
 * command — and a server that starts against an old schema fails later, and
 * less legibly, than one that refuses to start at all.
 */
const main = Effect.flatMap(
  Effect.tryPromise({
    try: runMigrations,
    catch: (error) =>
      new Error(
        `could not migrate the database — is Postgres running? (pnpm --filter @byconvo/central-server db:up)\n${
          error instanceof Error ? error.message : String(error)
        }`
      ),
  }),
  () => Layer.launch(HttpLive)
)

NodeRuntime.runMain(main)
