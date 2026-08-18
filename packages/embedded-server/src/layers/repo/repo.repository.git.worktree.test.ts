import { describe, expect, it } from "vitest";
import {
  parseWorktrees,
  worktreeName,
  worktreesRoot,
} from "./repo.repository.git.ts";

const listing = [
  ["worktree /work/app", "HEAD abc123", "branch refs/heads/main"].join("\n"),
  ["worktree /work/app-fix", "HEAD def456", "branch refs/heads/fix/login"].join(
    "\n"
  ),
  ["worktree /work/app-spike", "HEAD 789abc", "detached"].join("\n"),
].join("\n\n");

describe("parseWorktrees", () => {
  it("names every checkout by its folder and shortens its branch", () => {
    expect(parseWorktrees(listing, "/work/app-fix")).toEqual([
      {
        path: "/work/app",
        name: "app",
        branch: "main",
        isMain: true,
        isCurrent: false,
      },
      {
        path: "/work/app-fix",
        name: "app-fix",
        branch: "fix/login",
        isMain: false,
        isCurrent: true,
      },
      {
        path: "/work/app-spike",
        name: "app-spike",
        branch: null,
        isMain: false,
        isCurrent: false,
      },
    ]);
  });

  it("drops a bare repository, leaving the first real checkout as the main one", () => {
    const bare = ["worktree /work/app.git", "bare"].join("\n");
    const trees = parseWorktrees(`${bare}\n\n${listing}`, "/work/app");
    expect(trees.map((tree) => tree.path)).toEqual([
      "/work/app",
      "/work/app-fix",
      "/work/app-spike",
    ]);
    expect(trees[0]).toMatchObject({ isMain: true, isCurrent: true });
  });

  it("reads a trailing newline as the end of the last record", () => {
    expect(parseWorktrees(`${listing}\n\n`, "/work/app")).toHaveLength(3);
  });
});

describe("worktreeName", () => {
  it("flattens a branch name so it cannot nest folders", () => {
    expect(worktreeName("fix/login")).toBe("fix-login");
  });

  it("keeps a plain name as it is", () => {
    expect(worktreeName("task-git-worktrees")).toBe("task-git-worktrees");
  });

  it("falls back rather than naming a folder after nothing", () => {
    expect(worktreeName("///")).toBe("work");
  });
});

describe("worktreesRoot", () => {
  it("puts worktrees in a dot-folder beside the repository, where no scan walks", () => {
    expect(worktreesRoot("/work/app")).toBe("/work/.app-worktrees");
  });
});
