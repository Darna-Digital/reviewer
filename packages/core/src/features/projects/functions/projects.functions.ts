import type { AccentColor, Project } from "../schema/projects.schema.ts"

export const ACCENT_COLORS: ReadonlyArray<AccentColor> = [
  "gray",
  "blue",
  "indigo",
  "purple",
  "pink",
  "red",
  "orange",
  "amber",
  "green",
  "teal",
]

const KEY_MAX_LENGTH = 6

/**
 * Coerce whatever the user typed into a task-key prefix: letters and digits
 * only, uppercased, capped at {@link KEY_MAX_LENGTH}. Returns "" when nothing
 * usable survives, which callers treat as "derive one from the name".
 */
export const normalizeProjectKey = (key: string): string =>
  key
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, KEY_MAX_LENGTH)

/**
 * The key we suggest for a project the user only gave a name to. Multi-word
 * names become their initials ("Hans Natur" → "HN"); a single word is
 * truncated ("Byconvo" → "BYC"). Falls back to "PRJ" for an empty name.
 */
export const suggestProjectKey = (name: string): string => {
  const words = name
    .trim()
    .split(/[\s_-]+/)
    .filter((w) => w.length > 0)
  const initials = words
    .map((word) => normalizeProjectKey(word).slice(0, 1))
    .join("")
  const candidate =
    words.length > 1
      ? initials
      : normalizeProjectKey(words[0] ?? "").slice(0, 3)
  return candidate.length > 0 ? candidate : "PRJ"
}

/**
 * Make `key` unique against the keys already taken, by appending a counter
 * ("BYC" → "BYC2"). The truncation keeps the result within the column width.
 */
export const uniqueProjectKey = (
  key: string,
  taken: ReadonlyArray<string>
): string => {
  const upper = taken.map((k) => k.toUpperCase())
  if (!upper.includes(key.toUpperCase())) return key
  for (let n = 2; ; n += 1) {
    const suffix = String(n)
    const candidate = key.slice(0, KEY_MAX_LENGTH - suffix.length) + suffix
    if (!upper.includes(candidate.toUpperCase())) return candidate
  }
}

/** Live projects first, then archived; alphabetical within each half. */
export const sortProjects = (
  projects: ReadonlyArray<Project>
): ReadonlyArray<Project> =>
  [...projects].sort((a, b) => {
    if (a.archived !== b.archived) return a.archived ? 1 : -1
    return a.name.localeCompare(b.name)
  })
