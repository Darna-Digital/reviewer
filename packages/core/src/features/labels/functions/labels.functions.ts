import type { AccentColor } from "../../projects/schema/projects.schema.ts"
import { ACCENT_COLORS } from "../../projects/functions/projects.functions.ts"
import type { Label } from "../schema/labels.schema.ts"

/** Collapse whitespace and trim — "  ui /  ux " reads as "ui / ux". */
export const normalizeLabelName = (name: string): string =>
  name.trim().replace(/\s+/g, " ")

/** Two labels clash when their normalized names match, ignoring case. */
export const labelNamesClash = (a: string, b: string): boolean =>
  normalizeLabelName(a).toLowerCase() === normalizeLabelName(b).toLowerCase()

/**
 * A stable colour for a brand-new label: walk the palette in order and take
 * the first one this project has not used yet, wrapping once they run out. New
 * labels look distinct without the user having to pick.
 */
export const nextLabelColor = (existing: ReadonlyArray<Label>): AccentColor => {
  const used = new Set(existing.map((l) => l.color))
  const free = ACCENT_COLORS.find((color) => !used.has(color))
  return free ?? ACCENT_COLORS[existing.length % ACCENT_COLORS.length]
}

export const sortLabels = (
  labels: ReadonlyArray<Label>
): ReadonlyArray<Label> =>
  [...labels].sort((a, b) => a.name.localeCompare(b.name))

/** Resolve a task's label ids against a project's labels, in display order. */
export const labelsForIds = (
  labels: ReadonlyArray<Label>,
  ids: ReadonlyArray<string>
): ReadonlyArray<Label> => {
  const wanted = new Set(ids)
  return sortLabels(labels.filter((label) => wanted.has(label.id)))
}
