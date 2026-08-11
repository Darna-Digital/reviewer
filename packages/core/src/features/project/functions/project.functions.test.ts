import { describe, expect, it } from "vitest";
import {
  changedFileCount,
  mergeCommits,
  projectIsOutOfSync,
  projectPath,
  projectTotals,
  reposWithChanges,
  splitProjectPath,
} from "./project.functions.ts";
import type { ProjectChanges, RepoChanges } from "../schema/project.schema.ts";
import type { RepoEntry } from "../../workspace/schema/workspace.schema.ts";

const repo = (name: string): RepoEntry => ({
  name,
  path: `/work/${name}`,
  branch: "main",
});

const changes = (
  name: string,
  files: number,
  status: Partial<RepoChanges["status"]> = {}
): RepoChanges => ({
  repo: repo(name),
  files: Array.from({ length: files }, (_, index) => ({
    path: `src/${index}.ts`,
    status: "modified" as const,
  })),
  status: {
    branch: "main",
    upstream: "origin/main",
    ahead: 0,
    behind: 0,
    headSha: "abc1234",
    changed: files,
    staged: 0,
    unstaged: files,
    untracked: 0,
    conflicted: 0,
    ...status,
  },
});

const project = (repos: ReadonlyArray<RepoChanges>): ProjectChanges => ({
  repos,
  failed: [],
});

describe("projectPath", () => {
  it("prefixes a path with the root it belongs to", () => {
    expect(projectPath(repo("web-app"), "src/app/layout.tsx")).toBe(
      "web-app/src/app/layout.tsx"
    );
  });
});

describe("splitProjectPath", () => {
  const repos = [repo("web-app"), repo("backend-app")];

  it("finds the root that owns a path", () => {
    expect(splitProjectPath(repos, "web-app/src/a.ts")).toEqual({
      repo: repo("web-app"),
      path: "src/a.ts",
    });
  });

  it("resolves the root itself to an empty path", () => {
    expect(splitProjectPath(repos, "web-app")?.path).toBe("");
  });

  it("prefers the deepest matching root", () => {
    const nested = [repo("apps"), repo("apps/web")];
    expect(splitProjectPath(nested, "apps/web/src/a.ts")).toEqual({
      repo: repo("apps/web"),
      path: "src/a.ts",
    });
  });

  it("is null when no root claims the path", () => {
    expect(splitProjectPath(repos, "mobile/src/a.ts")).toBeNull();
  });

  it("does not match a root that is only a name prefix", () => {
    expect(splitProjectPath([repo("web")], "web-app/src/a.ts")).toBeNull();
  });
});

describe("mergeCommits", () => {
  it("interleaves the roots' histories newest first", () => {
    const merged = mergeCommits([
      {
        repo: repo("web-app"),
        commits: [{ authoredAt: "2026-08-06T18:24:00Z" }],
      },
      {
        repo: repo("backend-app"),
        commits: [
          { authoredAt: "2026-08-07T09:00:00Z" },
          { authoredAt: "2026-08-05T12:00:00Z" },
        ],
      },
    ]);
    expect(merged.map((entry) => entry.repo.name)).toEqual([
      "backend-app",
      "web-app",
      "backend-app",
    ]);
  });

  it("keeps the roots' order for commits sharing a timestamp", () => {
    const at = "2026-08-07T09:00:00Z";
    const merged = mergeCommits([
      { repo: repo("web-app"), commits: [{ authoredAt: at }] },
      { repo: repo("backend-app"), commits: [{ authoredAt: at }] },
    ]);
    expect(merged.map((entry) => entry.repo.name)).toEqual([
      "web-app",
      "backend-app",
    ]);
  });

  it("is empty for a project with no history", () => {
    expect(mergeCommits([])).toEqual([]);
  });
});

describe("changedFileCount", () => {
  it("adds up the roots' uncommitted files", () => {
    expect(changedFileCount(project([changes("a", 2), changes("b", 3)]))).toBe(
      5
    );
  });
});

describe("reposWithChanges", () => {
  it("leaves out the roots with a clean tree", () => {
    const only = reposWithChanges(project([changes("a", 0), changes("b", 1)]));
    expect(only.map((entry) => entry.repo.name)).toEqual(["b"]);
  });
});

describe("projectIsOutOfSync", () => {
  it("is true when any root has drifted from its upstream", () => {
    expect(
      projectIsOutOfSync(
        project([changes("a", 0), changes("b", 0, { behind: 2 })])
      )
    ).toBe(true);
  });
  it("is false when every root is level", () => {
    expect(projectIsOutOfSync(project([changes("a", 1)]))).toBe(false);
  });
});

describe("projectTotals", () => {
  it("sums what is outstanding across the roots", () => {
    expect(
      projectTotals(
        project([
          changes("a", 2, { ahead: 1 }),
          changes("b", 1, { behind: 3, conflicted: 1 }),
        ])
      )
    ).toEqual({ changed: 3, ahead: 1, behind: 3, conflicted: 1 });
  });
});
