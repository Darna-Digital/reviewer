/**
 * What a usage *is*, read off the syntax tree.
 *
 * `findReferences` answers with spans and two booleans — is this the
 * declaration, is it written to — which is enough to colour a list and not
 * nearly enough to file one. A usages tree groups by the thing a reader
 * actually thinks in: which import pulled the symbol in, which function the
 * call sits inside. Both of those are one walk up the ancestors of the node at
 * the span, so they live here, apart from the provider, and are tested against
 * a real compiler rather than a mock of one.
 *
 * Nothing here reaches for the type checker. Everything asked of it is
 * syntactic, so it costs a walk of a source file the program already has.
 */
import type * as TS from "typescript";
import type { ReferenceKind } from "@byconvo/core/language";
import type { TypeScriptModule } from "./ts-module.ts";

/** The symbol a usage sits inside, as a results tree files it. */
export interface UsageContainer {
  /** The enclosing declaration's name, empty at the top level of a file. */
  readonly name: string;
  /** Its kind — `function`, `method`, `class`, `variable`, … */
  readonly kind: string;
}

export const NO_CONTAINER: UsageContainer = { name: "", kind: "" };

/**
 * The innermost node covering `offset`.
 *
 * `forEachChild` skips tokens, so the walk stops at the smallest *node* that
 * spans the position — an identifier rather than its punctuation, which is
 * exactly what the ancestor walks below want to start from.
 */
export const nodeAt = (
  source: TS.SourceFile,
  offset: number
): TS.Node | null => {
  let found: TS.Node | null = null;
  const descend = (node: TS.Node): void => {
    if (offset < node.getStart(source) || offset >= node.getEnd()) return;
    found = node;
    node.forEachChild(descend);
  };
  source.forEachChild(descend);
  return found;
};

/** The text of a declaration's name, or "" for an anonymous one. */
const nameOf = (ts: TypeScriptModule, node: TS.Node): string => {
  const named = node as { readonly name?: TS.Node };
  if (named.name === undefined) return "";
  return ts.isIdentifier(named.name) ||
    ts.isPrivateIdentifier(named.name) ||
    ts.isStringLiteral(named.name)
    ? named.name.text
    : "";
};

/**
 * The name a variable declaration lends to the function it holds.
 *
 * `const Product = () => …` is a component to everyone reading it and an
 * anonymous arrow function to the compiler, so a function expression bound
 * straight to a name borrows that name rather than reporting none.
 */
const boundName = (ts: TypeScriptModule, node: TS.Node): UsageContainer => {
  // `parent` is typed as always present, but a source file's own is undefined
  // at runtime — here and in the ancestor walks below.
  const parent: TS.Node | undefined = node.parent;
  if (parent === undefined) return NO_CONTAINER;
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    return { name: parent.name.text, kind: "function" };
  }
  if (ts.isPropertyAssignment(parent)) {
    const name = nameOf(ts, parent);
    return name === "" ? NO_CONTAINER : { name, kind: "method" };
  }
  return NO_CONTAINER;
};

/**
 * The declaration `node` belongs to, or null when it is not one of the shapes a
 * tree names. Ordered from the most specific outward: a method is a method
 * before it is a class member.
 */
const declarationOf = (
  ts: TypeScriptModule,
  node: TS.Node
): UsageContainer | null => {
  if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) {
    const name = nameOf(ts, node);
    return name === "" ? null : { name, kind: "method" };
  }
  if (
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node) ||
    ts.isConstructorDeclaration(node)
  ) {
    const name = ts.isConstructorDeclaration(node)
      ? "constructor"
      : nameOf(ts, node);
    return name === "" ? null : { name, kind: "method" };
  }
  if (ts.isFunctionDeclaration(node)) {
    const name = nameOf(ts, node);
    return name === ""
      ? { name: "default", kind: "function" }
      : {
          name,
          kind: "function",
        };
  }
  if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
    const own = nameOf(ts, node);
    return own === "" ? boundName(ts, node) : { name: own, kind: "function" };
  }
  if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
    const name = nameOf(ts, node);
    return name === "" ? null : { name, kind: "class" };
  }
  if (ts.isInterfaceDeclaration(node)) {
    return { name: node.name.text, kind: "interface" };
  }
  if (ts.isTypeAliasDeclaration(node)) {
    return { name: node.name.text, kind: "type" };
  }
  if (ts.isEnumDeclaration(node)) {
    return { name: node.name.text, kind: "enum" };
  }
  if (ts.isModuleDeclaration(node)) {
    const name = nameOf(ts, node);
    return name === "" ? null : { name, kind: "module" };
  }
  return null;
};

/**
 * The symbol a usage at `offset` sits inside, innermost first.
 *
 * A container that resolves to nothing nameable — an anonymous callback passed
 * inline — is stepped over rather than reported blank: the useful answer is the
 * function that callback was written in, which is the next one up.
 */
export const containerAt = (
  ts: TypeScriptModule,
  source: TS.SourceFile,
  offset: number
): UsageContainer => {
  let node: TS.Node | undefined = nodeAt(source, offset) ?? undefined;
  while (node !== undefined) {
    const declaration = declarationOf(ts, node);
    if (declaration !== null && declaration.name !== "") return declaration;
    node = node.parent;
  }
  return NO_CONTAINER;
};

/** Whether any ancestor of `node` satisfies `matches`. */
const hasAncestor = (
  node: TS.Node,
  matches: (candidate: TS.Node) => boolean
): boolean => {
  let current: TS.Node | undefined = node;
  while (current !== undefined) {
    if (matches(current)) return true;
    current = current.parent;
  }
  return false;
};

/**
 * How the usage at `offset` reads.
 *
 * `isDefinition` and `isWriteAccess` are the compiler's own answers and are
 * taken as given; the two this adds are the ones a reader separates by eye. An
 * import is anything inside an import clause or an `import()` type — the places
 * a name is being *brought in* rather than used. An export is a re-export or a
 * bare `export { … }`, but not `export function foo`, which is the declaration
 * and is already labelled as one.
 */
export const usageKind = (
  ts: TypeScriptModule,
  source: TS.SourceFile,
  offset: number,
  entry: {
    readonly isDefinition?: boolean | undefined;
    readonly isWriteAccess?: boolean | undefined;
  }
): ReferenceKind => {
  if (entry.isDefinition === true) return "definition";
  const node = nodeAt(source, offset);
  if (node !== null) {
    if (
      hasAncestor(
        node,
        (candidate) =>
          ts.isImportDeclaration(candidate) ||
          ts.isImportEqualsDeclaration(candidate) ||
          ts.isImportTypeNode(candidate) ||
          ts.isImportClause(candidate)
      )
    ) {
      return "import";
    }
    if (
      hasAncestor(
        node,
        (candidate) =>
          ts.isExportDeclaration(candidate) || ts.isExportAssignment(candidate)
      )
    ) {
      return "export";
    }
  }
  return entry.isWriteAccess === true ? "write" : "read";
};
