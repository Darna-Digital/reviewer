/**
 * HTTP surface of the language feature.
 *
 * Diagnostics are a POST because they carry the editor's unsaved buffer;
 * everything else is a GET keyed by path and position, so the SPA's query cache
 * can key on the URL and hovering the same token twice costs nothing.
 */
import {
  DefinitionResult,
  DiagnosticsPayload,
  DiagnosticsResult,
  HoverResult,
  LanguageProviderInfo,
  PositionQuery,
  ReferencesResult,
} from "@byconvo/core/language"
import { LanguageError } from "@byconvo/core/ports/language-provider"
import { NoRepoSelected } from "@byconvo/core/shared"
import * as Schema from "effect/Schema"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"

const errors = [NoRepoSelected, LanguageError] as const

export class LanguageApi extends HttpApiGroup.make("language")
  .add(
    HttpApiEndpoint.get("providers", "/language/providers", {
      success: Schema.Array(LanguageProviderInfo),
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("diagnostics", "/language/diagnostics", {
      payload: DiagnosticsPayload,
      success: DiagnosticsResult,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.get("definition", "/language/definition", {
      query: PositionQuery,
      success: DefinitionResult,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.get("references", "/language/references", {
      query: PositionQuery,
      success: ReferencesResult,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.get("hover", "/language/hover", {
      query: PositionQuery,
      success: HoverResult,
      error: errors,
    })
  ) {}
