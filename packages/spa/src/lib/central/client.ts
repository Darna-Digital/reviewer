/**
 * The typed client for the central server — the shared, multi-tenant half of
 * byconvo, as opposed to the embedded server that reads this machine's git
 * checkout. They are separate origins, so they get separate clients.
 *
 * The session is a cookie, so every request here is credentialed. In the
 * browser that means going through Vite's `/central-api` proxy so the cookie is
 * same-origin; in the packaged desktop shell it means the real origin plus
 * `credentials: "include"`, which the server's CORS config allows by name.
 */
import createFetchClient from "openapi-fetch"
import type { paths } from "./schema"

type ByconvoWindow = Window & {
  byconvo?: { centralApiBaseUrl?: string }
}

const desktopBaseUrl =
  typeof window === "undefined"
    ? undefined
    : (window as ByconvoWindow).byconvo?.centralApiBaseUrl

/**
 * Same-origin behind the dev proxy, absolute in the desktop shell. The proxy
 * strips the `/central-api` prefix, so paths are written as the server sees
 * them and only the base changes.
 */
export const centralBaseUrl = desktopBaseUrl ?? "/central-api"

/**
 * Where better-auth's routes live, spelled absolutely and in full.
 *
 * Two constraints meet here. Its client parses the base URL at construction and
 * rejects a relative one — and this module is evaluated during the dev server's
 * shell render, where there is no `window` to resolve against, so outside the
 * browser it addresses the central server directly (the origin the proxy would
 * have forwarded to anyway). And a base URL that already carries a path is
 * taken as complete, so `/api/auth` has to be part of it rather than passed as
 * `basePath` — otherwise every call lands one directory too high.
 */
const centralOrigin =
  desktopBaseUrl ??
  (typeof window === "undefined"
    ? (import.meta.env["VITE_BYCONVO_CENTRAL_URL"] ?? "http://localhost:41821")
    : `${window.location.origin}/central-api`)

export const centralAuthBaseUrl = `${centralOrigin}/api/auth`

export const centralClient = createFetchClient<paths>({
  baseUrl: centralBaseUrl,
  credentials: "include",
})

/** The error body every workspace endpoint returns on failure. */
export interface CentralError {
  readonly _tag?: string
  readonly reason?: string
}

/**
 * openapi-fetch reports failures in the result rather than by throwing, but a
 * TanStack DB mutation handler has to reject for the optimistic write to roll
 * back. This turns one into the other, keeping the server's own wording.
 */
export const unwrap = <T>(
  result: { data?: T; error?: unknown },
  fallback: string
): T => {
  if (result.error !== undefined) {
    const error = result.error as CentralError
    throw new Error(error.reason ?? fallback)
  }
  return result.data as T
}
