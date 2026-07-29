/**
 * Turns one `.byconvo/languages.json` entry into a language provider.
 *
 * This is what makes the feature pluggable: the port, the API and the whole UI
 * are language-agnostic, so a new language costs a few lines of configuration
 * and whatever language server already exists for it.
 */
import { readFileSync } from "node:fs"
import * as Effect from "effect/Effect"
import {
  LanguageError,
  type DocumentRequest,
  type LanguageProvider,
  type PositionRequest,
} from "@byconvo/core/ports/language-provider"
import {
  filterCompletions,
  offsetAt,
  previewAt,
  type CodeActionItem,
  type CompletionResolution,
  type CompletionResult,
  type DefinitionResult,
  type Diagnostic,
  type HoverResult,
  type FileEdits,
  type Location,
  type ReferencesResult,
  type SymbolReference,
  type SymbolTarget,
} from "@byconvo/core/language"
import { toAbsolute, toRepoRelative } from "../typescript/ts-mapping.ts"
import {
  connectionFor,
  PUBLISH_TIMEOUT_MS,
  type LspConnection,
} from "./lsp-client.ts"
import type { LspServerConfig } from "./lsp-config.ts"
import { findExecutable } from "./lsp-executable.ts"
import {
  hoverContents,
  originSelectionRange,
  toCompletionItems,
  toDiagnostic,
  toFileEdits,
  toLocations,
  toRange,
  uriToPath,
} from "./lsp-mapping.ts"

/** Provider ids are namespaced so a configured server cannot shadow a built-in. */
export const providerIdFor = (config: LspServerConfig) => `lsp:${config.id}`

const EMPTY_DEFINITION: DefinitionResult = {
  providerId: null,
  origin: null,
  targets: [],
}
const EMPTY_REFERENCES: ReferencesResult = {
  providerId: null,
  origin: null,
  symbol: null,
  references: [],
}
const EMPTY_HOVER: HoverResult = { providerId: null, range: null, contents: "" }
const EMPTY_COMPLETIONS: CompletionResult = {
  providerId: null,
  replace: null,
  items: [],
  incomplete: false,
}
const EMPTY_RESOLUTION: CompletionResolution = {
  detail: "",
  documentation: "",
  additionalEdits: [],
}

/** Whether a published diagnostic touches the range a fix was asked for. */
const overlapsRange = (
  diagnostic: unknown,
  range: { start: { line: number }; end: { line: number } }
): boolean => {
  if (typeof diagnostic !== "object" || diagnostic === null) return false
  const parsed = toRange((diagnostic as { range?: unknown }).range)
  return (
    parsed.start.line <= range.end.line && parsed.end.line >= range.start.line
  )
}

/** Reads target files for previews; one cache per request keeps it cheap. */
const makeTextReader = () => {
  const cache = new Map<string, string>()
  return (absolute: string): string => {
    const cached = cache.get(absolute)
    if (cached !== undefined) return cached
    let text = ""
    try {
      text = readFileSync(absolute, "utf8")
    } catch {
      text = ""
    }
    cache.set(absolute, text)
    return text
  }
}

const documentText = (
  request: DocumentRequest,
  absolute: string
): string | null => {
  if (request.contents !== null) return request.contents
  try {
    return readFileSync(absolute, "utf8")
  } catch {
    return null
  }
}

/** Whether the server answers `textDocument/diagnostic` (LSP 3.17 pull mode). */
const hasPullDiagnostics = (capabilities: Record<string, unknown>) =>
  capabilities["diagnosticProvider"] !== undefined

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const locationKey = (location: Location) =>
  `${location.path}:${location.range.start.line}:${location.range.start.character}`

