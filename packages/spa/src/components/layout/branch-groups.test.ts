import { describe, expect, it } from "vitest";
import { groupBranchesByFolder, splitBranchFolder } from "./branch-groups";

describe("branch groups", () => {
  it("keeps a flat branch flat and splits only its first folder", () => {
    expect(splitBranchFolder("main")).toEqual([null, "main"]);
    expect(splitBranchFolder("task/BMB-207/notes")).toEqual([
      "task",
      "BMB-207/notes",
    ]);
  });

  it("groups in source order without reordering branches", () => {
    const rows = ["main", "task/one", "fix/two", "task/three"];
    expect(groupBranchesByFolder(rows, (row) => row)).toEqual([
      { folder: null, items: ["main"] },
      { folder: "task", items: ["task/one", "task/three"] },
      { folder: "fix", items: ["fix/two"] },
    ]);
  });
});
