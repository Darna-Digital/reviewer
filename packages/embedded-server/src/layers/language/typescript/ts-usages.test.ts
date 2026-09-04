/**
 * Against a real compiler, on a real parse. The whole point of this module is
 * that it reads syntax the compiler's own reference entries cannot describe, so
 * a stubbed AST would be testing the stub.
 */
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { containerAt, nodeAt, usageKind } from "./ts-usages.ts";

/** Parsed with parent pointers, which is what both walks climb. */
const parse = (source: string): ts.SourceFile =>
  ts.createSourceFile(
    "a.tsx",
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX
  );

/** The offset of `needle` in `source`, so a case reads as the code it is about. */
const offsetOf = (source: string, needle: string): number => {
  const at = source.indexOf(needle);
  if (at === -1) throw new Error(`"${needle}" not in the fixture`);
  return at;
};

const containerIn = (source: string, needle: string) =>
  containerAt(ts, parse(source), offsetOf(source, needle));

const kindIn = (
  source: string,
  needle: string,
  entry: { isDefinition?: boolean; isWriteAccess?: boolean } = {}
) => usageKind(ts, parse(source), offsetOf(source, needle), entry);

describe("nodeAt", () => {
  it("stops at the innermost node covering the offset", () => {
    const source = "const value = greet(name)\n";
    const node = nodeAt(parse(source), offsetOf(source, "greet"));
    expect(node?.getText()).toBe("greet");
  });

  it("has nothing to say past the end of the file", () => {
    expect(nodeAt(parse("const a = 1\n"), 500)).toBeNull();
  });
});

describe("containerAt", () => {
  it("names the function a usage sits in", () => {
    expect(containerIn("function run() {\n  greet()\n}\n", "greet")).toEqual({
      name: "run",
      kind: "function",
    });
  });

  it("names a method by its own name rather than its class", () => {
    const source = "class Box {\n  open() {\n    greet()\n  }\n}\n";
    expect(containerIn(source, "greet()")).toEqual({
      name: "open",
      kind: "method",
    });
  });

  it("names a constructor", () => {
    const source = "class Box {\n  constructor() {\n    greet()\n  }\n}\n";
    expect(containerIn(source, "greet()")).toEqual({
      name: "constructor",
      kind: "method",
    });
  });

  it("lends a bound name to the arrow function that has none", () => {
    const source = "const Product = () => {\n  return greet()\n}\n";
    expect(containerIn(source, "greet")).toEqual({
      name: "Product",
      kind: "function",
    });
  });

  it("steps over an anonymous callback to the function it was written in", () => {
    const source = "function run() {\n  items.map(() => greet())\n}\n";
    expect(containerIn(source, "greet")).toEqual({
      name: "run",
      kind: "function",
    });
  });

  it("names a class when the usage is in one of its fields", () => {
    const source = "class Box {\n  value = greet()\n}\n";
    expect(containerIn(source, "greet")).toEqual({
      name: "Box",
      kind: "class",
    });
  });

  it("has no container for a usage at the top level of a file", () => {
    expect(containerIn("const value = greet()\n", "greet")).toEqual({
      name: "",
      kind: "",
    });
  });
});

describe("usageKind", () => {
  it("takes the compiler's word for a declaration", () => {
    expect(kindIn("const greet = 1\n", "greet", { isDefinition: true })).toBe(
      "definition"
    );
  });

  it("reads a named import as an import", () => {
    expect(kindIn('import { greet } from "./a"\n', "greet")).toBe("import");
  });

  it("reads a default and a namespace import as imports", () => {
    expect(kindIn('import greet from "./a"\n', "greet")).toBe("import");
    expect(kindIn('import * as greet from "./a"\n', "greet")).toBe("import");
  });

  it("reads an `import()` type as an import", () => {
    expect(kindIn('type A = import("./a").greet\n', "greet")).toBe("import");
  });

  it("reads a re-export and a default export as exports", () => {
    expect(kindIn('export { greet } from "./a"\n', "greet")).toBe("export");
    expect(kindIn("export default greet\n", "greet")).toBe("export");
  });

  it("leaves `export function` to the declaration it already is", () => {
    // The compiler calls this span a definition; the `export` keyword in front
    // of it must not turn the declaration into an export usage.
    expect(
      kindIn("export function greet() {}\n", "greet", { isDefinition: true })
    ).toBe("definition");
  });

  it("passes a write through, and reads everything else", () => {
    expect(kindIn("greet = 2\n", "greet", { isWriteAccess: true })).toBe(
      "write"
    );
    expect(kindIn("const a = greet()\n", "greet")).toBe("read");
  });
});
