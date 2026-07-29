import type { Doc, DocSummary } from "../schema/docs.schema.ts"

export const UNTITLED_DOC = "Untitled"

/**
 * The title a doc shows when the writer never set one: its first markdown
 * heading, else its first non-empty line, truncated. Editing the top of the
 * document renames it, the way a notes app does.
 */
export const titleFromContent = (content: string): string => {
  for (const raw of content.split("\n")) {
    const line = raw.trim()
    if (line.length === 0) continue
    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    const text = (heading?.[1] ?? line).trim()
    if (text.length > 0) return text.slice(0, 120)
  }
  return UNTITLED_DOC
}

/** Trim an explicit title, falling back to the body then to "Untitled". */
export const resolveDocTitle = (
  title: string | undefined,
  content: string
): string => {
  const trimmed = (title ?? "").trim()
  return trimmed.length > 0 ? trimmed : titleFromContent(content)
}

/** The body a brand-new doc opens with — its title, as an H1 to type under. */
export const seedDocContent = (title: string): string => `# ${title}\n\n`

/** Most recently touched first, which is how the sidebar lists them. */
export const sortDocs = <T extends DocSummary>(
  docs: ReadonlyArray<T>
): ReadonlyArray<T> =>
  [...docs].sort(
    (a, b) =>
      b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title)
  )

export const toDocSummary = (doc: Doc): DocSummary => ({
  id: doc.id,
  projectId: doc.projectId,
  title: doc.title,
  updatedAt: doc.updatedAt,
})

/** Case-insensitive match over title and body, for the docs search box. */
export const searchDocs = <T extends DocSummary>(
  docs: ReadonlyArray<T>,
  query: string
): ReadonlyArray<T> => {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return docs
  return docs.filter((doc) => doc.title.toLowerCase().includes(q))
}
