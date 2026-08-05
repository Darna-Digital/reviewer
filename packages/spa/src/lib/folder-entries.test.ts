import { describe, expect, it } from "vitest";
import { folderEntries, pathSegments } from "./folder-entries";

const PATHS = [
  "README.md",
  "package.json",
  "src/app.tsx",
  "src/lib/utils.ts",
  "src/lib/nested/deep.ts",
  "src/components/button.tsx",
];

describe("folderEntries", () => {
  it("lists the root's own children, folders before files", () => {
    expect(folderEntries(PATHS, "")).toEqual([
      { name: "src", path: "src", isDirectory: true },
      { name: "package.json", path: "package.json", isDirectory: false },
      { name: "README.md", path: "README.md", isDirectory: false },
    ]);
  });

  it("names a folder's children by their full path", () => {
    expect(folderEntries(PATHS, "src")).toEqual([
      { name: "components", path: "src/components", isDirectory: true },
      { name: "lib", path: "src/lib", isDirectory: true },
      { name: "app.tsx", path: "src/app.tsx", isDirectory: false },
    ]);
  });

  it("does not mistake a prefix for a folder", () => {
    expect(folderEntries(["srcfile.ts", "src/app.tsx"], "src")).toEqual([
      { name: "app.tsx", path: "src/app.tsx", isDirectory: false },
    ]);
  });

  it("is empty for a folder nothing lives in", () => {
    expect(folderEntries(PATHS, "docs")).toEqual([]);
  });
});

describe("pathSegments", () => {
  it("pairs each segment with the folder it sits in", () => {
    expect(pathSegments("src/lib/utils.ts")).toEqual([
      { name: "src", parent: "", path: "src" },
      { name: "lib", parent: "src", path: "src/lib" },
      { name: "utils.ts", parent: "src/lib", path: "src/lib/utils.ts" },
    ]);
  });

  it("reads a root file as one segment", () => {
    expect(pathSegments("README.md")).toEqual([
      { name: "README.md", parent: "", path: "README.md" },
    ]);
  });
});
