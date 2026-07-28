import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { LanguageError } from "../../../ports/language-provider.ts"
import {
  normalizeDiagnostics,
  normalizeReferences,
  normalizeTargets,
} from "../functions/language.results.ts"
import {
  LanguageRepository,
  type LanguageRepo,
} from "../repository/language.repository.ts"

/**
 * The language service — request validation and result normalisation around
 * whichever provider the repository picked. Everything below it is a plugin, so
 * the guarantees the UI relies on (no blank paths, deduplicated results, stable
 * document order, bounded payloads) are stated once, here, instead of in every
 * provider.
 */
export interface LanguageServiceShape extends LanguageRepo {}

export class LanguageService extends Context.Service<
  LanguageService,
  LanguageServiceShape
>()("LanguageService") {}

const SERVICE_ID = "language"

const requirePath = (path: string): Effect.Effect<string, LanguageError> => {
  const trimmed = path.trim()
  return trimmed.length === 0
    ? Effect.fail(
        new LanguageError({
          providerId: SERVICE_ID,
          reason: "a file path is required",
        })
      )
    : Effect.succeed(trimmed)
}

export const makeLanguageService = Effect.gen(function* () {
  const repo = yield* LanguageRepository

  const service: LanguageServiceShape = {
    providers: repo.providers,

    diagnostics: (path, contents) =>
      requirePath(path).pipe(
        Effect.flatMap((valid) => repo.diagnostics(valid, contents)),
        Effect.map((result) => ({
          ...result,
          diagnostics: normalizeDiagnostics(result.diagnostics),
        }))
      ),

    definition: (path, position, contents) =>
      requirePath(path).pipe(
        Effect.flatMap((valid) => repo.definition(valid, position, contents)),
        Effect.map((result) => ({
          ...result,
          targets: normalizeTargets(result.targets),
        }))
      ),

    references: (path, position, contents) =>
      requirePath(path).pipe(
        Effect.flatMap((valid) => repo.references(valid, position, contents)),
        Effect.map((result) => ({
          ...result,
          references: normalizeReferences(result.references),
        }))
      ),

    hover: (path, position, contents) =>
      requirePath(path).pipe(
        Effect.flatMap((valid) => repo.hover(valid, position, contents))
      ),
  }

  return LanguageService.of(service)
})
