import type {
  Diagnostic,
  DiagnosticSeverity,
  Position,
  Range,
} from "@byconvo/core/language"
import type {
  DiagnosticCounts,
  DiagnosticMarker,
  LanguageDependencies,
  LanguageFunctions,
  NavigationOutcome,
  TokenSpan,
} from "../interfaces/language.interfaces"

const SEVERITY_RANK: Record<DiagnosticSeverity, number> = {
  error: 0,
  warning: 1,
  information: 2,
  hint: 3,
}

/**
 * The LSP position a token starts at. The single place one-based editor lines
 * become zero-based protocol lines.
 */
export const positionOfToken = (token: TokenSpan): Position => ({
  line: Math.max(0, token.lineNumber - 1),
  character: Math.max(0, token.lineCharStart),
})

/** The one-based editor line a diagnostic is anchored to. */
export const lineOfDiagnostic = (diagnostic: Diagnostic): number =>
  diagnostic.range.start.line + 1

/**
 * Whether `range` covers any character of `token`.
 *
 * Diagnostics span lines; tokens never do. An empty range — a missing token, an
 * unexpected end of input — is treated as covering the single character it sits
 * on, so it still has something to underline.
 */
export const rangeTouchesToken = (range: Range, token: TokenSpan): boolean => {
  const line = token.lineNumber - 1
  const { start, end } = range
  if (line < start.line || line > end.line) return false

  const empty = start.line === end.line && start.character === end.character
  if (empty) {
    return (
      token.lineCharStart <= start.character &&
      start.character < Math.max(token.lineCharEnd, token.lineCharStart + 1)
    )
  }

  const from = line === start.line ? start.character : 0
  const to = line === end.line ? end.character : Number.POSITIVE_INFINITY
  return token.lineCharStart < to && from < token.lineCharEnd
}

const IDENTIFIER_HEAD = /^[\p{L}_$][\p{L}\p{N}_$]*/u
/**
 * Characters a token may carry ahead of its identifier. Deliberately excludes
 * quotes and digits: an identifier behind one of those is inside a string or a
 * number, where there is no symbol to ask about.
 */
