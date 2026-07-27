import { describe, expect, it } from "vitest"
import { diffFromPullFiles, parsePullFiles } from "./pull-files-diff.ts"

const modified = {
  filename: "src/app.ts",
  status: "modified",
  patch: ["@@ -1,3 +1,3 @@", " context", "-old", "+new"].join("\n"),
}

describe("parsePullFiles", () => {
  it("keeps the fields the diff needs and renames previous_filename", () => {
    expect(
      parsePullFiles([
        { ...modified, previous_filename: "src/old.ts", extra: "ignored" },
      ])
    ).toEqual([
      {
        filename: "src/app.ts",
        status: "modified",
        patch: modified.patch,
        previousFilename: "src/old.ts",
      },
    ])
  })

  it("drops entries without a filename and non-array payloads", () => {
    expect(parsePullFiles([{ status: "modified" }])).toEqual([])
    expect(parsePullFiles({ message: "Not Found" })).toEqual([])
  })

  it("omits patch for files GitHub sends without one", () => {
    const [entry] = parsePullFiles([
      { filename: "logo.png", status: "modified" },
    ])
    expect(entry).toEqual({ filename: "logo.png", status: "modified" })
  })
})

describe("diffFromPullFiles", () => {
  it("wraps a patch in the git headers a diff parser expects", () => {
    expect(diffFromPullFiles(parsePullFiles([modified]))).toBe(
      [
        "diff --git a/src/app.ts b/src/app.ts",
        "--- a/src/app.ts",
        "+++ b/src/app.ts",
        "@@ -1,3 +1,3 @@",
        " context",
        "-old",
        "+new",
        "",
      ].join("\n")
    )
  })

  it("marks added and removed files with /dev/null and a file mode", () => {
    const diff = diffFromPullFiles(
      parsePullFiles([
        { filename: "src/new.ts", status: "added", patch: "@@ -0,0 +1 @@\n+a" },
        {
          filename: "src/gone.ts",
          status: "removed",
          patch: "@@ -1 +0,0 @@\n-a",
        },
      ])
    )
    expect(diff).toContain(
      "new file mode 100644\n--- /dev/null\n+++ b/src/new.ts"
    )
    expect(diff).toContain(
      "deleted file mode 100644\n--- a/src/gone.ts\n+++ /dev/null"
    )
  })

  it("reports a rename with no patch as a pure rename", () => {
    const diff = diffFromPullFiles(
      parsePullFiles([
        {
          filename: "src/b.ts",
          status: "renamed",
          previous_filename: "src/a.ts",
        },
      ])
    )
    expect(diff).toBe(
      [
        "diff --git a/src/a.ts b/src/b.ts",
        "similarity index 100%",
        "rename from src/a.ts",
        "rename to src/b.ts",
        "--- a/src/a.ts",
        "+++ b/src/b.ts",
        "",
      ].join("\n")
    )
  })

  it("reports a rename that also changed content as a changed rename", () => {
    const diff = diffFromPullFiles(
      parsePullFiles([
        {
          filename: "src/b.ts",
          status: "renamed",
          previous_filename: "src/a.ts",
          patch: "@@ -1 +1 @@\n-a\n+b",
        },
      ])
    )
    expect(diff).toContain("similarity index 99%")
    expect(diff).toContain("rename from src/a.ts")
  })

  it("separates consecutive files so each starts its own `diff --git`", () => {
    const diff = diffFromPullFiles(
      parsePullFiles([
        modified,
        {
          filename: "src/two.ts",
          status: "modified",
          patch: "@@ -1 +1 @@\n-a\n+b",
        },
      ])
    )
    expect(diff.split("\n").filter((l) => l.startsWith("diff --git"))).toEqual([
      "diff --git a/src/app.ts b/src/app.ts",
      "diff --git a/src/two.ts b/src/two.ts",
    ])
    expect(diff.endsWith("\n")).toBe(true)
  })

  it("returns an empty diff when there are no files", () => {
    expect(diffFromPullFiles([])).toBe("")
  })
})
