import { describe, expect, it } from "vitest";
import {
  worktreeOf,
  heldElsewhere,
  isParallel,
  openableBranches,
  opensExisting,
  targetOf,
  taskBranchName,
} from "./worktrees.functions";
import type { Worktree } from "@byconvo/core/repo";

const worktrees: ReadonlyArray<Worktree> = [
  {
    path: "/work/app",
    name: "app",
    branch: "master",
    isMain: true,
    isCurrent: true,
  },
  {
    path: "/work/.app-worktrees/fix-login",
    name: "fix-login",
    branch: "fix/login",
    isMain: false,
    isCurrent: false,
  },
];

describe("worktreeOf", () => {
  it("finds the worktree a branch is open in", () => {
    expect(worktreeOf(worktrees, "fix/login")?.name).toBe("fix-login");
  });

  it("is null for a branch no worktree holds", () => {
    expect(worktreeOf(worktrees, "spike")).toBeNull();
  });
});

describe("heldElsewhere", () => {
  it("names the worktree to move to rather than check out into", () => {
    expect(heldElsewhere(worktrees, "fix/login")?.path).toBe(
      "/work/.app-worktrees/fix-login"
    );
  });

  it("is null for the branch you are already standing on", () => {
    expect(heldElsewhere(worktrees, "master")).toBeNull();
  });

  it("is null for a branch that is free to be checked out", () => {
    expect(heldElsewhere(worktrees, "spike")).toBeNull();
  });
});

describe("isParallel", () => {
  it("is false while the repository has only its original worktree", () => {
    expect(isParallel(worktrees.slice(0, 1))).toBe(false);
  });

  it("is true once a second task is open", () => {
    expect(isParallel(worktrees)).toBe(true);
  });
});

describe("targetOf", () => {
  const targets = [{ branch: "fix/login", target: "development" }];

  it("reads where a branch's work is aimed", () => {
    expect(targetOf(targets, "fix/login")).toBe("development");
  });

  it("is null for a branch that was never aimed anywhere", () => {
    expect(targetOf(targets, "master")).toBeNull();
  });
});

describe("openableBranches", () => {
  const branches = [
    { name: "master" },
    { name: "fix/login" },
    { name: "spike" },
  ];

  it("leaves out the branches a worktree already holds", () => {
    expect(openableBranches(branches, worktrees).map((b) => b.name)).toEqual([
      "spike",
    ]);
  });

  it("offers everything when nothing is checked out anywhere", () => {
    expect(openableBranches(branches, []).map((b) => b.name)).toEqual([
      "master",
      "fix/login",
      "spike",
    ]);
  });
});

describe("opensExisting", () => {
  it("recognises a name that is already a branch", () => {
    expect(opensExisting([{ name: "spike" }], " spike ")).toBe(true);
  });

  it("treats an unused name as one to cut", () => {
    expect(opensExisting([{ name: "spike" }], "spike-2")).toBe(false);
  });
});

describe("taskBranchName", () => {
  it("names the branch after the opening of the prompt", () => {
    expect(taskBranchName("Add dark mode to the settings pane", [])).toBe(
      "add-dark-mode-to-the-settings"
    );
  });

  it("drops punctuation rather than carrying it into a ref name", () => {
    expect(taskBranchName("Fix the login bug (again!)", [])).toBe(
      "fix-the-login-bug-again"
    );
  });

  it("falls back to a name when the prompt has no words in it", () => {
    expect(taskBranchName("!!! ???", [])).toBe("session");
  });

  it("steps past a branch that already exists", () => {
    expect(taskBranchName("Fix login", ["fix-login"])).toBe("fix-login-2");
    expect(
      taskBranchName("Fix login", ["fix-login", "fix-login-2"])
    ).toBe("fix-login-3");
  });
});