const LEADING_NOISE = /^[\s([{,;:.=<>&|?!+\-*/%~^]+/

/**
 * The identifier a rendered token stands for, positioned in the token's line.
 *
 * A rendered token is not a symbol. The highlighter folds leading whitespace
 * and neighbouring punctuation into one span — `" normalizeDiagnostics"`,
 * `" (normalized."` — so taking the span at face value aims the request at a
 * space or a bracket, and the language server answers about nothing. This
 * narrows the span to the identifier inside it, or rejects the token when it
 * holds none.
 */
export const identifierWithin = (token: TokenSpan): TokenSpan | null => {
  const noise = LEADING_NOISE.exec(token.tokenText)
  const offset = noise === null ? 0 : noise[0].length
  const match = IDENTIFIER_HEAD.exec(token.tokenText.slice(offset))
  if (match === null) return null
  return {
    lineNumber: token.lineNumber,
    lineCharStart: token.lineCharStart + offset,
    lineCharEnd: token.lineCharStart + offset + match[0].length,
    tokenText: match[0],
  }
}

/**
 * Whether a diagnostic should decorate the tokens it covers.
 *
 * A tagged diagnostic spanning several lines is a statement about a *region* —
 * "this whole block is unreachable" — rather than about the tokens inside it.
 * Fading every token in a forty-line block repaints half the file, which reads
 * as the syntax highlighting having broken rather than as a hint, and a single
 * unclosed brace mid-edit is enough to produce one. Such a diagnostic still
 * counts, still annotates its line and still shows on hover; it just leaves the
 * code alone. A tag confined to one line — an unused import, an unread variable
 * — is about those tokens, and still fades them.
 */
export const decoratesTokens = (diagnostic: Diagnostic): boolean =>
  diagnostic.tags.length === 0 ||
  diagnostic.range.start.line === diagnostic.range.end.line

const bySeverity = (a: Diagnostic, b: Diagnostic) =>
  SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]

export const groupDiagnosticsByLine = (
  diagnostics: ReadonlyArray<Diagnostic>
): ReadonlyMap<number, ReadonlyArray<Diagnostic>> => {
  const byLine = new Map<number, Array<Diagnostic>>()
  for (const diagnostic of diagnostics) {
    const line = lineOfDiagnostic(diagnostic)
    const bucket = byLine.get(line)
    if (bucket === undefined) byLine.set(line, [diagnostic])
    else bucket.push(diagnostic)
  }
  for (const bucket of byLine.values()) bucket.sort(bySeverity)
  return byLine
}

/**
 * The marker for a token: the diagnostics covering it, most severe first, with
 * that severity promoted for the underline colour. Tags are unioned so a token
 * that is both unused and deprecated renders as both.
 */
export const markerForToken = (
  diagnostics: ReadonlyArray<Diagnostic>,
  token: TokenSpan
): DiagnosticMarker | null => {
  const touching = diagnostics
    .filter((diagnostic) => rangeTouchesToken(diagnostic.range, token))
    .sort(bySeverity)
  if (touching.length === 0) return null
  const tags = new Set(touching.flatMap((diagnostic) => diagnostic.tags))
  return {
    severity: touching[0].severity,
    tags: [...tags],
    diagnostics: touching,
  }
}

export const countDiagnostics = (
  diagnostics: ReadonlyArray<Diagnostic>
): DiagnosticCounts => {
  const counts = { errors: 0, warnings: 0, infos: 0, hints: 0 }
  for (const { severity } of diagnostics) {
    if (severity === "error") counts.errors += 1
    else if (severity === "warning") counts.warnings += 1
    else if (severity === "information") counts.infos += 1
    else counts.hints += 1
  }
  return counts
}

/**
 * Whether a definition target is the very token that was clicked — the signal
 * that the user is standing on a declaration and wants its usages instead.
 */
export const targetsSameToken = (
  target: { readonly location: { path: string; range: Range } },
  path: string,
  token: TokenSpan
): boolean =>
  target.location.path === path &&
  target.location.range.start.line === token.lineNumber - 1 &&
  target.location.range.start.character === token.lineCharStart

export function createLanguageFunctions(
  d: LanguageDependencies
): LanguageFunctions {
  const diagnosticsByLine: LanguageFunctions["diagnosticsByLine"] = () =>
    groupDiagnosticsByLine(d.data.diagnostics)

  const markerFor: LanguageFunctions["markerFor"] = (token) =>
    markerForToken(d.data.diagnostics, token)

  const counts: LanguageFunctions["counts"] = () =>
    countDiagnostics(d.data.diagnostics)

  const usagesAt = async (
    path: string,
    position: Position,
    fallbackSymbol: string
  ): Promise<NavigationOutcome> => {
    const { symbol, references } = await d.sideEffects.references(
      path,
      position
    )
    return references.length === 0
      ? { kind: "none" }
      : {
          kind: "usages",
          symbol: symbol ?? fallbackSymbol,
          references,
        }
  }

  const navigate: LanguageFunctions["navigate"] = async (path, token) => {
    const position = positionOfToken(token)
    const { targets } = await d.sideEffects.definition(path, position)

    // Standing on the declaration, or on something with no declaration to jump
    // to — either way, usages are the useful answer.
    if (
      targets.length === 0 ||
      (targets.length === 1 && targetsSameToken(targets[0], path, token))
    ) {
      return usagesAt(path, position, token.tokenText)
    }
    if (targets.length === 1) return { kind: "open", target: targets[0] }
    return { kind: "choose", targets }
  }

  const references: LanguageFunctions["references"] = (path, token) =>
    usagesAt(path, positionOfToken(token), token.tokenText)

  const describe: LanguageFunctions["describe"] = (path, token) =>
    d.sideEffects.hover(path, positionOfToken(token))

  return {
    diagnosticsByLine,
    markerFor,
    counts,
    navigate,
    references,
    describe,
  }
}
