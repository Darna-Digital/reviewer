/**
 * The fold from a flat list of references into the results tree, and the walk
 * back down it.
 *
 * Nothing here touches the DOM or the network. The tree is rebuilt from the
 * references on every render — it is a fold over at most a thousand rows and
 * costs less than remembering it would — and the only state the caller keeps is
 * which branches are shut.
 */
import type { ReferenceKind, SymbolReference } from "@byconvo/core/language";
import type {
  FindUsagesDependencies,
  FindUsagesFunctions,
  UsageCategory,
  UsageGroup,
  UsageLeaf,
  UsageNode,
  PreviewPart,
  UsageRow,
} from "../interfaces/find-usages.interfaces";

/**
 * The wire's kinds in the reader's words. `read` becomes "unclassified"
 * deliberately: a bare reference is one the provider could say nothing more
 * about, and calling it a read would claim knowledge nobody has.
 */
const CATEGORY_OF: Record<ReferenceKind, UsageCategory> = {
  definition: "declaration",
  import: "import",
  export: "export",
  write: "write",
  read: "unclassified",
};

/**
 * Reading order for the categories. The declaration first because it is where
 * the symbol comes from, then the usages that are code, then the ones that are
 * only wiring — imports and re-exports say the least about how a symbol is used
 * and are the rows most often skipped past.
 */
const CATEGORY_ORDER: ReadonlyArray<UsageCategory> = [
  "declaration",
  "unclassified",
  "write",
  "import",
  "export",
];

export const CATEGORY_LABEL: Record<UsageCategory, string> = {
  declaration: "Declaration",
  unclassified: "Unclassified",
  write: "Value write",
  import: "Usage in import",
  export: "Usage in export",
};

export const categoryOf = (kind: ReferenceKind): UsageCategory =>
  CATEGORY_OF[kind];

/** `src/a/b.ts` → `src/a`; the empty string for a file at the root. */
export const directoryOf = (path: string): string => {
  const cut = path.lastIndexOf("/");
  return cut === -1 ? "" : path.slice(0, cut);
};

/** `src/a/b.ts` → `b.ts`. */
export const basenameOf = (path: string): string => {
  const cut = path.lastIndexOf("/");
  return cut === -1 ? path : path.slice(cut + 1);
};

/** The id a usage keeps across rebuilds — its own place in the project. */
export const usageId = (reference: SymbolReference): string =>
  `${reference.location.path}:${reference.location.range.start.line}:${reference.location.range.start.character}`;

/**
 * A level of the tree, while it is being built.
 *
 * Insertion-ordered maps are what keep document order: references arrive sorted
 * by path and position, so the first time a directory, file or container is
 * seen is also where it belongs among its siblings, and nothing needs sorting
 * afterwards.
 */
interface Level {
  readonly group: UsageGroup;
  readonly children: Map<string, Level>;
  readonly leaves: Array<UsageLeaf>;
}

const level = (
  id: string,
  kind: UsageGroup["kind"],
  label: string,
  detail: string
): Level => ({
  group: { id, kind, label, detail, count: 0, children: [] },
  children: new Map(),
  leaves: [],
});

const childLevel = (
  parent: Level,
  id: string,
  kind: UsageGroup["kind"],
  label: string,
  detail: string
): Level => {
  const existing = parent.children.get(id);
  if (existing !== undefined) return existing;
  const created = level(id, kind, label, detail);
  parent.children.set(id, created);
  return created;
};

/**
 * A level's finished node: its own branches first, then the usages that hang
 * off it directly. A file with some usages inside functions and some at the top
 * level therefore reads functions-then-loose-usages rather than interleaving
 * two kinds of row.
 */
const finish = (node: Level): UsageGroup => {
  const children: Array<UsageNode> = [];
  let count = node.leaves.length;
  for (const child of node.children.values()) {
    const finished = finish(child);
    count += finished.count;
    children.push(finished);
  }
  children.push(...node.leaves);
  return { ...node.group, count, children };
};

/**
 * References folded into category → directory → file → container → usage.
 *
 * A level with nothing to say is left out rather than drawn empty: a file whose
 * usages are all at its top level has no container row, and a project whose
 * files sit at the root has no directory row. Every level that survives is one
 * the reader can use to narrow down.
 */
