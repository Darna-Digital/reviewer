/**
 * HTTP surface of the language feature.
 *
 * Diagnostics are a POST because they carry the editor's unsaved buffer;
 * everything else is a GET keyed by path and position, so the SPA's query cache
 * can key on the URL and hovering the same token twice costs nothing. The GETs
 * also take `?repo=` to be answered against a repository other than the one
 * the window has open (see `language.scope.ts`).
 */
import {
  CodeActionsPayload,
  CodeActionsResult,
  CompletionResolution,
  CompletionResolvePayload,
  CompletionResult,
  CompletionsPayload,
  DefinitionResult,
  DiagnosticsPayload,
  DiagnosticsResult,
  DocumentQuery,
  DocumentSymbolsResult,
  HoverResult,
  InstallPayload,
  LanguageProviderInfo,
  PositionQuery,
  ReferencesResult,
} from "@reviewer/core/language";
import { LanguageError } from "@reviewer/core/ports/language-provider";
import { NoRepoSelected, Ok } from "@reviewer/core/shared";
import { InvalidRepo } from "@reviewer/core/workspace";
import * as Schema from "effect/Schema";
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";

const errors = [NoRepoSelected, LanguageError] as const;
/** For the GETs that take `?repo=`, which a bad root fails with a 400. */
const repoScopedErrors = [...errors, InvalidRepo] as const;

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
      error: repoScopedErrors,
    })
  )
  .add(
    HttpApiEndpoint.get("references", "/language/references", {
      query: PositionQuery,
      success: ReferencesResult,
      error: repoScopedErrors,
    })
  )
  .add(
    HttpApiEndpoint.get("hover", "/language/hover", {
      query: PositionQuery,
      success: HoverResult,
      error: repoScopedErrors,
    })
  )
  .add(
    HttpApiEndpoint.get("symbols", "/language/symbols", {
      query: DocumentQuery,
      success: DocumentSymbolsResult,
      error: repoScopedErrors,
    })
  )
  .add(
    HttpApiEndpoint.post("completions", "/language/completions", {
      payload: CompletionsPayload,
      success: CompletionResult,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("completionResolve", "/language/completion-resolve", {
      payload: CompletionResolvePayload,
      success: CompletionResolution,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("codeActions", "/language/code-actions", {
      payload: CodeActionsPayload,
      success: CodeActionsResult,
      error: errors,
    })
  )
  .add(
    // Starts the install and answers at once; the providers endpoint reports
    // how it is going through the provider's `installer.state`.
    HttpApiEndpoint.post("install", "/language/install", {
      payload: InstallPayload,
      success: Ok,
      error: errors,
    })
  ) {}
