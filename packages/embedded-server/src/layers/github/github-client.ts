/**
 * GitHubClient — thin REST gateway to the GitHub API for the currently
 * selected repository. Resolves the owner/repo from `origin`, finds an auth
 * token (GITHUB_TOKEN / GH_TOKEN / `gh auth token`), and exposes JSON/text
 * helpers the GitHub feature repository builds on.
 */
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { HttpClient, HttpClientRequest } from "effect/unstable/http"
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process"
import { GitProviderError } from "@byconvo/core/ports/git-provider"
import { GitExec } from "../git/git-exec.ts"

const API = "https://api.github.com"

export interface GitHubRepo {
  readonly owner: string
  readonly repo: string
}

export interface GitHubClientShape {
  /** owner/repo for `origin`, or fail when it is not a GitHub remote. */
  readonly repo: Effect.Effect<GitHubRepo, GitProviderError>
  readonly getJson: (path: string) => Effect.Effect<unknown, GitProviderError>
  readonly getText: (
    path: string,
    accept: string
  ) => Effect.Effect<string, GitProviderError>
  readonly postJson: (
    path: string,
    body: unknown
  ) => Effect.Effect<unknown, GitProviderError>
}

export class GitHubClient extends Context.Service<
  GitHubClient,
  GitHubClientShape
>()("GitHubClient") {}

const githubMessage = (body: string): string => {
  try {
    const parsed = JSON.parse(body) as { message?: unknown }
    if (typeof parsed.message === "string" && parsed.message.length > 0)
      return parsed.message
  } catch {
    /* not JSON — fall through to the raw body */
  }
  const trimmed = body.trim()
  return trimmed.length > 0 ? trimmed.slice(0, 300) : "empty response body"
}

const AUTH_STATUSES = new Set([401, 403, 404])

const responseError = (
  path: string,
  status: number,
  body: string,
  authenticated: boolean
): GitProviderError =>
  new GitProviderError({
    status,
    reason:
      `GitHub responded ${status} for ${path}: ${githubMessage(body)}` +
      (authenticated || !AUTH_STATUSES.has(status)
        ? ""
        : " — the request went out unauthenticated; set GITHUB_TOKEN/GH_TOKEN or run `gh auth login`"),
  })

const transportError = (path: string, error: unknown): GitProviderError =>
  new GitProviderError({
    reason: `GitHub request to ${path} failed: ${String(error)}`,
  })

const parseGitHubRemote = (url: string): GitHubRepo | null => {
  const match = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/)
  const owner = match?.[1]
  const repo = match?.[2]
  return owner !== undefined && repo !== undefined ? { owner, repo } : null
}

export const make = Effect.gen(function* () {
  const git = yield* GitExec
  const client = yield* HttpClient.HttpClient
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner

  const tokenFromGhCli = spawner
    .string(ChildProcess.make("gh", ["auth", "token"]))
    .pipe(
      Effect.map((out) => out.trim()),
      Effect.map((out) => (out.length > 0 ? out : null)),
      // `gh` not on PATH (common in a packaged app launched from Finder) or not
      // logged in. Log it — otherwise the request silently goes out
      // unauthenticated and private-repo data comes back empty with no clue why.
      Effect.catch((error) =>
        Effect.as(
          Effect.logWarning(
            "GitHub auth: could not get a token from `gh auth token`; " +
              "continuing unauthenticated (private repos will return no data). " +
              "Set GITHUB_TOKEN/GH_TOKEN or ensure the `gh` CLI is installed and on PATH.",
            error
          ),
          null
        )
      )
    )

  const resolveToken = Effect.gen(function* () {
    const env = process.env["GITHUB_TOKEN"] ?? process.env["GH_TOKEN"]
    if (env !== undefined && env.length > 0) return env
    return yield* tokenFromGhCli
  })

  const repo: GitHubClientShape["repo"] = git
    .run("remote", "get-url", "origin")
    .pipe(
      Effect.mapError(
        (error) => new GitProviderError({ reason: error.message })
      ),
      Effect.flatMap((out) => {
        const parsed = parseGitHubRemote(out.trim())
        return parsed === null
          ? Effect.fail(
              new GitProviderError({ reason: "origin is not a GitHub remote" })
            )
          : Effect.succeed(parsed)
      })
    )

  const headers = (accept: string, token: string | null) => ({
    accept,
    "x-github-api-version": "2022-11-28",
    "user-agent": "bemybond.com",
    ...(token === null ? {} : { authorization: `Bearer ${token}` }),
  })

  const requestText = (
    path: string,
    accept: string,
    request: (
      url: string,
      init: { headers: Record<string, string> }
    ) => HttpClientRequest.HttpClientRequest
  ) =>
    Effect.gen(function* () {
      const token = yield* resolveToken
      const response = yield* client
        .execute(request(`${API}${path}`, { headers: headers(accept, token) }))
        .pipe(Effect.mapError((error) => transportError(path, error)))
      const body = yield* response.text.pipe(Effect.orElseSucceed(() => ""))
      if (response.status >= 400) {
        return yield* Effect.fail(
          responseError(path, response.status, body, token !== null)
        )
      }
      return body
    })

  const parseJson = (path: string, body: string) =>
    Effect.try({
      try: () => JSON.parse(body) as unknown,
      catch: (error) =>
        new GitProviderError({
          reason: `GitHub sent an unreadable response for ${path}: ${String(error)}`,
        }),
    })

  const getJson: GitHubClientShape["getJson"] = (path) =>
    requestText(path, "application/vnd.github+json", (url, init) =>
      HttpClientRequest.get(url, init)
    ).pipe(Effect.flatMap((body) => parseJson(path, body)))

  const getText: GitHubClientShape["getText"] = (path, accept) =>
    requestText(path, accept, (url, init) => HttpClientRequest.get(url, init))

  const postJson: GitHubClientShape["postJson"] = (path, body) =>
    requestText(path, "application/vnd.github+json", (url, init) =>
      HttpClientRequest.bodyJsonUnsafe(HttpClientRequest.post(url, init), body)
    ).pipe(Effect.flatMap((text) => parseJson(path, text)))

  return GitHubClient.of({ repo, getJson, getText, postJson })
})

export const layer: Layer.Layer<
  GitHubClient,
  never,
  GitExec | HttpClient.HttpClient | ChildProcessSpawner.ChildProcessSpawner
> = Layer.effect(GitHubClient)(make)
