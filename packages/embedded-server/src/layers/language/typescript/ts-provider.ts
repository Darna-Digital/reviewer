/**
 * The built-in TypeScript provider — diagnostics, go-to-definition, find-usages
 * and hover, served straight from the compiler's `LanguageService`.
 *
 * It speaks the same LSP-shaped port as an external language server but skips
 * the subprocess: the compiler runs in this process, so the program stays warm
 * between requests (see `ts-project.ts`) and a hover costs a lookup rather than
 * a round trip. Everything TypeScript-specific stops here — mapping to wire
 * types lives in `ts-mapping.ts`, and the rest of the system only sees the port.
 */
import * as Effect from "effect/Effect"
import type * as TS from "typescript"
import {
  LanguageError,
  type DocumentRequest,
  type LanguageProvider,
  type PositionRequest,
} from "@byconvo/core/ports/language-provider"
import {
  offsetAt,
  type DefinitionResult,
  type Diagnostic,
  type DiagnosticRelated,
  type HoverResult,
  type Range,
  type ReferencesResult,
  type SymbolReference,
  type SymbolTarget,
} from "@byconvo/core/language"
import { loadTypeScript } from "./ts-module.ts"
import { projectFor, type TsProject } from "./ts-project.ts"
import {
  hoverMarkdown,
  referenceKind,
  spanPreview,
  spanToRange,
  toAbsolute,
  toDiagnostic,
  toRepoRelative,
} from "./ts-mapping.ts"

export const TYPESCRIPT_PROVIDER_ID = "typescript"

/** What the compiler analyses. `.d.ts` files match `.ts`. */
const PATTERNS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
] as const

const fail = (reason: string) =>
  new LanguageError({ providerId: TYPESCRIPT_PROVIDER_ID, reason })

const reasonOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

/** Empty results, used when no TypeScript is installed for the repository. */
const unsupported: {
  readonly diagnostics: ReadonlyArray<Diagnostic>
  readonly definition: DefinitionResult
  readonly references: ReferencesResult
  readonly hover: HoverResult
} = {
  diagnostics: [],
  definition: { providerId: null, origin: null, targets: [] },
  references: { providerId: null, origin: null, symbol: null, references: [] },
  hover: { providerId: null, range: null, contents: "" },
}

interface OpenDocument {
  readonly project: TsProject
  readonly ts: TsProject["ts"]
  readonly service: TS.LanguageService
  readonly fileName: string
  readonly text: string
}

/**
 * Attach the request's document to its project. Returns null when the
 * repository has no TypeScript — the caller answers "unsupported", which the
 * UI renders as no analysis rather than as an error.
 */
const open = (request: DocumentRequest): OpenDocument | null => {
  const fileName = toAbsolute(request.root, request.path)
  const project = projectFor(request.root, fileName)
  if (project === null) return null
  project.openFile(fileName, request.contents)
  return {
    project,
    ts: project.ts,
    service: project.service,
    fileName,
    text: project.textOf(fileName) ?? request.contents ?? "",
  }
}

/** Run a compiler call, turning a thrown compiler error into a port failure. */
const attempt = <A>(
  what: string,
  run: () => A
): Effect.Effect<A, LanguageError> =>
  Effect.try({
    try: run,
    catch: (error) => fail(`${what} failed: ${reasonOf(error)}`),
  })

const relatedOf = (
  ts: TsProject["ts"],
  root: string,
  diagnostic: TS.Diagnostic
): ReadonlyArray<DiagnosticRelated> => {
  const out: Array<DiagnosticRelated> = []
  for (const related of diagnostic.relatedInformation ?? []) {
    const file = related.file
    if (file === undefined) continue
    const path = toRepoRelative(root, file.fileName)
    if (path === null) continue
    out.push({
      location: {
        path,
        range: spanToRange(file.text, {
          start: related.start ?? 0,
          length: related.length ?? 0,
        }),
      },
      message: ts.flattenDiagnosticMessageText(related.messageText, " "),
    })
  }
  return out
}

const diagnosticsOf = (
  document: OpenDocument,
  root: string
): ReadonlyArray<Diagnostic> => {
  const { service, fileName, ts, text } = document
  const collected: Array<TS.Diagnostic> = [
    ...service.getSyntacticDiagnostics(fileName),
    ...service.getSemanticDiagnostics(fileName),
    // TypeScript's weak warnings — unused locals, promotable JSDoc types. They
    // arrive as hints so the UI can fade them instead of flagging them.
    ...service.getSuggestionDiagnostics(fileName),
  ]
  return collected.map((diagnostic) =>
    toDiagnostic({
      // A diagnostic without a file (a bad compiler option) is anchored to the
      // start of the document so it still has somewhere to render.
      text: diagnostic.file?.text ?? text,
      start: diagnostic.start ?? 0,
      length: diagnostic.length ?? 0,
      category: diagnostic.category,
      code: diagnostic.code,
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      unnecessary: diagnostic.reportsUnnecessary === true,
      deprecated: diagnostic.reportsDeprecated === true,
      related: relatedOf(ts, root, diagnostic),
    })
  )
}

