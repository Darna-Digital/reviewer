/**
 * byconvo server entry point — a Node HTTP server exposing the HttpApi under
 * /api. Replaces the darna-stack Cloudflare worker: same HttpApi, served with
 * `@effect/platform-node` instead of a Worker runtime. No Postgres, no
 * Cloudflare — the repository is selected at runtime and persisted to
 * ~/.byconvo/state.json (BYCONVO_REPO / cwd seed the initial selection).
 *
 * Composition mirrors darna's worker: feature controllers are provided to the
 * API layer, and the (stateless) feature services are provided per-request with
 * `HttpRouter.provideRequest`. The stateful infra — the selected-repo context,
 * git exec and GitHub client — is built once as a global singleton so the
 * selection persists across requests.
 */
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import * as Layer from "effect/Layer"
import { FetchHttpClient, HttpRouter } from "effect/unstable/http"
import { HttpApiBuilder, HttpApiScalar } from "effect/unstable/httpapi"
import { createServer } from "node:http"
import { Api } from "./api.ts"
import { ChatsController } from "./controller/chats.controller.ts"
import { ChatsLive } from "./layers/chats.layer.live.ts"
import { CommentsController } from "./controller/comments.controller.ts"
import { CommentsLive } from "./layers/comments.layer.live.ts"
import { DocsController } from "./controller/docs.controller.ts"
import { DocsLive } from "./layers/docs.layer.live.ts"
import { GitMessageController } from "./controller/git-message.controller.ts"
import { GitMessageLive } from "./layers/git-message.layer.live.ts"
import { GitHubController } from "./controller/github.controller.ts"
import { GitHubLive } from "./layers/github.layer.live.ts"
import { TasksController } from "./controller/tasks.controller.ts"
import { TasksLive } from "./layers/tasks.layer.live.ts"
import { LocalDevController } from "./controller/local-dev.controller.ts"
import { LocalDevLive } from "./layers/local-dev.layer.live.ts"
import { DevRuntimeLive } from "./runtime/local-dev.runtime.ts"
import { RepoController } from "./controller/repo.controller.ts"
import { RepoLive } from "./layers/repo.layer.live.ts"
import { ThreadsController } from "./controller/threads.controller.ts"
import { ThreadsLive } from "./layers/threads.layer.live.ts"
import { WorkspaceController } from "./controller/workspace.controller.ts"
import { WorkspaceLive } from "./layers/workspace.layer.live.ts"
import { layer as gitExecLayer } from "./layers/git/git-exec.ts"
import { layer as gitHubClientLayer } from "./layers/github/github-client.ts"
import { attachPtyServer } from "./layers/terminal/pty-socket.ts"
import { layer as terminalExecLayer } from "./layers/terminal/terminal-exec.ts"
import {
  layer as workspaceContextLayer,
  type InitialSelection,
} from "./layers/workspace/workspace-context.ts"

const envRepo = process.env["BYCONVO_REPO"]
const initial: InitialSelection =
  envRepo !== undefined && envRepo.length > 0
    ? { path: envRepo, explicit: true }
    : { path: process.cwd(), explicit: false }
const port = Number(process.env["BYCONVO_PORT"] ?? 41811)

/**
 * The API router with every feature controller attached. The OpenAPI document
 * (consumed by the SPA's typesafe `openapi-fetch` client) is served at
 * /api/openapi.json, and a Scalar API reference at /api/reference (the /api/docs
 * path belongs to the Docs feature).
 */
const ApiLive = Layer.mergeAll(
  HttpApiBuilder.layer(Api, { openapiPath: "/api/openapi.json" }),
  HttpApiScalar.layer(Api, { path: "/api/reference" })
).pipe(
  Layer.provide(WorkspaceController),
  Layer.provide(RepoController),
  Layer.provide(CommentsController),
  Layer.provide(GitHubController),
  Layer.provide(GitMessageController),
  Layer.provide(ThreadsController),
  Layer.provide(ChatsController),
  Layer.provide(DocsController),
  Layer.provide(TasksController),
  Layer.provide(LocalDevController)
)

/** Stateless feature services, resolved per request. */
const RequestServices = Layer.mergeAll(
  WorkspaceLive,
  RepoLive,
  CommentsLive,
  GitHubLive,
  GitMessageLive,
  ThreadsLive,
  ChatsLive,
  DocsLive,
  TasksLive,
  LocalDevLive,
  DevRuntimeLive
)

/**
 * Global singletons, built once so the selected-repo state persists across
 * requests: the workspace context (mutable selection), the git executor and the
 * GitHub client.
 */
const InfraLive = gitHubClientLayer.pipe(
  Layer.provideMerge(Layer.mergeAll(gitExecLayer, terminalExecLayer)),
  Layer.provideMerge(workspaceContextLayer(initial)),
  Layer.provide(FetchHttpClient.layer)
)

/**
 * The packaged desktop app loads the SPA from the `byconvo://app` protocol and
 * calls the API at `http://localhost:<port>`, so every request is cross-origin.
 * Allow all origins — this server is local-only and never credentialed.
 */
// Wrap node's createServer so every server instance also hosts the live-terminal
// PTY WebSocket (attached to its `upgrade` event) alongside the Effect HttpApi.
const createServerWithPty: typeof createServer = ((
  ...args: Parameters<typeof createServer>
) => {
  const server = createServer(...args)
  attachPtyServer(server)
  return server
}) as typeof createServer

const HttpLive = HttpRouter.serve(
  Layer.mergeAll(
    ApiLive.pipe(HttpRouter.provideRequest(RequestServices)),
    HttpRouter.cors()
  )
).pipe(
  Layer.provide(InfraLive),
  Layer.provide(NodeHttpServer.layer(createServerWithPty, { port }))
)

NodeRuntime.runMain(Layer.launch(HttpLive))
