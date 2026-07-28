/**
 * Wires the real language API into the pure logic.
 *
 * Diagnostics are a query keyed by path and buffer, so switching files or
 * editing re-fetches while hovering the same token repeatedly does not.
 * Definition, references and hover are one-shot fetches rather than queries:
 * they answer a click, and caching a stale definition across an edit would be
 * worse than asking again.
 */
import { useMemo } from "react"
import type { Diagnostic, Position } from "@byconvo/core/language"
import { api, fetchClient } from "@/lib/api/client"
import { createLanguageFunctions } from "../functions/language.functions"
import type { LanguageFunctions } from "../interfaces/language.interfaces"

/** How long diagnostics stay fresh; long enough to survive a scroll. */
const DIAGNOSTICS_STALE_MS = 10_000

const fail = (error: unknown, fallback: string): never => {
  throw new Error((error as { reason?: string })?.reason ?? fallback)
}

/** Installed language providers and whether each can serve this repository. */
export const useLanguageProviders = () =>
  api.useQuery("get", "/api/language/providers", {}, { retry: false })

/**
 * Diagnostics for `path`. Pass `contents` to analyse an unsaved buffer instead
 * of what is on disk. Disabled when there is no file open.
 */
export const useDiagnostics = (path: string | null, contents?: string | null) =>
  api.useQuery(
    "post",
    "/api/language/diagnostics",
    {
      body: {
        path: path ?? "",
        ...(contents === null || contents === undefined ? {} : { contents }),
      },
    },
    {
      enabled: path !== null,
      staleTime: DIAGNOSTICS_STALE_MS,
      // A repository without a provider is the normal case, not a problem to
      // retry; real failures show up in the providers list.
      retry: false,
    }
  )

const positionQuery = (path: string, position: Position) => ({
  params: {
    query: {
      path,
      line: String(position.line),
      character: String(position.character),
    },
  },
})

/**
 * The language actions, bound to the real API. Each call carries its own path,
 * so only the diagnostics on screen are part of the identity.
 */
export const useLanguageActions = (
  diagnostics: ReadonlyArray<Diagnostic>
): LanguageFunctions =>
  useMemo(
    () =>
      createLanguageFunctions({
        data: { diagnostics },
        sideEffects: {
          definition: async (filePath, position) => {
            const { data, error } = await fetchClient.GET(
              "/api/language/definition",
              positionQuery(filePath, position)
            )
            if (error) return fail(error, "could not resolve the definition")
            return data
          },
          references: async (filePath, position) => {
            const { data, error } = await fetchClient.GET(
              "/api/language/references",
              positionQuery(filePath, position)
            )
            if (error) return fail(error, "could not find usages")
            return data
          },
          hover: async (filePath, position) => {
            const { data, error } = await fetchClient.GET(
              "/api/language/hover",
              positionQuery(filePath, position)
            )
            if (error) return fail(error, "could not read the symbol")
            return data
          },
        },
      }),
    [diagnostics]
  )
