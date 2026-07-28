import * as Effect from "effect/Effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import {
  LanguageService,
  parsePositionQuery,
  type Position,
} from "@byconvo/core/language"
import { LanguageError } from "@byconvo/core/ports/language-provider"
import { Api } from "../../api.ts"

/**
 * Positions arrive as query strings. Rejecting bad ones here — rather than
 * letting them decode to NaN and clamp to the top of the file — turns a client
 * bug into a clear 500 instead of a silently wrong answer.
 */
const positionOf = (query: {
  readonly line: string
  readonly character: string
}): Effect.Effect<Position, LanguageError> => {
  const parsed = parsePositionQuery(query)
  return parsed === null
    ? Effect.fail(
        new LanguageError({
          providerId: "language",
          reason: `line and character must be non-negative integers (got line=${query.line}, character=${query.character})`,
        })
      )
    : Effect.succeed(parsed)
}

export const LanguageHandler = HttpApiBuilder.group(
  Api,
  "language",
  (handlers) =>
    handlers
      .handle("providers", () =>
        Effect.flatMap(LanguageService, (s) => s.providers)
      )
      .handle("diagnostics", ({ payload }) =>
        Effect.flatMap(LanguageService, (s) =>
          s.diagnostics(payload.path, payload.contents ?? null)
        )
      )
      .handle("definition", ({ query }) =>
        Effect.flatMap(positionOf(query), (position) =>
          Effect.flatMap(LanguageService, (s) =>
            s.definition(query.path, position, null)
          )
        )
      )
      .handle("references", ({ query }) =>
        Effect.flatMap(positionOf(query), (position) =>
          Effect.flatMap(LanguageService, (s) =>
            s.references(query.path, position, null)
          )
        )
      )
      .handle("hover", ({ query }) =>
        Effect.flatMap(positionOf(query), (position) =>
          Effect.flatMap(LanguageService, (s) =>
            s.hover(query.path, position, null)
          )
        )
      )
)