export const buildUsageTree = (
  references: ReadonlyArray<SymbolReference>
): ReadonlyArray<UsageNode> => {
  const categories = new Map<UsageCategory, Level>();

  for (const reference of references) {
    const category = categoryOf(reference.kind);
    let node = categories.get(category);
    if (node === undefined) {
      node = level(
        `category:${category}`,
        "category",
        CATEGORY_LABEL[category],
        ""
      );
      categories.set(category, node);
    }

    const path = reference.location.path;
    const directory = directoryOf(path);
    if (directory !== "") {
      node = childLevel(
        node,
        `${node.group.id}/dir:${directory}`,
        "directory",
        directory,
        ""
      );
    }
    node = childLevel(
      node,
      `${node.group.id}/file:${path}`,
      "file",
      basenameOf(path),
      ""
    );
    if (reference.containerName !== "") {
      node = childLevel(
        node,
        `${node.group.id}/in:${reference.containerName}`,
        "container",
        reference.containerName,
        reference.containerKind
      );
    }
    node.leaves.push({
      id: `${node.group.id}/at:${usageId(reference)}`,
      kind: "usage",
      reference,
    });
  }

  return CATEGORY_ORDER.flatMap((category) => {
    const node = categories.get(category);
    return node === undefined ? [] : [finish(node)];
  });
};

/**
 * The tree flattened to the rows on screen, top to bottom — which is also the
 * order the arrow keys move in, so the list and the keyboard cannot disagree
 * about what "the next row" is.
 */
export const visibleRows = (
  nodes: ReadonlyArray<UsageNode>,
  collapsed: ReadonlySet<string>
): ReadonlyArray<UsageRow> => {
  const rows: Array<UsageRow> = [];
  const walk = (node: UsageNode, depth: number): void => {
    if (node.kind === "usage") {
      rows.push({ node, depth, expanded: false });
      return;
    }
    const expanded = !collapsed.has(node.id);
    rows.push({ node, depth, expanded });
    if (!expanded) return;
    for (const child of node.children) walk(child, depth + 1);
  };
  for (const node of nodes) walk(node, 0);
  return rows;
};

/** Every usage in the tree, in the order it presents them. */
export const usageLeaves = (
  nodes: ReadonlyArray<UsageNode>
): ReadonlyArray<UsageLeaf> =>
  nodes.flatMap((node) =>
    node.kind === "usage" ? [node] : usageLeaves(node.children)
  );

/** Every branch id in the tree — what "collapse all" folds shut. */
export const branchIds = (
  nodes: ReadonlyArray<UsageNode>
): ReadonlyArray<string> =>
  nodes.flatMap((node) =>
    node.kind === "usage" ? [] : [node.id, ...branchIds(node.children)]
  );

/**
 * The result `step` places along from `id`, clamped at both ends. An unknown id
 * — the first press after a search, or one whose usage the last search dropped
 * — starts from the top going forwards and from the bottom going back.
 */
export const stepUsage = (
  leaves: ReadonlyArray<UsageLeaf>,
  id: string | null,
  step: number
): UsageLeaf | null => {
  if (leaves.length === 0) return null;
  const at = id === null ? -1 : leaves.findIndex((leaf) => leaf.id === id);
  if (at === -1)
    return (step < 0 ? leaves[leaves.length - 1] : leaves[0]) ?? null;
  const next = Math.min(leaves.length - 1, Math.max(0, at + step));
  return leaves[next] ?? null;
};

/**
 * How a declaration reads in the results header.
 *
 * TypeScript names a declaration with its whole rendered signature —
 * `function greet(name: string): string` — which repeats the kind shown beside
 * it, so the kind is taken off the front rather than printed twice. An LSP
 * server sends no name at all, and there the source line is all there is.
 */
export const declarationLabel = (declaration: {
  readonly kind: string;
  readonly name: string;
  readonly preview: string;
}): string => {
  const name = declaration.name.trim();
  if (name === "") return declaration.preview;
  const prefix = `${declaration.kind} `;
  return declaration.kind !== "" && name.startsWith(prefix)
    ? name.slice(prefix.length)
    : name;
};

/**
 * The first usage at or beneath `node` — what a branch stands for when the
 * cursor lands on it.
 */