export const makeLspProvider = (config: LspServerConfig): LanguageProvider => {
  const providerId = providerIdFor(config)

  const fail = (reason: string) => new LanguageError({ providerId, reason })

  const attempt = <A>(
    what: string,
    run: () => Promise<A>
  ): Effect.Effect<A, LanguageError> =>
    Effect.tryPromise({
      try: run,
      catch: (error) =>
        fail(
          `${what} failed: ${error instanceof Error ? error.message : String(error)}`
        ),
    })

  /**
   * The connection and the synced document, or null when there is nothing to
   * talk to. A missing binary is reported by `probe` and by the providers
   * endpoint, so the per-file operations stay quiet rather than failing on
   * every keystroke.
   */
  const openDocument = async (request: DocumentRequest) => {
    if (findExecutable(config.command) === null) return null
    const absolute = toAbsolute(request.root, request.path)
    const text = documentText(request, absolute)
    if (text === null) return null
    const connection = await connectionFor(config, request.root)
    const { uri, changed } = connection.syncDocument(absolute, text)
    return { connection, absolute, text, uri, changed }
  }

  const toLocation = (
    root: string,
    raw: { uri: string; range: ReturnType<typeof toRange> }
  ): { location: Location; absolute: string } | null => {
    const absolute = uriToPath(raw.uri)
    if (absolute === null) return null
    const path = toRepoRelative(root, absolute)
    if (path === null) return null
    return { location: { path, range: raw.range }, absolute }
  }

  const definitionLocations = async (
    connection: LspConnection,
    uri: string,
    position: PositionRequest["position"]
  ) =>
    connection.request("textDocument/definition", {
      textDocument: { uri },
      position,
    })

  return {
    id: providerId,
    name: config.name,
    patterns: config.patterns,
    transport: "lsp-stdio",
    capabilities: {
      diagnostics: true,
      definition: true,
      references: true,
      hover: true,
      completions: true,
      codeActions: true,
    },

    probe: () =>
      Effect.sync(() => {
        const executable = findExecutable(config.command)
        return executable === null
          ? {
              available: false,
              detail: `"${config.command}" was not found on PATH`,
            }
          : { available: true, detail: executable }
      }),

    diagnostics: (request) =>
      attempt(
        `${providerId} diagnostics`,
        async (): Promise<ReadonlyArray<Diagnostic>> => {
          const open = await openDocument(request)
          if (open === null) return []
          const { connection, uri, changed } = open

          let items: ReadonlyArray<unknown>
          if (hasPullDiagnostics(connection.capabilities)) {
            const result = await connection.request("textDocument/diagnostic", {
              textDocument: { uri },
            })
            items =
              isRecord(result) && Array.isArray(result["items"])
                ? result["items"]
                : []
          } else if (changed) {
            // Push-only server: the reopen above triggers a fresh publish.
            items = await connection.awaitDiagnostics(uri, PUBLISH_TIMEOUT_MS)
          } else {
            // Nothing changed, so nothing new will be published.
            items = connection.diagnosticsFor(uri)
          }

          const out: Array<Diagnostic> = []
          for (const raw of items) {
            const diagnostic = toDiagnostic(raw, config.id)
            if (diagnostic !== null) out.push(diagnostic)
          }
          return out
        }
      ),

    definition: (request) =>
      attempt(
        `${providerId} definition`,
        async (): Promise<DefinitionResult> => {
          const open = await openDocument(request)
          if (open === null) return EMPTY_DEFINITION
          const { connection, uri } = open
          const result = await definitionLocations(
            connection,
            uri,
            request.position
          )
          const readText = makeTextReader()
          const targets: Array<SymbolTarget> = []
          for (const raw of toLocations(result)) {
            const resolved = toLocation(request.root, raw)
            if (resolved === null) continue
            const text = readText(resolved.absolute)
            targets.push({
              location: resolved.location,
              // LSP location responses carry no symbol metadata; the source line
              // is what a picker can show, and the UI already knows the name it
              // asked about.
              name: "",
              kind: "",
              containerName: "",
              preview: previewAt(text, resolved.location.range.start.line),
            })
          }
          return {
            providerId,
            origin: originSelectionRange(result),
            targets,
          }
        }
      ),

    references: (request) =>
      attempt(
        `${providerId} references`,
        async (): Promise<ReferencesResult> => {
          const open = await openDocument(request)
          if (open === null) return EMPTY_REFERENCES
          const { connection, uri, text } = open
          // LSP's reference response says nothing about reads versus writes, but
          // the declarations are exactly what `definition` returns — asked for in
          // parallel, so labelling them costs no extra latency.
          const [rawReferences, rawDefinitions] = await Promise.all([
            connection.request("textDocument/references", {
              textDocument: { uri },
              position: request.position,
              context: { includeDeclaration: true },
            }),
            definitionLocations(connection, uri, request.position),
          ])

          const declarations = new Set<string>()
          for (const raw of toLocations(rawDefinitions)) {
            const resolved = toLocation(request.root, raw)
            if (resolved !== null)
              declarations.add(locationKey(resolved.location))
          }

          const readText = makeTextReader()
          const references: Array<SymbolReference> = []
          for (const raw of toLocations(rawReferences)) {
            const resolved = toLocation(request.root, raw)
            if (resolved === null) continue
            references.push({
              location: resolved.location,
              kind: declarations.has(locationKey(resolved.location))
                ? "definition"
                : "read",
              preview: previewAt(
                readText(resolved.absolute),
                resolved.location.range.start.line
              ),
            })
          }

          const origin = originSelectionRange(rawDefinitions)
          const symbol =
            origin === null
              ? null
              : text.slice(
                  offsetAt(text, origin.start),
                  offsetAt(text, origin.end)
                )
          return {
            providerId,
            origin,
            symbol: symbol !== null && symbol.length > 0 ? symbol : null,
            references,
          }
        }
      ),

    hover: (request) =>
      attempt(`${providerId} hover`, async (): Promise<HoverResult> => {
        const open = await openDocument(request)
        if (open === null) return EMPTY_HOVER
        const result = await open.connection.request("textDocument/hover", {
          textDocument: { uri: open.uri },
          position: request.position,
        })
        if (!isRecord(result)) return EMPTY_HOVER
        return {
          providerId,
          range:
            result["range"] === undefined ? null : toRange(result["range"]),
          contents: hoverContents(result["contents"]),
        }
      }),

    completions: (request) =>
      attempt(
        `${providerId} completions`,
        async (): Promise<CompletionResult> => {
          const open = await openDocument(request)
          if (open === null) return EMPTY_COMPLETIONS
          const result = await open.connection.request(
            "textDocument/completion",
            { textDocument: { uri: open.uri }, position: request.position }
          )
          // A server answers with a bare list or a `CompletionList` wrapper.
          const raw = isRecord(result) ? result["items"] : result
          return {
            providerId,
            replace: {
              start: {
                line: request.position.line,
                character: Math.max(
                  0,
                  request.position.character - request.prefix.length
                ),
              },
              end: request.position,
            },
            items: filterCompletions(toCompletionItems(raw), request.prefix),
            incomplete: true,
          }
        }
      ),

    resolveCompletion: (request) =>
      attempt(
        `${providerId} completion detail`,
        async (): Promise<CompletionResolution> => {
          const open = await openDocument(request)
          if (open === null) return EMPTY_RESOLUTION
          // The server round-trips its own item, so `data` goes back as it came.
          const result = await open.connection.request(
            "completionItem/resolve",
            {
              label: request.label,
              ...(request.data === null
                ? {}
                : { data: JSON.parse(request.data) as unknown }),
            }
          )
          if (!isRecord(result)) return EMPTY_RESOLUTION
          const detail = result["detail"]
          return {
            detail: typeof detail === "string" ? detail : "",
            documentation: hoverContents(result["documentation"]),
            additionalEdits: toFileEdits(
              request.root,
              open.uri,
              result["additionalTextEdits"]
            ),
          }
        }
      ),

    codeActions: (request) =>
      attempt(
        `${providerId} code actions`,
        async (): Promise<ReadonlyArray<CodeActionItem>> => {
          const open = await openDocument(request)
          if (open === null) return []
          const result = await open.connection.request(
            "textDocument/codeAction",
            {
              textDocument: { uri: open.uri },
              range: request.range,
              // Servers key their fixes off the diagnostics in range, exactly
              // as the TypeScript provider does off error codes.
              context: {
                diagnostics: open.connection
                  .diagnosticsFor(open.uri)
                  .filter((entry) => overlapsRange(entry, request.range)),
              },
            }
          )
          const actions: Array<CodeActionItem> = []
          for (const entry of Array.isArray(result) ? result : []) {
            if (!isRecord(entry)) continue
            const title = entry["title"]
            if (typeof title !== "string") continue
            const edit = entry["edit"]
            const changes = isRecord(edit) ? edit["changes"] : undefined
            const edits: Array<FileEdits> = []
            if (isRecord(changes)) {
              for (const [uri, list] of Object.entries(changes)) {
                edits.push(...toFileEdits(request.root, uri, list))
              }
            }
            const kind = entry["kind"]
            actions.push({
              title,
              kind: typeof kind === "string" ? kind : "quickfix",
              edits,
            })
          }
          return actions
        }
      ),
  }
}
