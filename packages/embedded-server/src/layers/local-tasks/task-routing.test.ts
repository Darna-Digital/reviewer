import { describe, expect, it } from "vitest";
import { baseOf, mergeRoute, taskWorktrees } from "./task-routing.ts";
import type { Worktree } from "@byconvo/core/repo";

const worktree = (
  name: string,
  branch: string | null,
  isMain = false
): Worktree => ({
  path: `/work/${name}`,
  name,
  branch,
  isMain,
  isCurrent: false,
});

const MAIN = worktree("app", "development", true);
const TASK = worktree("fix-login", "fix/login");

describe("baseOf", () => {
  it("uses the aim recorded when the task was opened", () => {
    expect(
      baseOf(
        [{ branch: "fix/login", target: "staging" }],
        "fix/login",
        "development"
      )
    ).toBe("staging");
  });

  it("falls back to what the original checkout is on, which is what ‘merge it back’ means", () => {
    expect(baseOf([], "fix/login", "development")).toBe("development");
  });

  it("refuses to aim a branch at itself", () => {
    expect(baseOf([], "development", "development")).toBeNull();
  });

  it("has no answer when nothing was recorded and the main checkout is detached", () => {
    expect(baseOf([], "fix/login", null)).toBeNull();
  });
});

describe("taskWorktrees", () => {
  it("is every checkout but the original", () => {
    expect(taskWorktrees([MAIN, TASK]).map((entry) => entry.branch)).toEqual([
      "fix/login",
    ]);
  });

  it("skips a detached checkout, which is nobody's task", () => {
    expect(taskWorktrees([MAIN, worktree("spike", null)])).toEqual([]);
  });
});

describe("mergeRoute", () => {
  // Verified against git: it refuses `fetch . branch:base` while any worktree
  // holds the base, so the merge has to happen in that worktree instead.
  it("merges in the worktree holding the base, since git will not move a branch out from under one", () => {
    expect(
      mergeRoute({ base: "development", upToDate: true }, [MAIN, TASK])
    ).toEqual({ kind: "in-worktree", path: "/work/app" });
  });

  // The property that lets a merge happen without the app going anywhere.
  it("moves the ref alone when nobody is standing on the base", () => {
    expect(
      mergeRoute({ base: "release", upToDate: true }, [MAIN, TASK])
    ).toEqual({ kind: "ref-only" });
  });

  it("asks for an update first when the base is not yet an ancestor", () => {
    expect(
      mergeRoute({ base: "development", upToDate: false }, [MAIN, TASK])
    ).toEqual({ kind: "behind", base: "development" });
  });

  it("reports being behind before anything else, since neither merge is possible yet", () => {
    expect(
      mergeRoute({ base: "release", upToDate: false }, [MAIN, TASK])
    ).toMatchObject({ kind: "behind" });
  });
});
