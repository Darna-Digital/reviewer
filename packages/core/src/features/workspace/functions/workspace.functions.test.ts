import { describe, expect, it } from "vitest";
import {
  folderName,
  mergeRepos,
  parseGitDir,
  parseHeadRef,
  recentRepos,
  repoLocation,
  repoMatches,
} from "./workspace.functions.ts";
import type { RepoEntry } from "../schema/workspace.schema.ts";

const repo = (
  name: string,
  branch: string | null = "main",
  lastOpened: string | null = null
): RepoEntry => ({
  name,
  path: `/work/${name}`,
  branch,
  lastOpened,
});

describe("folderName", () => {
  it("takes the trailing segment", () => {
    expect(folderName("/a/b/web-app")).toBe("web-app");
  });
  it("ignores trailing slashes", () => {
    expect(folderName("/a/b/web-app//")).toBe("web-app");
  });
});

describe("repoLocation", () => {
  it("folds the home folder to ~", () => {
    expect(repoLocation("/home/me/work/app", "/home/me")).toBe("~/work");
  });
  it("is ~ for a repository straight under home", () => {
    expect(repoLocation("/home/me/app", "/home/me")).toBe("~");
  });
  it("leaves a folder outside home as it is", () => {
    expect(repoLocation("/srv/app", "/home/me")).toBe("/srv");
  });
});

describe("repoMatches", () => {
  it("matches on name and on path", () => {
    expect(repoMatches(repo("backend"), "back")).toBe(true);
    expect(repoMatches(repo("backend"), "/work")).toBe(true);
  });
  it("matches everything on an empty query", () => {
    expect(repoMatches(repo("backend"), "  ")).toBe(true);
  });
  it("does not match an unrelated query", () => {
    expect(repoMatches(repo("backend"), "mobile")).toBe(false);
  });
});

describe("recentRepos", () => {
  it("keeps only the opened ones, latest first", () => {
    const recents = recentRepos([
      repo("a", "main", "2026-01-01T00:00:00Z"),
      repo("b"),
      repo("c", "main", "2026-02-01T00:00:00Z"),
    ]);
    expect(recents.map((entry) => entry.name)).toEqual(["c", "a"]);
  });
});

describe("mergeRepos", () => {
  it("stamps scanned repositories with their last open", () => {
    const merged = mergeRepos(
      [repo("backend"), repo("frontend")],
      [{ path: "/work/frontend", openedAt: "2026-03-01T00:00:00Z" }]
    );
    expect(merged.map((entry) => [entry.name, entry.lastOpened])).toEqual([
      ["backend", null],
      ["frontend", "2026-03-01T00:00:00Z"],
    ]);
  });
  it("keeps an opened repository the scan did not reach", () => {
    const merged = mergeRepos(
      [repo("backend")],
      [{ path: "/elsewhere/api", openedAt: "2026-03-01T00:00:00Z" }]
    );
    expect(merged.map((entry) => entry.path)).toEqual([
      "/elsewhere/api",
      "/work/backend",
    ]);
    expect(merged[0]?.name).toBe("api");
    expect(merged[0]?.branch).toBeNull();
  });
  it("orders by name so the list holds still between scans", () => {
    const merged = mergeRepos([repo("zeta"), repo("alpha")], []);
    expect(merged.map((entry) => entry.name)).toEqual(["alpha", "zeta"]);
  });
});

describe("parseHeadRef", () => {
  it("reads the branch out of a symbolic head", () => {
    expect(parseHeadRef("ref: refs/heads/main\n")).toBe("main");
  });
  it("keeps a slashed branch name whole", () => {
    expect(parseHeadRef("ref: refs/heads/feat/multi-repo\n")).toBe(
      "feat/multi-repo"
    );
  });
  it("is null for a detached head", () => {
    expect(parseHeadRef("a9c8fb5c0f2b\n")).toBeNull();
  });
  it("is null for an empty file", () => {
    expect(parseHeadRef("")).toBeNull();
  });
});

describe("parseGitDir", () => {
  it("reads the directory a submodule's .git file points at", () => {
    expect(parseGitDir("gitdir: /work/.git/modules/vendor\n")).toBe(
      "/work/.git/modules/vendor"
    );
  });
  it("is null for anything else", () => {
    expect(parseGitDir("ref: refs/heads/main")).toBeNull();
  });
});
