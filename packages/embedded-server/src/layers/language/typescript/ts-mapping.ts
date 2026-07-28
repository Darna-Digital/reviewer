/**
 * Pure translation between the TypeScript compiler's vocabulary and the
 * LSP-shaped one the language port speaks.
 *
 * Nothing here imports `typescript`: the provider extracts primitives from the
 * compiler objects and these functions turn them into wire types. That keeps
 * the fiddly parts — severity mapping, path containment, hover markdown — under
 * unit test without standing up a TypeScript program.
 */
import {
  positionAt,
  previewAt,
  rangeFromSpan,
  type Diagnostic,
  type DiagnosticRelated,
  type DiagnosticSeverity,
  type DiagnosticTag,
  type Range,
  type ReferenceKind,
} from "@byconvo/core/language"

/**
 * `ts.DiagnosticCategory` as numbers, so the mapping needs no runtime import:
 * Warning 0, Error 1, Suggestion 2, Message 3. Suggestions are TypeScript's
 * weak warnings (an unused local when `noUnusedLocals` is off), which LSP calls
 * hints — the UI fades them instead of drawing a squiggle.
 */
export const severityOfCategory = (category: number): DiagnosticSeverity => {
  switch (category) {
    case 1:
      return "error"
    case 0:
      return "warning"
    case 2:
      return "hint"
    default:
      return "information"
  }
}

export interface DiagnosticParts {
  /** Full text of the file the diagnostic belongs to. */
  readonly text: string
  readonly start: number
  readonly length: number
  readonly category: number
  readonly code: number
  readonly message: string
  /** `reportsUnnecessary` — dead code TypeScript wants greyed out. */
  readonly unnecessary: boolean
  readonly deprecated: boolean
  readonly related: ReadonlyArray<DiagnosticRelated>
}

export const toDiagnostic = (parts: DiagnosticParts): Diagnostic => {
  const tags: Array<DiagnosticTag> = []
  if (parts.unnecessary) tags.push("unnecessary")
  if (parts.deprecated) tags.push("deprecated")
  return {
    range: rangeFromSpan(parts.text, parts.start, parts.length),
    severity: severityOfCategory(parts.category),
    code: String(parts.code),
    source: "ts",
    message: parts.message,
    tags,
    related: parts.related,
  }
}

/**
 * How a reference uses its symbol. TypeScript reports the declaration itself as
 * a write, so `isDefinition` is checked first — the UI groups declarations
 * separately from the assignments that follow.
 */
export const referenceKind = (entry: {
  readonly isDefinition?: boolean | undefined
  readonly isWriteAccess?: boolean | undefined
}): ReferenceKind =>
  entry.isDefinition === true
    ? "definition"
    : entry.isWriteAccess === true
      ? "write"
      : "read"

const normalizeSlashes = (path: string) => path.replace(/\\/g, "/")

/**
 * `absolute` expressed relative to `root`, or null when it falls outside.
 *
 * Results outside the repository (a global type package in a shared pnpm store,
 * a linked workspace elsewhere on disk) are dropped rather than surfaced: the
 * UI can only open files the repository's own file API serves, and leaking
 * machine paths into the API would be worse than an occasional missing target.
 */
export const toRepoRelative = (
  root: string,
  absolute: string
): string | null => {
  const normalizedRoot = normalizeSlashes(root).replace(/\/+$/, "")
  const normalizedPath = normalizeSlashes(absolute)
  if (normalizedRoot.length === 0) return null
  if (normalizedPath === normalizedRoot) return null
  return normalizedPath.startsWith(`${normalizedRoot}/`)
    ? normalizedPath.slice(normalizedRoot.length + 1)
    : null
}

/** Absolute POSIX path of a repository-relative one. */
export const toAbsolute = (root: string, relative: string): string =>
  `${normalizeSlashes(root).replace(/\/+$/, "")}/${normalizeSlashes(relative).replace(/^\/+/, "")}`

/** The half-open range of a `{ start, length }` text span. */
export const spanToRange = (
  text: string,
  span: { readonly start: number; readonly length: number }
): Range => rangeFromSpan(text, span.start, span.length)

/** The trimmed source line a span starts on, for result lists. */
export const spanPreview = (text: string, start: number): string =>
  previewAt(text, positionAt(text, start).line)

export interface HoverParts {
  /** The rendered signature, e.g. `function greet(name: string): string`. */
  readonly signature: string
  /** JSDoc body text. */
  readonly documentation: string
  readonly tags: ReadonlyArray<{ readonly name: string; readonly text: string }>
}

/**
 * Hover contents as LSP markdown: the signature in a fenced TypeScript block,
 * then the doc comment, then JSDoc tags. Returns an empty string when there is
 * nothing worth showing, which the provider reports as "no hover".
 */
export const hoverMarkdown = (parts: HoverParts): string => {
  const sections: Array<string> = []
  const signature = parts.signature.trim()
  if (signature.length > 0) sections.push(`\`\`\`ts\n${signature}\n\`\`\``)
  const documentation = parts.documentation.trim()
  if (documentation.length > 0) sections.push(documentation)
  const tags = parts.tags
    .map(({ name, text }) => {
      const body = text.trim()
      return body.length > 0 ? `*@${name}* — ${body}` : `*@${name}*`
    })
    .join("\n\n")
  if (tags.length > 0) sections.push(tags)
  return sections.join("\n\n")
}
