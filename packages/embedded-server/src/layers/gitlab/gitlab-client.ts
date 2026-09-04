/**
 * GitLabClient — thin REST gateway to the GitLab API v4 for the currently
 * selected repository. Resolves the project from `origin` (including the host,
 * so a self-hosted install works the same as gitlab.com), finds an auth token
 * (GITLAB_TOKEN / GITLAB_ACCESS_TOKEN / GL_TOKEN / `glab auth token`), and
 * exposes the JSON helpers the GitLab provider builds on.
 *
 * The GitHub client's twin, deliberately: same shape, same failure channel,
 * same "log once when the request goes out unauthenticated" behaviour. What
 * differs is what GitLab actually needs — a project addressed by its URL-
 * encoded path rather than owner/repo, a `PRIVATE-TOKEN` header rather than a
 * bearer, and a base URL that is only known once `origin` has been read.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { HttpClient, HttpClientRequest } from "effect/unstable/http";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { GitProviderError } from "@byconvo/core/ports/git-provider";
import type { GitRemoteInfo } from "@byconvo/core/ports/git-remote";
import { GitExec } from "../git/git-exec.ts";
import { originRemote } from "../reviews/origin-remote.ts";

export interface GitLabProject {
  /** The project's path with namespace, subgroups included. */
  readonly path: string;
  /** That path, URL-encoded — how every GitLab endpoint names a project. */
  readonly id: string;
  /** Where this GitLab lives, with no trailing slash. */
  readonly webUrl: string;
}

export interface GitLabClientShape {
  /** The project for `origin`, or a failure when it is not a GitLab remote. */
  readonly project: Effect.Effect<GitLabProject, GitProviderError>;
  readonly getJson: (path: string) => Effect.Effect<unknown, GitProviderError>;
  readonly postJson: (
    path: string,
    body: unknown
  ) => Effect.Effect<unknown, GitProviderError>;
  readonly putJson: (
    path: string,
    body: unknown
  ) => Effect.Effect<unknown, GitProviderError>;
  /** A DELETE. GitLab answers 204 with no body, so there is nothing to read. */
  readonly deleteResource: (
    path: string
  ) => Effect.Effect<void, GitProviderError>;
  /**
   * One GraphQL query, with its `data` unwrapped.
   *
   * GraphQL answers 200 with an `errors` array rather than a status, so a
   * failed query would otherwise arrive here as a success holding nulls. It
   * also moves faster than the REST API does: a field this GitLab is too old
   * to know is an error rather than a missing key, so every caller of this
   * needs a way back to REST when it fails.
   */
  readonly graphql: (
    query: string,
    variables: Record<string, unknown>
  ) => Effect.Effect<unknown, GitProviderError>;
}

export class GitLabClient extends Context.Service<
  GitLabClient,
  GitLabClientShape
>()("GitLabClient") {}

/**
 * GitLab's own sentence about a refusal. It spells the reason `message` or
 * `error` depending on which layer refused, and `message` is sometimes an
 * object keyed by field — so all three shapes are read rather than the first.
 */
export const gitlabMessage = (body: string): string => {
  try {
    const parsed = JSON.parse(body) as { message?: unknown; error?: unknown };
    const { message, error } = parsed;
    if (typeof message === "string" && message.length > 0) return message;
    if (typeof error === "string" && error.length > 0) return error;
    if (typeof message === "object" && message !== null) {
      const parts = Object.entries(message as Record<string, unknown>).map(
        ([field, detail]) =>
          `${field}: ${Array.isArray(detail) ? detail.join(", ") : String(detail)}`
      );
      if (parts.length > 0) return parts.join("; ");
    }
  } catch {
    /* not JSON — fall through to the raw body */
  }
  const trimmed = body.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 300) : "empty response body";
};

const AUTH_STATUSES = new Set([401, 403, 404]);

export const gitlabResponseError = (
  path: string,
  status: number,
  body: string,
  authenticated: boolean
): GitProviderError =>
  new GitProviderError({
    status,
    reason:
      `GitLab responded ${status} for ${path}: ${gitlabMessage(body)}` +
      (authenticated || !AUTH_STATUSES.has(status)
        ? ""
        : " — the request went out unauthenticated; set GITLAB_TOKEN or run `glab auth login`"),
  });

const transportError = (path: string, error: unknown): GitProviderError =>
  new GitProviderError({
    reason: `GitLab request to ${path} failed: ${String(error)}`,
  });

/** How a GitLab endpoint names the project: its full path, URL-encoded. */
export const projectOf = (remote: GitRemoteInfo): GitLabProject => ({
  path: remote.path,
  id: encodeURIComponent(remote.path),
  webUrl: remote.webUrl,
});

