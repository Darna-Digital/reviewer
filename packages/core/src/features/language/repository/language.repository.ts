import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type { LanguageFailure } from "../../../ports/language-provider.ts"
import type {
  DefinitionResult,
  DiagnosticsResult,
  HoverResult,
  LanguageProviderInfo,
  Position,
  ReferencesResult,
} from "../schema/language.schema.ts"

/**
 * The language backend as the service sees it: repository-relative paths in,
 * LSP-shaped answers out. The implementation owns provider selection and the
 * absolute repository root; neither leaks past this boundary.
 *
 * `contents` is the editor's unsaved buffer, or null to analyse the file on
 * disk.
 */
export interface LanguageRepo {
  /** Installed providers and whether each can serve the current repository. */
  readonly providers: Effect.Effect<
    ReadonlyArray<LanguageProviderInfo>,
    LanguageFailure
  >
  readonly diagnostics: (
    path: string,
    contents: string | null
  ) => Effect.Effect<DiagnosticsResult, LanguageFailure>
  readonly definition: (
    path: string,
    position: Position,
    contents: string | null
  ) => Effect.Effect<DefinitionResult, LanguageFailure>
  readonly references: (
    path: string,
    position: Position,
    contents: string | null
  ) => Effect.Effect<ReferencesResult, LanguageFailure>
  readonly hover: (
    path: string,
    position: Position,
    contents: string | null
  ) => Effect.Effect<HoverResult, LanguageFailure>
}

export class LanguageRepository extends Context.Service<
  LanguageRepository,
  LanguageRepo
>()("LanguageRepository") {}
