/**
 * Wire shapes for the language feature, modelled on LSP so any language server
 * maps onto them without loss.
 *
 * Deliberate deviations, both to keep the HTTP API self-describing:
 *   - `Location` carries a project-relative `path` instead of LSP's `uri`;
 *     every other byconvo feature (comments, diffs) is path-addressed.
 *   - severities and reference kinds are named strings rather than LSP's
 *     integers, so the generated OpenAPI schema reads as an enum.
 * Positions stay exactly LSP's: zero-based lines and zero-based UTF-16
 * `character` offsets, with half-open ranges.
 */
import * as Schema from "effect/Schema";

export const Position = Schema.Struct({
  /** Zero-based line. */
  line: Schema.Int,
  /** Zero-based offset within the line, in UTF-16 code units. */
  character: Schema.Int,
});
export type Position = typeof Position.Type;

/** Half-open: `start` is included, `end` is not. */
export const Range = Schema.Struct({ start: Position, end: Position });
export type Range = typeof Range.Type;

export const Location = Schema.Struct({
  /** Project-relative POSIX path. */
  path: Schema.String,
  range: Range,
});
export type Location = typeof Location.Type;

/** LSP DiagnosticSeverity 1–4, named. */
export const DiagnosticSeverity = Schema.Literals([
  "error",
  "warning",
  "information",
  "hint",
]);
export type DiagnosticSeverity = typeof DiagnosticSeverity.Type;

/**
 * LSP DiagnosticTag. `unnecessary` is rendered faded rather than squiggled
 * (unused imports and locals), `deprecated` struck through.
 */
export const DiagnosticTag = Schema.Literals(["unnecessary", "deprecated"]);
export type DiagnosticTag = typeof DiagnosticTag.Type;

export const DiagnosticRelated = Schema.Struct({
  location: Location,
  message: Schema.String,
});
export type DiagnosticRelated = typeof DiagnosticRelated.Type;

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
});
export type Diagnostic = typeof Diagnostic.Type;

export const DiagnosticsResult = Schema.Struct({
  path: Schema.String,
  /** Null when no installed provider claims this file — not an error. */
  providerId: Schema.NullOr(Schema.String),
  diagnostics: Schema.Array(Diagnostic),
});
export type DiagnosticsResult = typeof DiagnosticsResult.Type;

export const SymbolTarget = Schema.Struct({
  location: Location,
  name: Schema.String,
  /** Provider-defined symbol kind (`function`, `class`, …). */
  kind: Schema.String,
  /** Enclosing symbol or module, empty when top-level. */
  containerName: Schema.String,
  /** The target's source line, trimmed — the picker's secondary text. */
  preview: Schema.String,
});
export type SymbolTarget = typeof SymbolTarget.Type;

export const DefinitionResult = Schema.Struct({
  providerId: Schema.NullOr(Schema.String),
  /** The identifier span the request resolved to, for highlighting. */
  origin: Schema.NullOr(Range),
  targets: Schema.Array(SymbolTarget),
});
export type DefinitionResult = typeof DefinitionResult.Type;

/**
 * How a usage reads where it stands.
 *
 * LSP's reference response says only that a location is a reference; a provider
 * that can see the syntax says more, and the extra words are what a usages tree
 * is worth grouping by — an import is not the same finding as an assignment.
 * A provider that cannot tell says `read`, which is the safe reading of a bare
 * reference.
 */
export const ReferenceKind = Schema.Literals([
  "definition",
  "import",
  "export",
  "write",
  "read",
]);
export type ReferenceKind = typeof ReferenceKind.Type;

export const SymbolReference = Schema.Struct({
  location: Location,
  kind: ReferenceKind,
  preview: Schema.String,
  /**
   * The symbol the usage sits inside — the function, method or class a results
   * tree files it under. Empty when the provider cannot see that far, or when
   * the usage is at the top level of its file.
   */
  containerName: Schema.String,
  /** That container's kind (`function`, `method`, `class`), empty when unknown. */
  containerKind: Schema.String,
});
export type SymbolReference = typeof SymbolReference.Type;

export const ReferencesResult = Schema.Struct({
  providerId: Schema.NullOr(Schema.String),
  origin: Schema.NullOr(Range),
  /** Display name of the symbol the references belong to. */
  symbol: Schema.NullOr(Schema.String),
  /**
   * Where the symbol is declared — what a usages view names at the top of its
   * results, above the usages themselves. Null when the provider could not
   * resolve one, which is the normal answer for a local binding.
   */
  declaration: Schema.NullOr(SymbolTarget),
  references: Schema.Array(SymbolReference),
});
export type ReferencesResult = typeof ReferencesResult.Type;

export const HoverResult = Schema.Struct({
  providerId: Schema.NullOr(Schema.String),
  range: Schema.NullOr(Range),
  /** Markdown (LSP MarkupContent); empty when there is nothing to show. */
  contents: Schema.String,
});
export type HoverResult = typeof HoverResult.Type;

export const ProviderTransport = Schema.Literals(["in-process", "lsp-stdio"]);
export type ProviderTransport = typeof ProviderTransport.Type;