/** The identifier span a position resolves to, for highlighting the origin. */
const boundSpan = (document: OpenDocument, offset: number): Range | null => {
  const bound = document.service.getDefinitionAndBoundSpan(
    document.fileName,
    offset
  )
  return bound?.textSpan === undefined
    ? null
    : spanToRange(document.text, bound.textSpan)
}

const targetsOf = (
  document: OpenDocument,
  root: string,
  definitions: ReadonlyArray<TS.DefinitionInfo>
): ReadonlyArray<SymbolTarget> => {
  const out: Array<SymbolTarget> = []
  for (const definition of definitions) {
    const path = toRepoRelative(root, definition.fileName)
    if (path === null) continue
    const text = document.project.textOf(definition.fileName) ?? ""
    out.push({
      location: { path, range: spanToRange(text, definition.textSpan) },
      name: definition.name,
      kind: definition.kind,
      containerName: definition.containerName,
      preview: spanPreview(text, definition.textSpan.start),
    })
  }
  return out
}

const referencesOf = (
  document: OpenDocument,
  root: string,
  symbols: ReadonlyArray<TS.ReferencedSymbol>
): ReadonlyArray<SymbolReference> => {
  const out: Array<SymbolReference> = []
  for (const symbol of symbols) {
    for (const entry of symbol.references) {
      const path = toRepoRelative(root, entry.fileName)
      if (path === null) continue
      const text = document.project.textOf(entry.fileName) ?? ""
      out.push({
        location: { path, range: spanToRange(text, entry.textSpan) },
        kind: referenceKind(entry),
        preview: spanPreview(text, entry.textSpan.start),
      })
    }
  }
  return out
}

const positionOffset = (document: OpenDocument, request: PositionRequest) =>
  offsetAt(document.text, request.position)

export const typescriptProvider: LanguageProvider = {
  id: TYPESCRIPT_PROVIDER_ID,
  name: "TypeScript",
  patterns: [...PATTERNS],
  transport: "in-process",
  capabilities: {
    diagnostics: true,
    definition: true,
    references: true,
    hover: true,
  },

  probe: (root) =>
    Effect.sync(() => {
      const { module, detail } = loadTypeScript(root)
      return { available: module !== null, detail }
    }),

  diagnostics: (request) =>
    attempt("typescript diagnostics", () => {
      const document = open(request)
      if (document === null) return unsupported.diagnostics
      return diagnosticsOf(document, request.root)
    }),

  definition: (request) =>
    attempt("typescript definition", () => {
      const document = open(request)
      if (document === null) return unsupported.definition
      const offset = positionOffset(document, request)
      const bound = document.service.getDefinitionAndBoundSpan(
        document.fileName,
        offset
      )
      return {
        providerId: TYPESCRIPT_PROVIDER_ID,
        origin:
          bound?.textSpan === undefined
            ? null
            : spanToRange(document.text, bound.textSpan),
        targets: targetsOf(document, request.root, bound?.definitions ?? []),
      }
    }),

  references: (request) =>
    attempt("typescript references", () => {
      const document = open(request)
      if (document === null) return unsupported.references
      const offset = positionOffset(document, request)
      const origin = boundSpan(document, offset)
      const symbols =
        document.service.findReferences(document.fileName, offset) ?? []
      return {
        providerId: TYPESCRIPT_PROVIDER_ID,
        origin,
        // The token under the cursor reads better than TypeScript's rendered
        // signature ("Usages of greet", not "Usages of function greet(…): …").
        symbol:
          origin === null
            ? null
            : document.text.slice(
                offsetAt(document.text, origin.start),
                offsetAt(document.text, origin.end)
              ),
        references: referencesOf(document, request.root, symbols),
      }
    }),

  hover: (request) =>
    attempt("typescript hover", () => {
      const document = open(request)
      if (document === null) return unsupported.hover
      const offset = positionOffset(document, request)
      const info = document.service.getQuickInfoAtPosition(
        document.fileName,
        offset
      )
      if (info === undefined) return unsupported.hover
      const { ts } = document
      return {
        providerId: TYPESCRIPT_PROVIDER_ID,
        range: spanToRange(document.text, info.textSpan),
        contents: hoverMarkdown({
          signature: ts.displayPartsToString(info.displayParts),
          documentation: ts.displayPartsToString(info.documentation),
          tags: (info.tags ?? []).map((tag) => ({
            name: tag.name,
            text: ts.displayPartsToString(tag.text),
          })),
        }),
      }
    }),
}