export const firstUsageIn = (node: UsageNode): UsageLeaf | null =>
  node.kind === "usage" ? node : (usageLeaves(node.children)[0] ?? null);

/** The node with this id, anywhere in the tree. */
const nodeById = (
  nodes: ReadonlyArray<UsageNode>,
  id: string
): UsageNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.kind === "usage") continue;
    const found = nodeById(node.children, id);
    if (found !== null) return found;
  }
  return null;
};

/** The usage a cursor on the row `id` is pointing at. See `previewed`. */
export const previewedUsage = (
  nodes: ReadonlyArray<UsageNode>,
  id: string | null
): UsageLeaf | null => {
  if (id === null) return null;
  const node = nodeById(nodes, id);
  return node === null ? null : firstUsageIn(node);
};

/**
 * The branches standing between the root and `id`, outermost first — the ones
 * that have to be open for that row to be on screen.
 *
 * Walked rather than parsed out of the id: an id is built by joining its
 * ancestors' with `/`, and a directory's own name holds slashes of its own, so
 * the string cannot be taken apart again without ambiguity.
 */
export const branchPathTo = (
  nodes: ReadonlyArray<UsageNode>,
  id: string
): ReadonlyArray<string> => {
  const walk = (
    node: UsageNode,
    trail: ReadonlyArray<string>
  ): ReadonlyArray<string> | null => {
    if (node.id === id) return trail;
    if (node.kind === "usage") return null;
    for (const child of node.children) {
      const found = walk(child, [...trail, node.id]);
      if (found !== null) return found;
    }
    return null;
  };
  for (const node of nodes) {
    const found = walk(node, []);
    if (found !== null) return found;
  }
  return [];
};

/**
 * `collapsed` with everything in the way of `id` opened, so a result reached by
 * stepping rather than by clicking is a row the reader can actually see.
 */
export const revealing = (
  collapsed: ReadonlySet<string>,
  nodes: ReadonlyArray<UsageNode>,
  id: string
): ReadonlySet<string> => {
  const next = new Set(collapsed);
  for (const branch of branchPathTo(nodes, id)) next.delete(branch);
  return next;
};

/**
 * A preview split around the symbol, so the match can be picked out of the line
 * it sits in.
 *
 * By text rather than by the reference's own columns, which the preview no
 * longer agrees with: it is the source line *trimmed*, so every column past the
 * indent is off by however deep the line was. Matching the name back out of the
 * line lands in the same place for anything a reader would call a usage, and a
 * line holding the name twice gets both marked rather than the wrong one.
 */
export const previewParts = (
  preview: string,
  symbol: string
): ReadonlyArray<PreviewPart> => {
  if (symbol === "" || !preview.includes(symbol)) {
    return [{ at: 0, text: preview, match: false }];
  }
  const parts: Array<PreviewPart> = [];
  let from = 0;
  for (;;) {
    const at = preview.indexOf(symbol, from);
    if (at === -1) break;
    if (at > from) {
      parts.push({ at: from, text: preview.slice(from, at), match: false });
    }
    parts.push({ at, text: symbol, match: true });
    from = at + symbol.length;
  }
  if (from < preview.length) {
    parts.push({ at: from, text: preview.slice(from), match: false });
  }
  return parts;
};

/** Fold a branch shut, or open it again. */
export const toggleCollapsed = (
  collapsed: ReadonlySet<string>,
  id: string
): ReadonlySet<string> => {
  const next = new Set(collapsed);
  if (!next.delete(id)) next.add(id);
  return next;
};

export function createFindUsagesFunctions(
  d: FindUsagesDependencies
): FindUsagesFunctions {
  const tree: FindUsagesFunctions["tree"] = () =>
    buildUsageTree(d.data.references);

  const rows: FindUsagesFunctions["rows"] = () =>
    visibleRows(tree(), d.data.collapsed);

  const usages: FindUsagesFunctions["usages"] = () => usageLeaves(tree());

  const previewed: FindUsagesFunctions["previewed"] = (id) =>
    previewedUsage(tree(), id);

  const step: FindUsagesFunctions["step"] = (id, delta) =>
    stepUsage(usages(), previewed(id)?.id ?? null, delta);

  return { tree, rows, usages, previewed, step };
}
