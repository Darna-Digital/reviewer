import { it } from "@effect/vitest"
import { Effect } from "effect"
import { describe, expect } from "vitest"
import { LanguageError } from "../../../ports/language-provider.ts"
import { LanguageFrom, LanguageMemory } from "../layer/language.layer.memory.ts"
import type { LanguageRepo } from "../repository/language.repository.ts"
import type { Diagnostic, SymbolReference } from "../schema/language.schema.ts"
import { LanguageService } from "./language.service.ts"

const span = (line: number) => ({
  start: { line, character: 0 },
  end: { line, character: 4 },
})

const diagnostic = (
  line: number,
  severity: Diagnostic["severity"]
): Diagnostic => ({
  range: span(line),
  severity,
  code: null,
  source: "ts",
  message: `problem ${line} ${severity}`,
  tags: [],
  related: [],
})

const reference = (
  line: number,
  kind: SymbolReference["kind"]
): SymbolReference => ({
  location: { path: "src/a.ts", range: span(line) },
  kind,
  preview: "",
})

const seeded = LanguageMemory({
  files: { "src/a.ts": "const a = 1\nconst b = 2\n" },
  diagnostics: {
    "src/a.ts": [
      diagnostic(4, "warning"),
      diagnostic(1, "error"),
      diagnostic(1, "error"),
    ],
  },
  references: {
    "src/a.ts": [reference(2, "read"), reference(2, "definition")],
  },
})

/** A repository that answers nothing, so tests can override one member. */
const inert: LanguageRepo = {
  providers: Effect.succeed([]),
  diagnostics: (path) =>
    Effect.succeed({ path, providerId: null, diagnostics: [] }),
  definition: () =>
    Effect.succeed({ providerId: null, origin: null, targets: [] }),
  references: () =>
    Effect.succeed({
      providerId: null,
      origin: null,
      symbol: null,
      references: [],
    }),
  hover: () => Effect.succeed({ providerId: null, range: null, contents: "" }),
  completions: () =>
    Effect.succeed({
      providerId: null,
      replace: null,
      items: [],
      incomplete: false,
    }),
  resolveCompletion: () =>
    Effect.succeed({ detail: "", documentation: "", additionalEdits: [] }),
  codeActions: () => Effect.succeed({ providerId: null, actions: [] }),
}

const recorded: Array<string | null> = []
const recording: LanguageRepo = {
  ...inert,
  diagnostics: (path, contents) =>
    Effect.sync(() => {
      recorded.push(contents)
      return { path, providerId: "recording", diagnostics: [] }
    }),
}

const failing: LanguageRepo = {
  ...inert,
  diagnostics: () =>
    Effect.fail(
      new LanguageError({
        providerId: "typescript",
        reason: "tsserver crashed",
      })
    ),
}

describe("LanguageService", () => {
  it.effect("normalizes diagnostics from the provider", () =>
    Effect.gen(function* () {
      const language = yield* LanguageService
      const result = yield* language.diagnostics("src/a.ts", null)
      expect(result.providerId).toBe("memory")
      // Deduplicated and re-sorted into document order.
      expect(result.diagnostics.map((d) => d.range.start.line)).toEqual([1, 4])
    }).pipe(Effect.provide(seeded))
  )

  it.effect("normalizes references from the provider", () =>
    Effect.gen(function* () {
      const language = yield* LanguageService
      const result = yield* language.references(
        "src/a.ts",
        { line: 0, character: 6 },
        null
      )
      expect(result.references).toHaveLength(1)
      expect(result.references[0].kind).toBe("definition")
    }).pipe(Effect.provide(seeded))
  )

  it.effect(
    "reports no provider for an unclaimed file instead of failing",
    () =>
      Effect.gen(function* () {
        const language = yield* LanguageService
        const result = yield* language.diagnostics("README.md", null)
        expect(result.providerId).toBeNull()
        expect(result.diagnostics).toEqual([])
      }).pipe(Effect.provide(seeded))
  )

  it.effect("rejects a blank path", () =>
    Effect.gen(function* () {
      const language = yield* LanguageService
      const failure = yield* Effect.flip(language.diagnostics("   ", null))
      expect(failure._tag).toBe("LanguageError")
      expect(failure.message).toContain("file path is required")
    }).pipe(Effect.provide(seeded))
  )

  it.effect("passes an unsaved buffer through to the provider", () =>
    Effect.gen(function* () {
      const language = yield* LanguageService
      yield* language.diagnostics("src/a.ts", "edited")
      yield* language.diagnostics("src/a.ts", null)
      expect(recorded).toEqual(["edited", null])
    }).pipe(Effect.provide(LanguageFrom(recording)))
  )

  it.effect("surfaces a provider failure unchanged", () =>
    Effect.gen(function* () {
      const language = yield* LanguageService
      const failure = yield* Effect.flip(language.diagnostics("src/a.ts", null))
      expect(failure._tag).toBe("LanguageError")
      expect(failure.message).toContain("tsserver crashed")
    }).pipe(Effect.provide(LanguageFrom(failing)))
  )
})