export const ProviderCapabilitiesInfo = Schema.Struct({
  diagnostics: Schema.Boolean,
  definition: Schema.Boolean,
  references: Schema.Boolean,
  hover: Schema.Boolean,
  completions: Schema.Boolean,
  codeActions: Schema.Boolean,
});
export type ProviderCapabilitiesInfo = typeof ProviderCapabilitiesInfo.Type;

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
});
export type LanguageProviderInfo = typeof LanguageProviderInfo.Type;

/**
 * Query params. Numbers arrive as strings over HTTP and are validated by
 * `parsePositionQuery`, which reports bad input as a domain failure rather
 * than a schema decode error.
 */
export const DocumentQuery = Schema.Struct({ path: Schema.String });
export type DocumentQuery = typeof DocumentQuery.Type;

export const PositionQuery = Schema.Struct({
  path: Schema.String,
  line: Schema.String,
  character: Schema.String,
});
export type PositionQuery = typeof PositionQuery.Type;

/** Body for diagnostics of an unsaved buffer. */
export const DiagnosticsPayload = Schema.Struct({
  path: Schema.String,
  /** Unsaved editor contents; omit to diagnose what is on disk. */
  contents: Schema.optionalKey(Schema.String),
});
export type DiagnosticsPayload = typeof DiagnosticsPayload.Type;

// --- Completions and code actions ------------------------------------------

/** A replacement of `range` with `newText`, as LSP's `TextEdit`. */
export const TextEdit = Schema.Struct({ range: Range, newText: Schema.String });
export type TextEdit = typeof TextEdit.Type;

/** Edits against one file. Auto-imports touch a file other than the open one. */
export const FileEdits = Schema.Struct({
  path: Schema.String,
  edits: Schema.Array(TextEdit),
});
export type FileEdits = typeof FileEdits.Type;

export const CompletionItem = Schema.Struct({
  label: Schema.String,
  /** Provider-defined kind (`method`, `function`, `keyword`, …). */
  kind: Schema.String,
  /** Short signature or type, when the provider offers one up front. */
  detail: Schema.String,
  /** Text to insert; equal to the label unless the provider says otherwise. */
  insertText: Schema.String,
  /** Provider ordering key; ties break on label. */
  sortText: Schema.String,
  /**
   * Module an auto-import would come from, empty when the symbol is already in
   * scope. Accepting one of these needs `resolveCompletion` for its edits.
   */
  source: Schema.String,
  /** Opaque handle the provider needs to resolve the item. */
  data: Schema.NullOr(Schema.String),
});
export type CompletionItem = typeof CompletionItem.Type;

export const CompletionResult = Schema.Struct({
  providerId: Schema.NullOr(Schema.String),
  /** The span an accepted item replaces — the identifier being typed. */
  replace: Schema.NullOr(Range),
  items: Schema.Array(CompletionItem),
  /**
   * True when the list was narrowed to the prefix and must be re-requested as
   * it changes, which is LSP's `isIncomplete`.
   */
  incomplete: Schema.Boolean,
});
export type CompletionResult = typeof CompletionResult.Type;

export const CompletionResolution = Schema.Struct({
  detail: Schema.String,
  /** Markdown documentation for the item. */
  documentation: Schema.String,
  /** Edits to apply alongside the insertion — the added import. */
  additionalEdits: Schema.Array(FileEdits),
});
export type CompletionResolution = typeof CompletionResolution.Type;

export const CodeActionItem = Schema.Struct({
  title: Schema.String,
  /** LSP code-action kind, e.g. `quickfix`. */
  kind: Schema.String,
  edits: Schema.Array(FileEdits),
});
export type CodeActionItem = typeof CodeActionItem.Type;

export const CodeActionsResult = Schema.Struct({
  providerId: Schema.NullOr(Schema.String),
  actions: Schema.Array(CodeActionItem),
});
export type CodeActionsResult = typeof CodeActionsResult.Type;

/** Body shared by the position-addressed POSTs, which carry the buffer. */
export const PositionPayload = Schema.Struct({
  path: Schema.String,
  line: Schema.Int,
  character: Schema.Int,
  contents: Schema.optionalKey(Schema.String),
});
export type PositionPayload = typeof PositionPayload.Type;

export const CompletionsPayload = Schema.Struct({
  path: Schema.String,
  line: Schema.Int,
  character: Schema.Int,
  contents: Schema.optionalKey(Schema.String),
  /**
   * The identifier typed so far. Filtering server-side keeps the payload small
   * without hiding matches, which a blind cap over thousands of symbols would.
   */
  prefix: Schema.String,
});
export type CompletionsPayload = typeof CompletionsPayload.Type;

export const CompletionResolvePayload = Schema.Struct({
  path: Schema.String,
  line: Schema.Int,
  character: Schema.Int,
  contents: Schema.optionalKey(Schema.String),
  label: Schema.String,
  source: Schema.String,
  data: Schema.NullOr(Schema.String),
});
export type CompletionResolvePayload = typeof CompletionResolvePayload.Type;

export const CodeActionsPayload = Schema.Struct({
  path: Schema.String,
  start: Position,
  end: Position,
  contents: Schema.optionalKey(Schema.String),
});
export type CodeActionsPayload = typeof CodeActionsPayload.Type;
