import { describe, expect, it } from "vitest";
import type { DocumentSymbol, Range } from "../schema/language.schema.ts";
import {
  MAX_SYMBOLS,
  flattenSymbolTree,
  nestFlatSymbols,
  normalizeDocumentSymbols,
  type SymbolNode,
} from "./language.symbols.ts";

const lines = (from: number, to: number): Range => ({
  start: { line: from, character: 0 },
  end: { line: to, character: 1 },
});

const node = (
  name: string,
  range: Range,
  children: ReadonlyArray<SymbolNode> = []
): SymbolNode => ({
  name,
  kind: "class",
  range,
  selectionRange: { start: range.start, end: range.start },
  children,
});

const outline = (symbols: ReadonlyArray<DocumentSymbol>) =>
  symbols.map(
    (entry) => `${"  ".repeat(entry.depth)}${entry.name}<${entry.containerName}`
  );

describe("flattenSymbolTree", () => {
  it("lists parents before their children, siblings in document order", () => {
    const tree = [
      node("Later", lines(20, 30)),
      node("Greeter", lines(0, 10), [
        node("greet", lines(5, 7)),
        node("constructor", lines(1, 3), [node("inner", lines(2, 2))]),
      ]),
    ];
    expect(outline(flattenSymbolTree(tree))).toEqual([
      "Greeter<",
      "  constructor<Greeter",
      "    inner<constructor",
      "  greet<Greeter",
      "Later<",
    ]);
  });

  it("keeps each symbol's ranges and kind", () => {
    const [only] = flattenSymbolTree([node("A", lines(3, 4))]);
    expect(only).toEqual({
      name: "A",
      kind: "class",
      containerName: "",
      range: lines(3, 4),
      selectionRange: { start: lines(3, 4).start, end: lines(3, 4).start },
      depth: 0,
    });
  });
});

describe("nestFlatSymbols", () => {
  const flat = (name: string, range: Range, containerName = "") => ({
    name,
    kind: "method",
    containerName,
    range,
    selectionRange: range,
  });

  it("reads depth off enclosing ranges", () => {
    const symbols = nestFlatSymbols([
      flat("method", lines(2, 4), "Klass"),
      flat("Klass", lines(1, 10), "Mod"),
      flat("Mod", lines(0, 20)),
      flat("after", lines(21, 22)),
    ]);
    expect(outline(symbols)).toEqual([
      "Mod<",
      "  Klass<Mod",
      "    method<Klass",
      "after<",
    ]);
  });

  it("falls back to the named container when ranges cover only names", () => {
    const name = (line: number): Range => ({
      start: { line, character: 6 },
      end: { line, character: 9 },
    });
    const symbols = nestFlatSymbols([
      flat("Foo", name(0)),
      flat("bar", name(1), "Foo"),
      flat("baz", name(2), "Unknown"),
    ]);
    expect(symbols.map((entry) => entry.depth)).toEqual([0, 1, 0]);
  });
});

describe("normalizeDocumentSymbols", () => {
  const entry = (
    name: string,
    line: number,
    depth: number
  ): DocumentSymbol => ({
    name,
    kind: "function",
    containerName: "",
    range: lines(line, line),
    selectionRange: lines(line, line),
    depth,
  });

  it("sorts by start, a parent ahead of a child starting with it", () => {
    const normalized = normalizeDocumentSymbols([
      entry("second", 4, 0),
      entry("child", 1, 1),
      entry("parent", 1, 0),
    ]);
    expect(normalized.map((symbol) => symbol.name)).toEqual([
      "parent",
      "child",
      "second",
    ]);
  });

  it("drops duplicates and caps the list", () => {
    expect(
      normalizeDocumentSymbols([entry("a", 0, 0), entry("a", 0, 0)])
    ).toHaveLength(1);
    const many = Array.from({ length: MAX_SYMBOLS + 10 }, (_, line) =>
      entry(`s${line}`, line, 0)
    );
    expect(normalizeDocumentSymbols(many)).toHaveLength(MAX_SYMBOLS);
  });
});
