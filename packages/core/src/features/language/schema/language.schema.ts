/**
 * Wire shapes for the language feature, modelled on LSP so any language server
 * maps onto them without loss.
 *
 * Deliberate deviations, both to keep the HTTP API self-describing:
 *   - `Location` carries a repository-relative `path` instead of LSP's `uri`;
 *     every other byconvo feature (comments, diffs) is path-addressed.
 *   - severities and reference kinds are named strings rather than LSP's
 *     integers, so the generated OpenAPI schema reads as an enum.
 * Positions stay exactly LSP's: zero-based lines and zero-based UTF-16
 * `character` offsets, with half-open ranges.
 */
import * as Schema from "effect/Schema"

export const Position = Schema.Struct({
  /** Zero-based line. */
  line: Schema.Int,
  /** Zero-based offset within the line, in UTF-16 code units. */
  character: Schema.Int,
})
export type Position = typeof Position.Type

/** Half-open: `start` is included, `end` is not. */
export const Range = Schema.Struct({ start: Position, end: Position })
export type Range = typeof Range.Type

export const Location = Schema.Struct({
  /** Repository-relative POSIX path. */
  path: Schema.String,
  range: Range,
})
export type Location = typeof Location.Type

/** LSP DiagnosticSeverity 1–4, named. */
export const DiagnosticSeverity = Schema.Literals([
  "error",
  "warning",
  "information",
  "hint",
])
export type DiagnosticSeverity = typeof DiagnosticSeverity.Type

/**
 * LSP DiagnosticTag. `unnecessary` is rendered faded rather than squiggled
 * (unused imports and locals), `deprecated` struck through.
 */
export const DiagnosticTag = Schema.Literals(["unnecessary", "deprecated"])
export type DiagnosticTag = typeof DiagnosticTag.Type

export const DiagnosticRelated = Schema.Struct({
  location: Location,
  message: Schema.String,
})
export type DiagnosticRelated = typeof DiagnosticRelated.Type

export const Diagnostic = Schema.Struct({
  range: Range,
  severity: DiagnosticSeverity,
  /** Rule/error code as text (`2322`, `no-unused-vars`), null when untagged. */
  code: Schema.NullOr(Schema.String),
  /** Producing tool, e.g. `ts` or `rust-analyzer`. */
  source: Schema.String,
  message: Schema.String,
  tags: Schema.Array(DiagnosticTag),
  related: Schema.Array(DiagnosticRelated),
})
export type Diagnostic = typeof Diagnostic.Type

export const DiagnosticsResult = Schema.Struct({
  path: Schema.String,
  /** Null when no installed provider claims this file — not an error. */
  providerId: Schema.NullOr(Schema.String),
  diagnostics: Schema.Array(Diagnostic),
})
export type DiagnosticsResult = typeof DiagnosticsResult.Type

export const SymbolTarget = Schema.Struct({
  location: Location,
  name: Schema.String,
  /** Provider-defined symbol kind (`function`, `class`, …). */
  kind: Schema.String,
  /** Enclosing symbol or module, empty when top-level. */
  containerName: Schema.String,
  /** The target's source line, trimmed — the picker's secondary text. */
  preview: Schema.String,
})
export type SymbolTarget = typeof SymbolTarget.Type

export const DefinitionResult = Schema.Struct({
  providerId: Schema.NullOr(Schema.String),
  /** The identifier span the request resolved to, for highlighting. */
  origin: Schema.NullOr(Range),
  targets: Schema.Array(SymbolTarget),
})
export type DefinitionResult = typeof DefinitionResult.Type

export const ReferenceKind = Schema.Literals(["definition", "write", "read"])
export type ReferenceKind = typeof ReferenceKind.Type

export const SymbolReference = Schema.Struct({
  location: Location,
  kind: ReferenceKind,
  preview: Schema.String,
})
export type SymbolReference = typeof SymbolReference.Type

export const ReferencesResult = Schema.Struct({
  providerId: Schema.NullOr(Schema.String),
  origin: Schema.NullOr(Range),
  /** Display name of the symbol the references belong to. */
  symbol: Schema.NullOr(Schema.String),
  references: Schema.Array(SymbolReference),
})
export type ReferencesResult = typeof ReferencesResult.Type

export const HoverResult = Schema.Struct({
  providerId: Schema.NullOr(Schema.String),
  range: Schema.NullOr(Range),
  /** Markdown (LSP MarkupContent); empty when there is nothing to show. */
  contents: Schema.String,
})
export type HoverResult = typeof HoverResult.Type

export const ProviderTransport = Schema.Literals(["in-process", "lsp-stdio"])
export type ProviderTransport = typeof ProviderTransport.Type

export const ProviderCapabilitiesInfo = Schema.Struct({
  diagnostics: Schema.Boolean,
  definition: Schema.Boolean,
  references: Schema.Boolean,
  hover: Schema.Boolean,
})
export type ProviderCapabilitiesInfo = typeof ProviderCapabilitiesInfo.Type

export const LanguageProviderInfo = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  /** Extensions (`.ts`) and whole basenames (`Dockerfile`) this provider claims. */
  patterns: Schema.Array(Schema.String),
  transport: ProviderTransport,
  capabilities: ProviderCapabilitiesInfo,
  available: Schema.Boolean,
  /** Why it is unavailable — a missing binary, no tsconfig, and so on. */
  detail: Schema.String,
})
export type LanguageProviderInfo = typeof LanguageProviderInfo.Type

/**
 * Query params. Numbers arrive as strings over HTTP and are validated by
 * `parsePositionQuery`, which reports bad input as a domain failure rather
 * than a schema decode error.
 */
export const DocumentQuery = Schema.Struct({ path: Schema.String })
export type DocumentQuery = typeof DocumentQuery.Type

export const PositionQuery = Schema.Struct({
  path: Schema.String,
  line: Schema.String,
  character: Schema.String,
})
export type PositionQuery = typeof PositionQuery.Type

/** Body for diagnostics of an unsaved buffer. */
export const DiagnosticsPayload = Schema.Struct({
  path: Schema.String,
  /** Unsaved editor contents; omit to diagnose what is on disk. */
  contents: Schema.optionalKey(Schema.String),
})
export type DiagnosticsPayload = typeof DiagnosticsPayload.Type
