import { describe, expect, it } from "vitest";
import {
  activeRepo,
  branchesDiverged,
  chooseRepo,
  commonBranch,
  folderHint,
  folderName,
  isMultiRepo,
  isOpenable,
  parseGitDir,
  parseHeadRef,
  repoMatches,
  repoName,
} from "./workspace.functions.ts";
import type { RepoEntry } from "../schema/workspace.schema.ts";

const repo = (name: string, branch: string | null = "main"): RepoEntry => ({
  name,
  path: `/work/${name}`,
  branch,
});

describe("folderName", () => {
  it("takes the trailing segment", () => {
    expect(folderName("/a/b/web-app")).toBe("web-app");
  });
  it("ignores trailing slashes", () => {
    expect(folderName("/a/b/web-app//")).toBe("web-app");
  });
});

describe("repoName", () => {
  it("names a nested root by its project-relative path", () => {
    expect(repoName("/work", "/work/apps/web")).toBe("apps/web");
  });
  it("names a project that is itself a repository after its folder", () => {
    expect(repoName("/work/backend", "/work/backend")).toBe("backend");
  });
  it("falls back to the folder name for a root outside the project", () => {
    expect(repoName("/work", "/elsewhere/api")).toBe("api");
  });
  it("tolerates a trailing slash on the project", () => {
    expect(repoName("/work/", "/work/backend")).toBe("backend");
  });
});

describe("chooseRepo", () => {
  it("keeps the remembered root when the project still holds it", () => {
    expect(
      chooseRepo([repo("backend"), repo("frontend")], "/work/frontend")
    ).toBe("/work/frontend");
  });
  it("falls back to the first root when the remembered one is gone", () => {
    expect(chooseRepo([repo("backend"), repo("frontend")], "/work/gone")).toBe(
      "/work/backend"
    );
  });
  it("is null for a project holding no repository", () => {
    expect(chooseRepo([], "/work/backend")).toBeNull();
  });
});

describe("activeRepo", () => {
  it("resolves the entry current points at", () => {
    const repos = [repo("backend"), repo("frontend")];
    expect(activeRepo({ repos, current: "/work/frontend" })?.name).toBe(
      "frontend"
    );
  });
  it("is null when current names no held root", () => {
    expect(activeRepo({ repos: [repo("backend")], current: null })).toBeNull();
  });
});

describe("isMultiRepo", () => {
  it("is true only past one root", () => {
    expect(isMultiRepo({ repos: [repo("backend")] })).toBe(false);
    expect(isMultiRepo({ repos: [repo("backend"), repo("frontend")] })).toBe(
      true
    );
  });
});

describe("branchesDiverged", () => {
  it("is false when every root is on the same branch", () => {
    expect(branchesDiverged([repo("backend"), repo("frontend")])).toBe(false);
  });
  it("is true when the roots sit on different branches", () => {
    expect(branchesDiverged([repo("backend"), repo("frontend", "next")])).toBe(
      true
    );
  });
  it("ignores detached heads rather than counting them as a difference", () => {
    expect(branchesDiverged([repo("backend"), repo("frontend", null)])).toBe(
      false
    );
  });
});

describe("commonBranch", () => {
  it("is the branch every root shares", () => {
    expect(commonBranch([repo("backend"), repo("frontend")])).toBe("main");
  });
  it("is null when the roots differ", () => {
    expect(
      commonBranch([repo("backend"), repo("frontend", "next")])
    ).toBeNull();
  });
  it("is null when a root's head is unreadable", () => {
    expect(commonBranch([repo("backend"), repo("frontend", null)])).toBeNull();
  });
  it("is null without any root", () => {
    expect(commonBranch([])).toBeNull();
  });
});

describe("isOpenable", () => {
  it("opens a repository", () => {
    expect(isOpenable({ isGitRepo: true, repoCount: 1 })).toBe(true);
  });
  it("opens a folder holding repositories", () => {
    expect(isOpenable({ isGitRepo: false, repoCount: 2 })).toBe(true);
  });
  it("leaves a plain folder closed", () => {
    expect(isOpenable({ isGitRepo: false, repoCount: 0 })).toBe(false);
  });
});

describe("folderHint", () => {
  it("names a repository", () => {
    expect(folderHint({ isGitRepo: true, repoCount: 1 })).toBe("Repository");
  });
  it("counts the repositories a folder holds", () => {
    expect(folderHint({ isGitRepo: false, repoCount: 2 })).toBe(
      "2 repositories"
    );
    expect(folderHint({ isGitRepo: false, repoCount: 1 })).toBe("1 repository");
  });
  it("says nothing about a plain folder", () => {
    expect(folderHint({ isGitRepo: false, repoCount: 0 })).toBeNull();
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
