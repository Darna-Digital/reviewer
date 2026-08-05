import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OVERRIDE_ENV, resetTypeScriptCache } from "./ts-module.ts";
import { projectFor, resetProjects } from "./ts-project.ts";

const MARKED_VERSION = "0.0.0-package-local";

const TSCONFIG = JSON.stringify({
  compilerOptions: { strict: true, target: "ES2022", module: "ESNext" },
  include: ["src"],
});

/**
 * The real compiler, installed under `directory` and reporting a version no
 * other install can produce — which is what makes it possible to tell *which*
 * install a project picked up.
 */
const plantMarkedCompiler = (directory: string) => {
  const real = createRequire(import.meta.url).resolve("typescript");
  const packageDir = join(directory, "node_modules", "typescript");
  mkdirSync(packageDir, { recursive: true });
  writeFileSync(
    join(packageDir, "package.json"),
    JSON.stringify({ name: "typescript", version: MARKED_VERSION })
  );
  writeFileSync(
    join(packageDir, "index.js"),
    `const real = require(${JSON.stringify(real)})\n` +
      `module.exports = new Proxy(real, {\n` +
      `  get: (target, key) => (key === "version" ? ${JSON.stringify(MARKED_VERSION)} : target[key]),\n` +
      `})\n`
  );
};

let root: string;
let packageDir: string;

beforeEach(() => {
  // A repository-anchored lookup is the thing under test, so the override that
  // the rest of the suite leans on must not be in play.
  delete process.env[OVERRIDE_ENV];
  resetTypeScriptCache();
  resetProjects();

  root = mkdtempSync(join(tmpdir(), "byconvo-ts-project-"));
  packageDir = join(root, "packages", "app");
  mkdirSync(join(packageDir, "src"), { recursive: true });
  writeFileSync(join(packageDir, "tsconfig.json"), TSCONFIG);
  writeFileSync(join(packageDir, "src", "a.ts"), "export const one = 1\n");
  plantMarkedCompiler(packageDir);
});

afterEach(() => {
  resetTypeScriptCache();
  resetProjects();
  rmSync(root, { recursive: true, force: true });
});

describe("projectFor", () => {
  // The bug this guards against: a pnpm workspace installs `typescript` under
  // each package and nothing at the repository root, so a root-anchored lookup
  // finds no compiler and every file in the repository goes unanalysed. It hid
  // for a release because `tsx` — which runs the dev server, and the tests —
  // answers a bare `require("typescript")` from byconvo's own dependencies no
  // matter which directory it is asked from; only the bundled server on plain
  // node resolves strictly enough to fail.
  it("loads the compiler installed beside the file, not the one at the root", () => {
    const project = projectFor(root, join(packageDir, "src", "a.ts"));

    expect(project).not.toBeNull();
    expect(project!.ts.version).toBe(MARKED_VERSION);
  });

  it("analyses a file whose compiler only exists under its package", () => {
    const file = join(packageDir, "src", "a.ts");
    const project = projectFor(root, file)!;
    project.openFile(file, "export const one: number = 'text'\n");

    const diagnostics = project.service.getSemanticDiagnostics(file);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(2322);
  });
});
