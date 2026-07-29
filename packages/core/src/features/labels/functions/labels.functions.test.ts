import { describe, expect, it } from "vitest"
import {
  labelNamesClash,
  labelsForIds,
  nextLabelColor,
  normalizeLabelName,
  sortLabels,
} from "./labels.functions.ts"
import type { Label } from "../schema/labels.schema.ts"

const label = (over: Partial<Label>): Label => ({
  id: "l1",
  projectId: "p1",
  name: "ui/ux",
  color: "gray",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
})

describe("normalizeLabelName", () => {
  it("trims and collapses internal whitespace", () => {
    expect(normalizeLabelName("  ui  /   ux ")).toBe("ui / ux")
  })
})

describe("labelNamesClash", () => {
  it("compares normalized names case-insensitively", () => {
    expect(labelNamesClash("UI/UX", " ui/ux ")).toBe(true)
    expect(labelNamesClash("bug", "bugs")).toBe(false)
  })
})

describe("nextLabelColor", () => {
  it("takes the first unused palette entry", () => {
    expect(nextLabelColor([])).toBe("gray")
    expect(nextLabelColor([label({ color: "gray" })])).toBe("blue")
  })

  it("wraps around once every colour is in use", () => {
    const used = (
      [
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
      ] as const
    ).map((color, i) => label({ id: `l${i}`, color }))
    expect(nextLabelColor(used)).toBe("gray")
  })
})

describe("sortLabels", () => {
  it("orders alphabetically", () => {
    const sorted = sortLabels([
      label({ id: "b", name: "bug" }),
      label({ id: "a", name: "api" }),
    ])
    expect(sorted.map((l) => l.id)).toEqual(["a", "b"])
  })
})

describe("labelsForIds", () => {
  it("keeps only the requested labels, in display order", () => {
    const all = [
      label({ id: "b", name: "bug" }),
      label({ id: "a", name: "api" }),
      label({ id: "c", name: "chore" }),
    ]
    expect(labelsForIds(all, ["c", "a"]).map((l) => l.id)).toEqual(["a", "c"])
  })

  it("ignores ids with no matching label", () => {
    expect(labelsForIds([label({ id: "a" })], ["zz"])).toEqual([])
  })
})
