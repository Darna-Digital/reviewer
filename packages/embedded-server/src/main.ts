/**
 * reviewer server entry point — a Node HTTP server exposing the HttpApi under
 * /api. Replaces the darna-stack Cloudflare worker: same HttpApi, served with
 * `@effect/platform-node` instead of a Worker runtime. No Postgres, no
 * Cloudflare — feature state lives in one local SQLite file
 * (~/.reviewer/reviewer.db), and the repository is selected at runtime and
 * persisted to ~/.reviewer/state.json (REVIEWER_REPO / cwd seed the initial
 * selection).
 *
 * Composition mirrors darna's worker: feature controllers are provided to the
 * API layer, and the (stateless) feature services are provided per-request with
 * `HttpRouter.provideRequest`. The stateful infra — the selected-repo context,
 * git exec and GitHub client — is built once as a global singleton so the
 * selection persists across requests.
 */
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import * as Layer from "effect/Layer";
import { commitDraftsLayer } from "@reviewer/core/git-message";
import { FetchHttpClient, HttpRouter } from "effect/unstable/http";
import { HttpApiBuilder, HttpApiScalar } from "effect/unstable/httpapi";
import { createServer } from "node:http";
import { Api } from "./api.ts";
import { ChatsHandler } from "./layers/chats/chats.handler.ts";
import { ChatsLive } from "./layers/chats/chats.layer.live.ts";
import { CommentsHandler } from "./layers/comments/comments.handler.ts";
import { CommentsLive } from "./layers/comments/comments.layer.live.ts";
import { GitMessageHandler } from "./layers/git-message/git-message.handler.ts";
import { GitMessageLive } from "./layers/git-message/git-message.layer.live.ts";
import { GitHubHandler } from "./layers/github/github.handler.ts";
import { GitHubLive } from "./layers/github/github.layer.live.ts";
import { LanguageHandler } from "./layers/language/language.handler.ts";
import { LanguageLive } from "./layers/language/language.layer.live.ts";
import { LocalDevHandler } from "./layers/local-dev/local-dev.handler.ts";
import { LocalDevLive } from "./layers/local-dev/local-dev.layer.live.ts";
import { DevRuntimeLive } from "./layers/local-dev/local-dev.runtime.ts";
import { BranchTargetsLive } from "./layers/branch-targets/branch-targets.layer.live.ts";
import { RepoHandler } from "./layers/repo/repo.handler.ts";
import { RepoLive } from "./layers/repo/repo.layer.live.ts";
import { ThemesHandler } from "./layers/themes/themes.handler.ts";
import { ThreadsHandler } from "./layers/threads/threads.handler.ts";
import { ThreadsLive } from "./layers/threads/threads.layer.live.ts";
import { layer as repoIndexLayer } from "./layers/workspace/repo-index.ts";
import { WorkspaceHandler } from "./layers/workspace/workspace.handler.ts";
import { WorkspaceLive } from "./layers/workspace/workspace.layer.live.ts";
import { layer as databaseLayer } from "./layers/db/db.service.ts";
import { layer as gitExecLayer } from "./layers/git/git-exec.ts";
import { layer as gitHubClientLayer } from "./layers/github/github-client.ts";
import { layer as gitHubLoginLayer } from "./layers/github/github-login.ts";
import { attachPtyServer } from "./layers/terminal/pty-socket.ts";
import { layer as terminalExecLayer } from "./layers/terminal/terminal-exec.ts";
import { resetProviders } from "./layers/language/language.providers.ts";
import { loadLoginEnvironment } from "./layers/shell/login-environment.ts";
import {
  layer as workspaceContextLayer,
  type InitialSelection,
} from "./layers/workspace/workspace-context.ts";

const envRepo = process.env["REVIEWER_REPO"];
const initial: InitialSelection =
  envRepo !== undefined && envRepo.length > 0
    ? { path: envRepo, explicit: true }
    : { path: process.cwd(), explicit: false };
const port = Number(process.env["REVIEWER_PORT"] ?? 41811);

/**
 * The API router with every feature controller attached. The OpenAPI document
 * (consumed by the SPA's typesafe `openapi-fetch` client) is served at
 * /api/openapi.json, and a Scalar API reference at /api/reference.
 */
const ApiLive = Layer.mergeAll(
  HttpApiBuilder.layer(Api, { openapiPath: "/api/openapi.json" }),
  HttpApiScalar.layer(Api, { path: "/api/reference" })
).pipe(
  Layer.provide(WorkspaceHandler),
  Layer.provide(RepoHandler),
  Layer.provide(CommentsHandler),
  Layer.provide(GitHubHandler),
  Layer.provide(GitMessageHandler),
  Layer.provide(ThreadsHandler),
  Layer.provide(ChatsHandler),
  Layer.provide(LanguageHandler),
  Layer.provide(LocalDevHandler),
  Layer.provide(ThemesHandler)
);

/** Stateless feature services, resolved per request. */
const FeatureServices = Layer.mergeAll(
  WorkspaceLive,
  RepoLive,
  BranchTargetsLive,
  CommentsLive,
  GitHubLive,
  GitMessageLive,
  ThreadsLive,
  ChatsLive,
  LanguageLive,
  LocalDevLive,
  DevRuntimeLive
);

/**
 * Global singletons, built once so the selected-repo state persists across
 * requests: the database, the workspace context (mutable selection), the git
 * executor, the GitHub client, the GitHub sign-in (the CLI polls GitHub long
 * after the request that started it) and the commit-message drafts (a
 * drafting agent CLI outlives the request that started it, so its slot has to
 * outlive it too).
 *
 * The database comes first — opening a repository imports whatever it still
 * keeps in `.reviewer/*.json`, so the file has to be there (and migrated) before
 * the workspace context seeds its initial selection.
 */
const InfraLive = gitHubClientLayer.pipe(
  Layer.provideMerge(
    Layer.mergeAll(
      gitExecLayer,
      terminalExecLayer,
      commitDraftsLayer,
      gitHubLoginLayer
    )
  ),
  Layer.provideMerge(repoIndexLayer()),
  Layer.provideMerge(workspaceContextLayer(initial)),
  Layer.provideMerge(databaseLayer),
  Layer.provide(FetchHttpClient.layer)
);

/**
 * The macOS shell loads the SPA from the `reviewer://app` protocol and calls
 * the API at `http://localhost:<port>`, so every request is cross-origin.
 * Allow all origins — this server is local-only and never credentialed.
 */
// Wrap node's createServer so every server instance also hosts the live-terminal
// PTY WebSocket, attached to its `upgrade` event, alongside the Effect HttpApi.
const createServerWithPty: typeof createServer = ((
  ...args: Parameters<typeof createServer>
) => {
  const server = createServer(...args);
  attachPtyServer(server);
  return server;
}) as typeof createServer;

const HttpLive = HttpRouter.serve(
  Layer.mergeAll(
    ApiLive.pipe(HttpRouter.provideRequest(FeatureServices)),
    HttpRouter.cors()
  )
).pipe(
  Layer.provide(InfraLive),
  Layer.provide(NodeHttpServer.layer(createServerWithPty, { port }))
);

/**
 * Ask the shell for the developer's environment while the server starts, so a
 * language server behind a version manager's shims is found — see
 * `layers/shell/login-environment.ts`. Nothing waits for it: requests arriving
 * first are answered from this process's own environment, and the provider
 * lists built from it are dropped when the real one lands.
 */
void loadLoginEnvironment().then(resetProviders, resetProviders);

NodeRuntime.runMain(Layer.launch(HttpLive));
