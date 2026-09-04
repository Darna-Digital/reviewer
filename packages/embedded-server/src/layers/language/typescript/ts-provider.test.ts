/**
 * End-to-end coverage for the TypeScript provider: a real fixture repository on
 * disk, a real `ts.LanguageService`, and the actual wire types coming back. The
 * mapping units are tested separately; what this file protects is the wiring —
 * project discovery, overlays, repo-relative paths and cross-file analysis.
 */
import { Effect } from "effect";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Position } from "@byconvo/core/language";
import { OVERRIDE_ENV, resetTypeScriptCache } from "./ts-module.ts";
import { resetProjects } from "./ts-project.ts";
import { typescriptProvider } from "./ts-provider.ts";

const A_TS = [
  "/** Greets someone. */",
  "export function greet(name: string) {",
  "  return `hi ${name}`",
  "}",
  "",
].join("\n");

const B_TS = [
  'import { greet } from "./a"',
  "",
  "const unused = 1",
  'export const msg = greet("bob")',
  'export const wrong: number = "nope"',
  "",
].join("\n");

const TSCONFIG = JSON.stringify(
  {
    compilerOptions: {
      strict: true,
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "Bundler",
      noUnusedLocals: true,
      noEmit: true,
    },
    include: ["src"],
  },
  null,
  2
);

let root: string;

/** Position of the first occurrence of `needle` in `text`, zero-based. */
const positionOf = (text: string, needle: string): Position => {
  const offset = text.indexOf(needle);
  if (offset === -1) throw new Error(`"${needle}" not found in fixture`);
  const before = text.slice(0, offset);
  const line = before.split("\n").length - 1;
  return { line, character: offset - (before.lastIndexOf("\n") + 1) };
};

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);

const request = (path: string, contents: string | null = null) => ({
  root,
  path,
  contents,
});

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "byconvo-ts-"));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "tsconfig.json"), TSCONFIG);
  writeFileSync(join(root, "src/a.ts"), A_TS);
  writeFileSync(join(root, "src/b.ts"), B_TS);
  // The fixture has no node_modules, so point the provider at the compiler this
  // package already depends on.
  process.env[OVERRIDE_ENV] = createRequire(import.meta.url).resolve(
    "typescript"
  );
  resetTypeScriptCache();
  resetProjects();
});

afterAll(() => {
  delete process.env[OVERRIDE_ENV];
  resetTypeScriptCache();
  resetProjects();
  rmSync(root, { recursive: true, force: true });
});

