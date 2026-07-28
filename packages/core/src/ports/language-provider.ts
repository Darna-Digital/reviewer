/**
 * LanguageProvider — the plugin port every language integration implements.
 *
 * The shapes are LSP's: zero-based {@link Position} (line + UTF-16 `character`),
 * half-open ranges, `Location`, diagnostic tags. Adding a language therefore
 * means adapting an existing language server rather than inventing a protocol —
 * an `lsp-stdio` provider is a mechanical mapping of the wire types, while an
 * `in-process` provider (the bundled TypeScript one) implements the same
 * contract without paying for a subprocess.
 *
 * Only repository-relative POSIX paths cross this port. The absolute `root`
 * travels beside them so providers can resolve files on disk without leaking
 * machine paths into the HTTP API or the UI.
 */
import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import type { NoRepoSelected } from "../shared.ts"
import type {
  DefinitionResult,
  Diagnostic,
  HoverResult,
  Position,
  ReferencesResult,
  ProviderTransport,
} from "../features/language/schema/language.schema.ts"

export class LanguageError extends Schema.TaggedErrorClass<LanguageError>()(
  "LanguageError",
  { providerId: Schema.String, reason: Schema.String },
  { httpApiStatus: 500 }
) {
  override get message(): string {
    return `${this.providerId}: ${this.reason}`
  }
}

export type LanguageFailure = LanguageError | NoRepoSelected

/** What a provider can answer. Unsupported operations return empty results. */
export interface ProviderCapabilities {
  readonly diagnostics: boolean
  readonly definition: boolean
  readonly references: boolean
  readonly hover: boolean
}

/** Whether a provider can serve a given repository right now. */
export interface ProviderAvailability {
  readonly available: boolean
  /** Human-readable reason — shown in settings when `available` is false. */
  readonly detail: string
}

export interface DocumentRequest {
  /** Absolute repository root. */
  readonly root: string
  /** Repository-relative POSIX path of the document. */
  readonly path: string
  /**
   * The editor's unsaved buffer, or null to read the file from disk. Providers
   * must honour it so diagnostics track what the user is looking at.
   */
  readonly contents: string | null
}

export interface PositionRequest extends DocumentRequest {
  readonly position: Position
}

export interface LanguageProvider {
  /** Stable id, e.g. `typescript` or `lsp:rust-analyzer`. */
  readonly id: string
  readonly name: string
  /**
   * What this provider claims. Entries starting with `.` match a file
   * extension (`.ts`); entries without match a whole basename (`Dockerfile`).
   * Matching is case-insensitive.
   */
  readonly patterns: ReadonlyArray<string>
  readonly transport: ProviderTransport
  readonly capabilities: ProviderCapabilities
  readonly probe: (root: string) => Effect.Effect<ProviderAvailability>
  readonly diagnostics: (
    request: DocumentRequest
  ) => Effect.Effect<ReadonlyArray<Diagnostic>, LanguageError>
  readonly definition: (
    request: PositionRequest
  ) => Effect.Effect<DefinitionResult, LanguageError>
  readonly references: (
    request: PositionRequest
  ) => Effect.Effect<ReferencesResult, LanguageError>
  readonly hover: (
    request: PositionRequest
  ) => Effect.Effect<HoverResult, LanguageError>
}

/**
 * The installed providers, in priority order — the first whose patterns match a
 * path serves it, so configured providers can shadow the built-in ones.
 */
export interface LanguageProvidersShape {
  readonly all: ReadonlyArray<LanguageProvider>
}

export class LanguageProviders extends Context.Service<
  LanguageProviders,
  LanguageProvidersShape
>()("LanguageProviders") {}
