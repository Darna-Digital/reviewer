import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { locateRepo } from "./language.roots.ts";

let project: string;

const plantRepo = (...segments: Array<string>) => {
  const directory = join(project, ...segments);
  mkdirSync(join(directory, ".git"), { recursive: true });
  return directory;
};

const plantFile = (...segments: Array<string>) => {
  const file = join(project, ...segments);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, "export const one = 1\n");
  return file;
};

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), "byconvo-language-roots-"));
});

afterEach(() => {
  rmSync(project, { recursive: true, force: true });
});

describe("locateRepo", () => {
  // The bug this guards against: file IO resolves paths against the project,
  // so a project holding two repositories names files `web-app/src/a.ts`. The
  // language layer resolved the same name against the selected repository and
  // asked the compiler about `web-app/web-app/src/a.ts`, which fails as
  // "Could not find source file" on every file in every multi-repo project.
  it("names a project-relative file against the repository holding it", () => {
    const web = plantRepo("web-app");
    plantFile("web-app", "src", "a.ts");

    expect(locateRepo(project, web, "web-app/src/a.ts")).toEqual({
      root: web,
      path: "src/a.ts",
      prefix: "web-app",
    });
  });

  // Commits and ranges are read from one root, so git names their files from
  // that root — the same file the tree calls `web-app/src/a.ts` arrives as
  // `src/a.ts` from a commit diff.
  it("reads a path against the selected repository when the project has no such file", () => {
    const web = plantRepo("web-app");
    plantFile("web-app", "src", "a.ts");

    expect(locateRepo(project, web, "src/a.ts")).toEqual({
      root: web,
      path: "src/a.ts",
      prefix: "web-app",
    });
  });

  it("prefers the project spelling when both name a real file", () => {
    const web = plantRepo("web-app");
    plantFile("web-app", "src", "a.ts");
    plantFile("web-app", "web-app", "src", "a.ts");

    const { root, path } = locateRepo(project, web, "web-app/src/a.ts");

    expect(join(root, path)).toBe(join(project, "web-app", "src", "a.ts"));
  });

  it("leaves a monorepo's paths untouched", () => {
    mkdirSync(join(project, ".git"), { recursive: true });
    plantFile("packages", "app", "src", "a.ts");

    expect(locateRepo(project, project, "packages/app/src/a.ts")).toEqual({
      root: project,
      path: "packages/app/src/a.ts",
      prefix: "",
    });
  });

  it("picks the innermost repository when one is nested in another", () => {
    mkdirSync(join(project, ".git"), { recursive: true });
    plantRepo("vendor", "sdk");
    plantFile("vendor", "sdk", "src", "a.ts");

    expect(locateRepo(project, project, "vendor/sdk/src/a.ts")).toEqual({
      root: join(project, "vendor", "sdk"),
      path: "src/a.ts",
      prefix: "vendor/sdk",
    });
  });

  it("follows a worktree, whose .git is a file", () => {
    mkdirSync(join(project, "checkout"), { recursive: true });
    writeFileSync(join(project, "checkout", ".git"), "gitdir: /elsewhere\n");
    plantFile("checkout", "src", "a.ts");

    expect(locateRepo(project, null, "checkout/src/a.ts").root).toBe(
      join(project, "checkout")
    );
  });

  // An unsaved buffer for a file that does not exist yet still has to be
  // analysed, so a path matching nothing on disk is read as project-relative.
  it("falls back to the project spelling for a file that is not on disk", () => {
    const web = plantRepo("web-app");
    mkdirSync(join(web, "src"), { recursive: true });

    expect(locateRepo(project, web, "web-app/src/new.ts")).toEqual({
      root: web,
      path: "src/new.ts",
      prefix: "web-app",
    });
  });

  it("falls back to the project when no repository holds the file", () => {
    plantFile("notes", "a.ts");

    expect(locateRepo(project, null, "notes/a.ts")).toEqual({
      root: project,
      path: "notes/a.ts",
      prefix: "",
    });
  });

  it("refuses to resolve outside the project", () => {
    expect(locateRepo(project, null, "../elsewhere/a.ts")).toEqual({
      root: project,
      path: "../elsewhere/a.ts",
      prefix: "",
    });
  });
});
