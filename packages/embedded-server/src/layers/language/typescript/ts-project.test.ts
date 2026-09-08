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

/**
 * A solution-style tsconfig — the layout `npm create vite` produces — where the
 * options that matter live in the referenced projects, not the root.
 */
const plantSolution = (directory: string) => {
  mkdirSync(join(directory, "app"), { recursive: true });
  mkdirSync(join(directory, "scripts"), { recursive: true });
  writeFileSync(
    join(directory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { paths: { "@/*": ["./app/*"] } },
      files: [],
      references: [
        { path: "./tsconfig.app.json" },
        { path: "./tsconfig.node.json" },
      ],
    })
  );
  writeFileSync(
    join(directory, "tsconfig.app.json"),
    JSON.stringify({
      compilerOptions: {
        composite: true,
        target: "ES2022",
        lib: ["ES2022", "DOM"],
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "preserve",
        noEmit: true,
        strict: true,
      },
      include: ["app"],
    })
  );
  writeFileSync(
    join(directory, "tsconfig.node.json"),
    JSON.stringify({
      compilerOptions: { composite: true, module: "ESNext", noEmit: true },
      include: ["scripts"],
    })
  );
  writeFileSync(
    join(directory, "app", "view.tsx"),
    "export const View = () => <div />\n"
  );
  writeFileSync(
    join(directory, "scripts", "build.ts"),
    "export const build = 1\n"
  );
  plantMarkedCompiler(directory);
};

/** `--jsx` missing — what a solution root's empty options produce. */
const JSX_FLAG_MISSING = 17004;

let root: string;
let packageDir: string;
let solutionDir: string;

beforeEach(() => {
  // A repository-anchored lookup is the thing under test, so the override that
  // the rest of the suite leans on must not be in play.
  delete process.env[OVERRIDE_ENV];
  resetTypeScriptCache();
  resetProjects();

  root = mkdtempSync(join(tmpdir(), "reviewer-ts-project-"));
  packageDir = join(root, "packages", "app");
  mkdirSync(join(packageDir, "src"), { recursive: true });
  writeFileSync(join(packageDir, "tsconfig.json"), TSCONFIG);
  writeFileSync(join(packageDir, "src", "a.ts"), "export const one = 1\n");
  plantMarkedCompiler(packageDir);

  solutionDir = join(root, "packages", "solution");
  plantSolution(solutionDir);
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
  // answers a bare `require("typescript")` from reviewer's own dependencies no
  // matter which directory it is asked from; only the bundled server on plain
  // node resolves strictly enough to fail.
  it("loads the compiler installed beside the file, not the one at the root", () => {
    const project = projectFor(root, join(packageDir, "src", "a.ts"));

    expect(project).not.toBeNull();
    expect(project!.ts.version).toBe(MARKED_VERSION);
  });

  // The bug this guards against: a solution tsconfig owns no files and sets no
  // `jsx`, so stopping at the nearest config checked every component against
  // empty options and reported "Cannot use JSX unless the '--jsx' flag is
  // provided" on every tag — a wall of errors the repository's own tsc never
  // produces, because tsserver follows the references to the owning project.
  it("checks a file against the referenced project that owns it", () => {
    const file = join(solutionDir, "app", "view.tsx");
    const project = projectFor(root, file)!;
    project.openFile(file, null);

    expect(project.configPath).toBe(join(solutionDir, "tsconfig.app.json"));
    expect(
      project.service.getSemanticDiagnostics(file).map((d) => d.code)
    ).not.toContain(JSX_FLAG_MISSING);
  });

  it("falls back to the closest referenced project for a file none lists", () => {
    const file = join(solutionDir, "app", "unsaved.tsx");
    const project = projectFor(root, file)!;
    project.openFile(file, "export const Unsaved = () => <span />\n");

    expect(project.configPath).toBe(join(solutionDir, "tsconfig.app.json"));
    expect(
      project.service.getSemanticDiagnostics(file).map((d) => d.code)
    ).not.toContain(JSX_FLAG_MISSING);
  });

  it("analyses a file whose compiler only exists under its package", () => {
    const file = join(packageDir, "src", "a.ts");
    const project = projectFor(root, file)!;
    project.openFile(file, "export const one: number = 'text'\n");

    const diagnostics = project.service.getSemanticDiagnostics(file);

    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain(2322);
  });
});