describe("typescriptProvider", () => {
  it("reports itself available with the compiler it found", async () => {
    const availability = await run(typescriptProvider.probe(root));
    expect(availability.available).toBe(true);
    expect(availability.detail).toMatch(/^TypeScript \d+\./);
  });

  it("reports a type error with its code and range", async () => {
    const diagnostics = await run(
      typescriptProvider.diagnostics(request("src/b.ts"))
    );
    const assignment = diagnostics.find((d) => d.code === "2322");
    expect(assignment).toBeDefined();
    expect(assignment!.severity).toBe("error");
    expect(assignment!.source).toBe("ts");
    expect(assignment!.message).toContain("not assignable");
    // TypeScript anchors an assignability error to the declaration's name.
    expect(assignment!.range.start).toEqual(positionOf(B_TS, "wrong"));
  });

  it("tags an unused local as unnecessary", async () => {
    const diagnostics = await run(
      typescriptProvider.diagnostics(request("src/b.ts"))
    );
    const unused = diagnostics.find((d) => d.code === "6133");
    expect(unused).toBeDefined();
    expect(unused!.tags).toContain("unnecessary");
  });

  it("finds no problems in a clean file", async () => {
    const diagnostics = await run(
      typescriptProvider.diagnostics(request("src/a.ts"))
    );
    expect(diagnostics).toEqual([]);
  });

  it("analyses an unsaved buffer instead of the file on disk", async () => {
    const edited = `${A_TS}export const broken: number = "still a string"\n`;
    const diagnostics = await run(
      typescriptProvider.diagnostics(request("src/a.ts", edited))
    );
    expect(diagnostics.map((d) => d.code)).toContain("2322");

    // Dropping the overlay returns to the clean file on disk.
    const afterClose = await run(
      typescriptProvider.diagnostics(request("src/a.ts"))
    );
    expect(afterClose).toEqual([]);
  });

  it("jumps to a definition in another file", async () => {
    const result = await run(
      typescriptProvider.definition({
        ...request("src/b.ts"),
        position: positionOf(B_TS, 'greet("bob")'),
      })
    );
    expect(result.providerId).toBe("typescript");
    expect(result.targets).toHaveLength(1);
    const target = result.targets[0];
    expect(target.location.path).toBe("src/a.ts");
    expect(target.name).toBe("greet");
    expect(target.kind).toBe("function");
    expect(target.location.range.start).toEqual(positionOf(A_TS, "greet"));
    expect(target.preview).toBe("export function greet(name: string) {");
  });

  it("finds usages across the project with their kinds", async () => {
    const result = await run(
      typescriptProvider.references({
        ...request("src/a.ts"),
        position: positionOf(A_TS, "greet"),
      })
    );
    expect(result.symbol).toBe("greet");
    const byPath = result.references.map((r) => r.location.path);
    expect(byPath).toContain("src/a.ts");
    expect(byPath).toContain("src/b.ts");
    // The declaration, the import and the call.
    expect(result.references).toHaveLength(3);
    expect(result.references.some((r) => r.kind === "definition")).toBe(true);
    expect(
      result.references.every((r) => !r.location.path.startsWith("/"))
    ).toBe(true);
  });

  it("reads each usage's syntax, and names where the symbol is declared", async () => {
    const result = await run(
      typescriptProvider.references({
        ...request("src/a.ts"),
        position: positionOf(A_TS, "greet"),
      })
    );

    // The `import { greet }` line is an import, not a bare reference — which is
    // the whole reason a usages tree can put the wiring in its own group.
    const imported = result.references.find(
      (reference) =>
        reference.location.path === "src/b.ts" && reference.kind === "import"
    );
    expect(imported).toBeDefined();

    // The call sits at the top level of `b.ts`, so there is no function to file
    // it under, and the fixture's declaration is a function called `greet`.
    const call = result.references.find(
      (reference) => reference.kind === "read"
    );
    expect(call?.containerName).toBe("");
    expect(result.declaration?.location.path).toBe("src/a.ts");
    expect(result.declaration?.kind).toBe("function");
  });

  it("files a usage under the function it sits in", async () => {
    const contents = [
      'import { greet } from "./a"',
      "",
      "export function shout(name: string) {",
      "  return greet(name).toUpperCase()",
      "}",
      "",
    ].join("\n");
    const result = await run(
      typescriptProvider.references({
        ...request("src/b.ts", contents),
        position: positionOf(contents, "greet(name)"),
      })
    );
    const inside = result.references.find(
      (reference) => reference.containerName === "shout"
    );
    expect(inside?.containerKind).toBe("function");
  });

  it("returns hover markdown with the signature and doc comment", async () => {
    const result = await run(
      typescriptProvider.hover({
        ...request("src/b.ts"),
        position: positionOf(B_TS, 'greet("bob")'),
      })
    );
    expect(result.providerId).toBe("typescript");
    expect(result.contents).toContain("```ts");
    // At the call site the symbol is the imported alias, which is how
    // TypeScript renders it — the signature and the doc comment still resolve.
    expect(result.contents).toContain("greet(name: string): string");
    expect(result.contents).toContain("Greets someone.");
  });

  it("returns an empty hover where there is no symbol", async () => {
    const result = await run(
      typescriptProvider.hover({
        ...request("src/b.ts"),
        position: { line: 1, character: 0 },
      })
    );
    expect(result.contents).toBe("");
  });

  it("clamps a position past the end of the document", async () => {
    const result = await run(
      typescriptProvider.definition({
        ...request("src/b.ts"),
        position: { line: 9_999, character: 9_999 },
      })
    );
    expect(result.targets).toEqual([]);
  });

  it("analyses a file with no tsconfig above it as an inferred project", async () => {
    const loose = mkdtempSync(join(tmpdir(), "byconvo-ts-loose-"));
    try {
      writeFileSync(join(loose, "solo.ts"), 'const n: number = "text"\n');
      const diagnostics = await run(
        typescriptProvider.diagnostics({
          root: loose,
          path: "solo.ts",
          contents: null,
        })
      );
      expect(diagnostics.map((d) => d.code)).toContain("2322");
    } finally {
      rmSync(loose, { recursive: true, force: true });
    }
  });

  // The "repository has no TypeScript" path cannot be reproduced here: the test
  // runner resolves bare specifiers through the workspace, so even a temporary
  // directory outside it finds a compiler. An unloadable override reaches the
  // same unavailable branch, which is what the assertions below cover.
  it("reports unavailable, and answers emptily, when the compiler cannot load", async () => {
    const previous = process.env[OVERRIDE_ENV];
    const bare = mkdtempSync(join(tmpdir(), "byconvo-ts-bare-"));
    process.env[OVERRIDE_ENV] = join(bare, "no-such-typescript.js");
    resetTypeScriptCache();
    try {
      writeFileSync(join(bare, "solo.ts"), "const a: number = 'text'\n");
      const availability = await run(typescriptProvider.probe(bare));
      expect(availability.available).toBe(false);
      expect(availability.detail).toContain("could not be loaded");

      const document = { root: bare, path: "solo.ts", contents: null };
      expect(await run(typescriptProvider.diagnostics(document))).toEqual([]);
      const definition = await run(
        typescriptProvider.definition({
          ...document,
          position: { line: 0, character: 6 },
        })
      );
      expect(definition).toEqual({
        providerId: null,
        origin: null,
        targets: [],
      });
      const hover = await run(
        typescriptProvider.hover({
          ...document,
          position: { line: 0, character: 6 },
        })
      );
      expect(hover.contents).toBe("");
    } finally {
      rmSync(bare, { recursive: true, force: true });
      if (previous === undefined) delete process.env[OVERRIDE_ENV];
      else process.env[OVERRIDE_ENV] = previous;
      resetTypeScriptCache();
    }
  });
});
