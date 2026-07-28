/**
 * LSP wire values to the language port's shapes.
 *
 * The port was modelled on LSP, so most of this is renaming — the work is in
 * the places LSP is permissive: severities and tags are optional integers,
 * `textDocument/definition` may answer with a `Location`, an array of them, or
 * `LocationLink`s, and everything is addressed by URI rather than path. Each of
 * those is a pure function here so the client stays a transport.
 */
import { fileURLToPath, pathToFileURL } from "node:url"
import type {
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticTag,
  Position,
  Range,
} from "@byconvo/core/language"

const ORIGIN: Position = { line: 0, character: 0 }
const EMPTY_RANGE: Range = { start: ORIGIN, end: ORIGIN }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const index = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : 0

export const toPosition = (raw: unknown): Position =>
  isRecord(raw)
    ? { line: index(raw["line"]), character: index(raw["character"]) }
    : ORIGIN

export const toRange = (raw: unknown): Range =>
  isRecord(raw)
    ? { start: toPosition(raw["start"]), end: toPosition(raw["end"]) }
    : EMPTY_RANGE

/**
 * LSP DiagnosticSeverity: 1 Error, 2 Warning, 3 Information, 4 Hint. The field
 * is optional and the spec leaves the default to the client; like every major
 * editor, an unlabelled diagnostic is treated as an error rather than hidden.
 */
export const severityOfLsp = (raw: unknown): DiagnosticSeverity => {
  switch (raw) {
    case 2:
      return "warning"
    case 3:
      return "information"
    case 4:
      return "hint"
    default:
      return "error"
  }
}

/** LSP DiagnosticTag: 1 Unnecessary, 2 Deprecated. */
export const tagsOfLsp = (raw: unknown): ReadonlyArray<DiagnosticTag> => {
  if (!Array.isArray(raw)) return []
  const tags: Array<DiagnosticTag> = []
  if (raw.includes(1)) tags.push("unnecessary")
  if (raw.includes(2)) tags.push("deprecated")
  return tags
}

/** Absolute path of a `file:` URI, or null for any other scheme. */
export const uriToPath = (uri: unknown): string | null => {
  if (typeof uri !== "string" || !uri.startsWith("file:")) return null
  try {
    return fileURLToPath(uri)
  } catch {
    return null
  }
}

export const pathToUri = (absolute: string): string =>
  pathToFileURL(absolute).toString()

export interface RawLocation {
  readonly uri: string
  readonly range: Range
}

/**
 * Normalise the several shapes `definition`, `declaration` and `references` may
 * answer with: a single `Location`, an array of them, or `LocationLink`s (whose
 * target lives under `targetUri` / `targetSelectionRange`).
 */
export const toLocations = (raw: unknown): ReadonlyArray<RawLocation> => {
  if (raw === null || raw === undefined) return []
  const entries = Array.isArray(raw) ? raw : [raw]
  const out: Array<RawLocation> = []
  for (const entry of entries) {
    if (!isRecord(entry)) continue
    const uri = entry["uri"] ?? entry["targetUri"]
    if (typeof uri !== "string") continue
    // A LocationLink's selection range is the name; its full range is the whole
    // declaration. Navigation wants the name.
    const range =
      entry["targetSelectionRange"] ?? entry["targetRange"] ?? entry["range"]
    out.push({ uri, range: toRange(range) })
  }
  return out
}

/**
 * The `originSelectionRange` of a `LocationLink` response — the span in the
 * *requesting* document the result belongs to. Only servers that support link
 * responses send it; null means the caller should fall back to the token it
 * asked about.
 */
export const originSelectionRange = (raw: unknown): Range | null => {
  const entries = Array.isArray(raw) ? raw : [raw]
  for (const entry of entries) {
    if (!isRecord(entry)) continue
    const origin = entry["originSelectionRange"]
    if (isRecord(origin)) return toRange(origin)
  }
  return null
}

export const toDiagnostic = (
  raw: unknown,
  source: string
): Diagnostic | null => {
  if (!isRecord(raw)) return null
  const message = raw["message"]
  if (typeof message !== "string") return null
  const code = raw["code"]
  return {
    range: toRange(raw["range"]),
    severity: severityOfLsp(raw["severity"]),
    code:
      typeof code === "string" || typeof code === "number"
        ? String(code)
        : null,
    source: typeof raw["source"] === "string" ? raw["source"] : source,
    message,
    tags: tagsOfLsp(raw["tags"]),
    // Related information points at other files; resolving those paths needs
    // the repository root, so the provider fills them in.
    related: [],
  }
}

/**
 * `contents` of a hover response as markdown. LSP allows `MarkupContent`, a
 * `MarkedString` (a bare string or `{ language, value }`), or an array of them.
 */
export const hoverContents = (raw: unknown): string => {
  const render = (value: unknown): string => {
    if (typeof value === "string") return value
    if (!isRecord(value)) return ""
    if (typeof value["value"] === "string") {
      const language = value["language"]
      return typeof language === "string" && language.length > 0
        ? `\`\`\`${language}\n${value["value"]}\n\`\`\``
        : value["value"]
    }
    return ""
  }
  if (Array.isArray(raw))
    return raw
      .map(render)
      .filter((part) => part.trim().length > 0)
      .join("\n\n")
      .trim()
  return render(raw).trim()
}
