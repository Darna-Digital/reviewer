/**
 * Normalisation applied to every provider's answers before they reach the API.
 *
 * Providers differ in how they order and duplicate results — the TypeScript
 * service reports a symbol's declaration twice when it is both a definition and
 * a write, and LSP servers order references by whatever they searched first.
 * Normalising here means the UI can render results in arrival order and every
 * provider gets the same guarantees for free.
 */
import type {
  Diagnostic,
  DiagnosticSeverity,
  Location,
  Position,
  SymbolReference,
  SymbolTarget,
} from "../schema/language.schema.ts"

/** Payload caps. A generated file can produce thousands of diagnostics. */
export const MAX_DIAGNOSTICS = 500
export const MAX_REFERENCES = 1000

const SEVERITY_RANK: Record<DiagnosticSeverity, number> = {
  error: 0,
  warning: 1,
  information: 2,
  hint: 3,
}

/** Sort order: errors before warnings, as in a problems list. */
export const severityRank = (severity: DiagnosticSeverity): number =>
  SEVERITY_RANK[severity]

export const comparePositions = (a: Position, b: Position): number =>
  a.line - b.line || a.character - b.character

const compareLocations = (a: Location, b: Location): number =>
  a.path.localeCompare(b.path) ||
  comparePositions(a.range.start, b.range.start) ||
  comparePositions(a.range.end, b.range.end)

const locationKey = (location: Location): string =>
  `${location.path}:${location.range.start.line}:${location.range.start.character}:${location.range.end.line}:${location.range.end.character}`

/**
 * Document order, with the most severe diagnostic first when several share a
 * position — that is the one the gutter icon and the squiggle colour show.
 */
export const normalizeDiagnostics = (
  diagnostics: ReadonlyArray<Diagnostic>
): ReadonlyArray<Diagnostic> => {
  const seen = new Set<string>()
  const unique: Array<Diagnostic> = []
  for (const diagnostic of diagnostics) {
    const key = `${locationKey({ path: "", range: diagnostic.range })}|${diagnostic.source}|${diagnostic.code ?? ""}|${diagnostic.message}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(diagnostic)
  }
  return unique
    .sort(
      (a, b) =>
        comparePositions(a.range.start, b.range.start) ||
        severityRank(a.severity) - severityRank(b.severity) ||
        a.message.localeCompare(b.message)
    )
    .slice(0, MAX_DIAGNOSTICS)
}

/**
 * References in document order, deduplicated by location. When the same span is
 * reported twice the more specific kind wins, so a declaration that is also a
 * write stays labelled `definition`.
 */
export const normalizeReferences = (
  references: ReadonlyArray<SymbolReference>
): ReadonlyArray<SymbolReference> => {
  const KIND_RANK = { definition: 0, write: 1, read: 2 } as const
  const byLocation = new Map<string, SymbolReference>()
  for (const reference of references) {
    const key = locationKey(reference.location)
    const existing = byLocation.get(key)
    if (
      existing === undefined ||
      KIND_RANK[reference.kind] < KIND_RANK[existing.kind]
    ) {
      byLocation.set(key, reference)
    }
  }
  return [...byLocation.values()]
    .sort((a, b) => compareLocations(a.location, b.location))
    .slice(0, MAX_REFERENCES)
}

/** Definition targets, deduplicated by location, in document order. */
export const normalizeTargets = (
  targets: ReadonlyArray<SymbolTarget>
): ReadonlyArray<SymbolTarget> => {
  const byLocation = new Map<string, SymbolTarget>()
  for (const target of targets) {
    const key = locationKey(target.location)
    if (!byLocation.has(key)) byLocation.set(key, target)
  }
  return [...byLocation.values()].sort((a, b) =>
    compareLocations(a.location, b.location)
  )
}
