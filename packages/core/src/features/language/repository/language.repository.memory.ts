/**
 * In-memory language backend — the test seam for the service and a working
 * stand-in for hosts with no analysis available (the SPA's own dev server, for
 * instance). Files are seeded as plain text and a seeded provider claims them,
 * so the service's validation and normalisation can be exercised without a
 * TypeScript program or a language server subprocess.
 */
import * as Effect from "effect/Effect"
import { previewAt } from "../functions/language.positions.ts"
import { selectProvider } from "../functions/language.registry.ts"
import type {
  Diagnostic,
  LanguageProviderInfo,
  Position,
  SymbolReference,
  SymbolTarget,
} from "../schema/language.schema.ts"
import type { LanguageRepo } from "./language.repository.ts"

export interface MemoryLanguageSeed {
  /** Repository-relative path to file contents, used for previews. */
  readonly files?: Readonly<Record<string, string>>
  readonly providers?: ReadonlyArray<LanguageProviderInfo>
  readonly diagnostics?: Readonly<Record<string, ReadonlyArray<Diagnostic>>>
  readonly targets?: Readonly<Record<string, ReadonlyArray<SymbolTarget>>>
  readonly references?: Readonly<Record<string, ReadonlyArray<SymbolReference>>>
  readonly hover?: Readonly<Record<string, string>>
}

const DEFAULT_PROVIDER: LanguageProviderInfo = {
  id: "memory",
  name: "In-memory",
  patterns: [".ts", ".tsx"],
  transport: "in-process",
  capabilities: {
    diagnostics: true,
    definition: true,
    references: true,
    hover: true,
  },
  available: true,
  detail: "",
}

export const makeMemoryLanguageRepository = (seed: MemoryLanguageSeed = {}) =>
  Effect.sync((): LanguageRepo => {
    const providers = seed.providers ?? [DEFAULT_PROVIDER]
    const files = seed.files ?? {}

    /** Null when no seeded provider claims the path — the unsupported case. */
    const providerFor = (path: string) =>
      selectProvider(providers, path)?.id ?? null

    /** The identifier-sized span a request resolved to, from the seeded text. */
    const originAt = (path: string, position: Position) => {
      const contents = files[path]
      if (contents === undefined) return null
      return {
        start: position,
        end: { line: position.line, character: position.character },
      }
    }

    return {
      providers: Effect.succeed(providers),

      diagnostics: (path) =>
        Effect.succeed({
          path,
          providerId: providerFor(path),
          diagnostics: seed.diagnostics?.[path] ?? [],
        }),

      definition: (path, position) =>
        Effect.succeed({
          providerId: providerFor(path),
          origin: originAt(path, position),
          targets: seed.targets?.[path] ?? [],
        }),

      references: (path, position) =>
        Effect.succeed({
          providerId: providerFor(path),
          origin: originAt(path, position),
          symbol: null,
          references: seed.references?.[path] ?? [],
        }),

      hover: (path, position) =>
        Effect.succeed({
          providerId: providerFor(path),
          range: originAt(path, position),
          contents:
            seed.hover?.[path] ?? previewAt(files[path] ?? "", position.line),
        }),
    }
  })
