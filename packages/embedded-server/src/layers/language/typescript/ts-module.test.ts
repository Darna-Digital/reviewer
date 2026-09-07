import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadTypeScript, resetTypeScriptCache } from "./ts-module.ts";

const FIXTURE_VERSION = "0.0.0-fixture";

/**
 * A stand-in `typescript` package, recognisable by its version. It exports the
 * members the loader probes for, because a package that resolves but has no
 * compiler API is deliberately rejected — see the last test in this file.
 */
const plantCompiler = (directory: string, api = true) => {
  const packageDir = join(directory, "node_modules", "typescript");
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(
    join(packageDir, "package.json"),
    JSON.stringify({ name: "typescript", version: FIXTURE_VERSION })
  );
  const compilerApi = api
    ? ", createLanguageService: () => {}, findConfigFile: () => {}, sys: {}"
    : "";
  writeFileSync(
    join(packageDir, "index.js"),
    `module.exports = { version: ${JSON.stringify(FIXTURE_VERSION)}${compilerApi} }\n`
  );
};

let workspace: string | null = null;

const makeWorkspace = () => {
  workspace = mkdtempSync(join(tmpdir(), "reviewer-ts-module-"));
  const packageDir = join(workspace, "packages", "app");
  mkdirSync(join(packageDir, "src"), { recursive: true });
  mkdirSync(join(workspace, "packages", "docs"), { recursive: true });
  plantCompiler(packageDir);
  return { root: workspace, packageDir };
};

afterEach(() => {
  resetTypeScriptCache();
  if (workspace !== null) rmSync(workspace, { recursive: true, force: true });
  workspace = null;
});

describe("loadTypeScript", () => {
  // The failure this guards against: a pnpm workspace installs `typescript`
  // under each package and nothing at the top, so anchoring the lookup at the
  // repository root leaves every file in such a repository unanalysed.
  it("finds a compiler installed in the package, not at the repository root", () => {
    const { root, packageDir } = makeWorkspace();

    expect(loadTypeScript(join(packageDir, "src")).module?.version).toBe(
      FIXTURE_VERSION
    );
    expect(loadTypeScript(root).module?.version).not.toBe(FIXTURE_VERSION);
  });

  it("does not share one package's compiler with a sibling", () => {
    const { root } = makeWorkspace();

    expect(
      loadTypeScript(join(root, "packages", "docs")).module?.version
    ).not.toBe(FIXTURE_VERSION);
  });

  it("memoises per directory", () => {
    const { packageDir } = makeWorkspace();

    const first = loadTypeScript(packageDir);
    expect(loadTypeScript(packageDir)).toBe(first);
    resetTypeScriptCache();
    expect(loadTypeScript(packageDir)).not.toBe(first);
  });

  // TypeScript 7 installs under the same name but exports only its version:
  // the in-process compiler API this provider drives is gone. Resolving it and
  // handing it on would crash on the first call, so it is refused here, with a
  // reason the settings screen can show.
  it("refuses a compiler that exposes no in-process API", () => {
    const workspaceDir = mkdtempSync(join(tmpdir(), "reviewer-ts-module-"));
    workspace = workspaceDir;
    const packageDir = join(workspaceDir, "packages", "app");
    mkdirSync(packageDir, { recursive: true });
    plantCompiler(packageDir, false);

    const lookup = loadTypeScript(packageDir);

    expect(lookup.module).toBeNull();
    expect(lookup.detail).toContain("no in-process compiler API");
  });
});