export const make = Effect.gen(function* () {
  const git = yield* GitExec;
  const client = yield* HttpClient.HttpClient;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

  const tokenFromGlabCli = spawner
    .string(ChildProcess.make("glab", ["auth", "token"]))
    .pipe(
      Effect.map((out) => out.trim()),
      Effect.map((out) => (out.length > 0 ? out : null)),
      // `glab` not on PATH (common in a packaged app launched from Finder) or
      // not logged in. Log it — otherwise the request silently goes out
      // unauthenticated and a private project comes back empty with no clue why.
      Effect.catch((error) =>
        Effect.as(
          Effect.logWarning(
            "GitLab auth: could not get a token from `glab auth token`; " +
              "continuing unauthenticated (private projects will return no data). " +
              "Set GITLAB_TOKEN or ensure the `glab` CLI is installed and on PATH.",
            error
          ),
          null
        )
      )
    );

  const resolveToken = Effect.gen(function* () {
    const env =
      process.env["GITLAB_TOKEN"] ??
      process.env["GITLAB_ACCESS_TOKEN"] ??
      process.env["GL_TOKEN"];
    if (env !== undefined && env.length > 0) return env;
    return yield* tokenFromGlabCli;
  });

  const remote = originRemote(git).pipe(
    Effect.flatMap((info) =>
      info.host === "gitlab"
        ? Effect.succeed(info)
        : Effect.fail(
            new GitProviderError({ reason: "origin is not a GitLab remote" })
          )
    )
  );

  const project: GitLabClientShape["project"] = Effect.map(remote, projectOf);

  const headers = (token: string | null) => ({
    accept: "application/json",
    "user-agent": "byconvo.com",
    ...(token === null ? {} : { "private-token": token }),
  });

  const requestText = (
    path: string,
    request: (
      url: string,
      init: { headers: Record<string, string> }
    ) => HttpClientRequest.HttpClientRequest
  ) =>
    Effect.gen(function* () {
      const { webUrl } = yield* project;
      const token = yield* resolveToken;
      const response = yield* client
        .execute(
          request(`${webUrl}/api/v4${path}`, { headers: headers(token) })
        )
        .pipe(Effect.mapError((error) => transportError(path, error)));
      const body = yield* response.text.pipe(Effect.orElseSucceed(() => ""));
      if (response.status >= 400) {
        return yield* Effect.fail(
          gitlabResponseError(path, response.status, body, token !== null)
        );
      }
      return body;
    });

  const parseJson = (path: string, body: string) =>
    Effect.try({
      try: () => JSON.parse(body) as unknown,
      catch: (error) =>
        new GitProviderError({
          reason: `GitLab sent an unreadable response for ${path}: ${String(error)}`,
        }),
    });

  const getJson: GitLabClientShape["getJson"] = (path) =>
    requestText(path, (url, init) => HttpClientRequest.get(url, init)).pipe(
      Effect.flatMap((body) => parseJson(path, body))
    );

  const postJson: GitLabClientShape["postJson"] = (path, body) =>
    requestText(path, (url, init) =>
      HttpClientRequest.bodyJsonUnsafe(HttpClientRequest.post(url, init), body)
    ).pipe(Effect.flatMap((text) => parseJson(path, text)));

  const putJson: GitLabClientShape["putJson"] = (path, body) =>
    requestText(path, (url, init) =>
      HttpClientRequest.bodyJsonUnsafe(HttpClientRequest.put(url, init), body)
    ).pipe(Effect.flatMap((text) => parseJson(path, text)));

  const deleteResource: GitLabClientShape["deleteResource"] = (path) =>
    requestText(path, (url, init) => HttpClientRequest.delete(url, init)).pipe(
      Effect.asVoid
    );

  /**
   * GraphQL lives beside the REST API rather than under it — `/api/graphql`,
   * not `/api/v4/graphql` — so the request is built here rather than going
   * through `requestText`'s path.
   */
  const graphql: GitLabClientShape["graphql"] = (query, variables) =>
    Effect.gen(function* () {
      const { webUrl } = yield* project;
      const token = yield* resolveToken;
      const path = "/api/graphql";
      const response = yield* client
        .execute(
          HttpClientRequest.bodyJsonUnsafe(
            HttpClientRequest.post(`${webUrl}${path}`, {
              headers: headers(token),
            }),
            { query, variables }
          )
        )
        .pipe(Effect.mapError((error) => transportError(path, error)));
      const text = yield* response.text.pipe(Effect.orElseSucceed(() => ""));
      if (response.status >= 400) {
        return yield* Effect.fail(
          gitlabResponseError(path, response.status, text, token !== null)
        );
      }
      const body = (yield* parseJson(path, text)) as {
        data?: unknown;
        errors?: ReadonlyArray<{ message?: unknown }>;
      };
      const errors = body.errors;
      if (Array.isArray(errors) && errors.length > 0) {
        const messages = errors
          .map((error) =>
            typeof error.message === "string" ? error.message : "unknown"
          )
          .join("; ");
        return yield* Effect.fail(
          new GitProviderError({ reason: `GitLab GraphQL: ${messages}` })
        );
      }
      return body.data === undefined || body.data === null
        ? yield* Effect.fail(
            new GitProviderError({ reason: "GitLab GraphQL returned no data" })
          )
        : body.data;
    });

  return GitLabClient.of({
    project,
    getJson,
    postJson,
    putJson,
    deleteResource,
    graphql,
  });
});

export const layer: Layer.Layer<
  GitLabClient,
  never,
  GitExec | HttpClient.HttpClient | ChildProcessSpawner.ChildProcessSpawner
> = Layer.effect(GitLabClient)(make);
