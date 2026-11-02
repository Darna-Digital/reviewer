import { parsePatchFiles } from "@pierre/diffs";
import { describe, expect, it } from "vitest";
import {
  locateWorkspaceFile,
  qualifyPatch,
  workspacePatch,
  workspaceRootKeys,
} from "./workspace-diff.functions";

const modified = `diff --git a/src/index.ts b/src/index.ts
index 1111111..2222222 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,2 +1,2 @@
--- a/not-a-header
+const x = 2;
`;

const added = `diff --git a/new file.md b/new file.md
new file mode 100644
--- /dev/null
+++ b/new file.md
@@ -0,0 +1 @@
+hello
`;

const renamed = `diff --git a/old.ts b/new.ts
similarity index 90%
rename from old.ts
rename to new.ts
--- a/old.ts
+++ b/new.ts
@@ -1 +1 @@
-a
+b
`;

const quoted = `diff --git "a/caf\\303\\251.txt" "b/caf\\303\\251.txt"
--- "a/caf\\303\\251.txt"
+++ "b/caf\\303\\251.txt"
@@ -1 +1 @@
-a
+b
`;

const names = (text: string) =>
  parsePatchFiles(text)
    .flatMap((patch) => patch.files)
    .map((file) => [file.prevName ?? null, file.name]);

describe("workspaceRootKeys", () => {
  it("names each root by its folder, numbering the repeats", () => {
    const keys = workspaceRootKeys([
      { path: "/a/web", name: "web" },
      { path: "/b/api", name: "api" },
      { path: "/c/web", name: "web" },
    ]);
    expect([...keys.values()]).toEqual(["web", "api", "web 2"]);
  });
});

describe("qualifyPatch", () => {
  it("puts a changed file under its root's key", () => {
    expect(names(qualifyPatch(modified, "web"))).toEqual([
      [null, "web/src/index.ts"],
    ]);
  });

  it("leaves a hunk's lines alone, however much they look like headers", () => {
    expect(qualifyPatch(modified, "web")).toContain("\n--- a/not-a-header\n");
  });

  it("keeps a new file's /dev/null side, and paths with spaces", () => {
    const text = qualifyPatch(added, "web");
    expect(text).toContain("--- /dev/null");
    expect(names(text)).toEqual([[null, "web/new file.md"]]);
  });

  it("qualifies both ends of a rename", () => {
    expect(names(qualifyPatch(renamed, "api"))).toEqual([
      ["api/old.ts", "api/new.ts"],
    ]);
  });

  it("qualifies a quoted path inside its quotes", () => {
    expect(names(qualifyPatch(quoted, "web"))).toEqual([
      [null, "web/café.txt"],
    ]);
  });
});

describe("workspacePatch", () => {
  it("joins the roots' patches in order, skipping the clean ones", () => {
    const text = workspacePatch([
      { key: "web", text: modified },
      { key: "docs", text: "" },
      { key: "api", text: added.trimEnd() },
    ]);
    expect(names(text).map(([, name]) => name)).toEqual([
      "web/src/index.ts",
      "api/new file.md",
    ]);
  });
});

describe("locateWorkspaceFile", () => {
  const rootsByKey = new Map([
    ["web", "/a/web"],
    ["web 2", "/c/web"],
  ]);

  it("takes a name apart into its repository and path", () => {
    expect(locateWorkspaceFile("web 2/src/a.ts", rootsByKey)).toEqual({
      root: "/c/web",
      path: "src/a.ts",
    });
  });

  it("answers nothing for a name under no root", () => {
    expect(locateWorkspaceFile("other/a.ts", rootsByKey)).toBeNull();
    expect(locateWorkspaceFile("a.ts", rootsByKey)).toBeNull();
  });
});
