/**
 * Document outlines — the two shapes a language server answers
 * `textDocument/documentSymbol` with, brought to the one flat list the wire
 * carries.
 *
 * A modern server answers with a tree (`DocumentSymbol[]`), and TypeScript's
 * navigation tree is one too; an older server answers with a flat list
 * (`SymbolInformation[]`) where each entry names its container but nothing says
 * how deep it sits. Both end up as the same array — parents before children, in
 * document order, each entry carrying its `depth` — so a client renders an
 * outline from it without caring which kind of server produced it.
 */
import type { DocumentSymbol, Range } from "../schema/language.schema.ts";
import { comparePositions } from "./language.results.ts";

/** Payload cap. A generated file can declare thousands of symbols. */
export const MAX_SYMBOLS = 5000;

/** A symbol as a tree-shaped answer gives it. */
export interface SymbolNode {
  readonly name: string;
  readonly kind: string;
  readonly range: Range;
  readonly selectionRange: Range;
  readonly children: ReadonlyArray<SymbolNode>;
}

/** A symbol as a flat answer gives it: its container named, its depth not. */
export interface FlatSymbol {
  readonly name: string;
  readonly kind: string;
  readonly containerName: string;
  readonly range: Range;
  readonly selectionRange: Range;
}

/**
 * Document order, with the enclosing range first when two start together — a
 * class and its first decorator-less member can share a start, and the class is
 * the parent.
 */
const compareRanges = (a: Range, b: Range): number =>
  comparePositions(a.start, b.start) || comparePositions(b.end, a.end);

const encloses = (outer: Range, inner: Range): boolean =>
  comparePositions(outer.start, inner.start) <= 0 &&
  comparePositions(inner.end, outer.end) <= 0;

/**
 * A symbol tree as a pre-order list: each symbol, then its children, siblings
 * in document order. `containerName` is the parent's name, empty at the top.
 */
export const flattenSymbolTree = (
  nodes: ReadonlyArray<SymbolNode>
): Array<DocumentSymbol> => {
  const out: Array<DocumentSymbol> = [];
  const visit = (
    siblings: ReadonlyArray<SymbolNode>,
    depth: number,
    containerName: string
  ) => {
    const ordered = [...siblings].sort((a, b) =>
      compareRanges(a.range, b.range)
    );
    for (const node of ordered) {
      out.push({
        name: node.name,
        kind: node.kind,
        containerName,
        range: node.range,
        selectionRange: node.selectionRange,
        depth,
      });
      visit(node.children, depth + 1, node.name);
    }
  };
  visit(nodes, 0, "");
  return out;
};

/**
 * Depths for a flat list, read off the ranges: a symbol sits one level inside
 * the nearest earlier symbol whose range encloses it. Some servers report only
 * the name's span as a symbol's range, which encloses nothing; for those the
 * container the server named stands in, when an earlier symbol carries that
 * name. The server's `containerName` is passed on as it said it.
 */
export const nestFlatSymbols = (
  symbols: ReadonlyArray<FlatSymbol>
): Array<DocumentSymbol> => {
  const ordered = [...symbols].sort((a, b) => compareRanges(a.range, b.range));
  const enclosing: Array<{ readonly range: Range; readonly depth: number }> =
    [];
  const depthByName = new Map<string, number>();
  return ordered.map((symbol) => {
    while (
      enclosing.length > 0 &&
      !encloses(enclosing[enclosing.length - 1].range, symbol.range)
    ) {
      enclosing.pop();
    }
    const parent = enclosing[enclosing.length - 1];
    const namedParentDepth =
      symbol.containerName.length > 0
        ? depthByName.get(symbol.containerName)
        : undefined;
    const depth =
      parent !== undefined
        ? parent.depth + 1
        : namedParentDepth !== undefined
          ? namedParentDepth + 1
          : 0;
    enclosing.push({ range: symbol.range, depth });
    depthByName.set(symbol.name, depth);
    return { ...symbol, depth };
  });
};

const symbolKey = (symbol: DocumentSymbol): string =>
  `${symbol.depth}|${symbol.kind}|${symbol.name}|${symbol.range.start.line}:${symbol.range.start.character}-${symbol.range.end.line}:${symbol.range.end.character}`;

/**
 * Every provider's outline held to the same guarantees: duplicates dropped, in
 * document order with a parent ahead of a child that starts where it does, and
 * capped at {@link MAX_SYMBOLS}. The sort is stable, so a provider's pre-order
 * survives it.
 */
export const normalizeDocumentSymbols = (
  symbols: ReadonlyArray<DocumentSymbol>
): ReadonlyArray<DocumentSymbol> => {
  const seen = new Set<string>();
  const unique: Array<DocumentSymbol> = [];
  for (const symbol of symbols) {
    const key = symbolKey(symbol);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(symbol);
  }
  return unique
    .sort(
      (a, b) =>
        comparePositions(a.range.start, b.range.start) || a.depth - b.depth
    )
    .slice(0, MAX_SYMBOLS);
};
