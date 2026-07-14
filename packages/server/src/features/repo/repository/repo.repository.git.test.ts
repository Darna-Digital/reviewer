import { describe, expect, it } from "vitest"
import { splitDiffIntoHunks } from "./repo.repository.git.ts"

const HEADER = [
  "diff --git a/src/app.ts b/src/app.ts",
  "index 1111111..2222222 100644",
  "--- a/src/app.ts",
  "+++ b/src/app.ts",
].join("\n")

describe("splitDiffIntoHunks", () => {
  it("splits a two-hunk file diff into its header and hunks", () => {
    const patch = [
      HEADER,
      "@@ -1,3 +1,3 @@",
      " context",
      "-old one",
      "+new one",
      "@@ -20,2 +20,3 @@ fn foo()",
      " keep",
      "+added",
    ].join("\n")

    const { header, hunks } = splitDiffIntoHunks(patch)

    expect(header).toBe(HEADER)
    expect(hunks).toHaveLength(2)
    expect(hunks[0]).toBe(
      ["@@ -1,3 +1,3 @@", " context", "-old one", "+new one"].join("\n")
    )
    expect(hunks[1]).toBe(
      ["@@ -20,2 +20,3 @@ fn foo()", " keep", "+added"].join("\n")
    )
  })

  it("keeps body lines that merely contain @@ with their hunk", () => {
    const patch = [
      HEADER,
      "@@ -1,2 +1,2 @@",
      " untouched",
      "+const banner = '@@ not a header'",
    ].join("\n")

    const { hunks } = splitDiffIntoHunks(patch)

    expect(hunks).toHaveLength(1)
    expect(hunks[0]).toContain("@@ not a header")
  })

  it("returns no hunks for a diff without any (e.g. binary files)", () => {
    const patch = [
      "diff --git a/logo.png b/logo.png",
      "Binary files a/logo.png and b/logo.png differ",
    ].join("\n")

    const { header, hunks } = splitDiffIntoHunks(patch)

    expect(header).toBe(patch)
    expect(hunks).toEqual([])
  })
})
