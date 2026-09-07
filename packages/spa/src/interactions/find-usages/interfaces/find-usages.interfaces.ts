/**
 * `find-usages` — every place a symbol is used, as a tool window rather than a
 * popover.
 *
 * The list used to hang off the token in a floating card: fine for three
 * results, useless for three hundred, and gone the moment you looked away. A
 * results tree is the shape the question actually has — usages of a symbol fall
 * into kinds, kinds fall into directories, directories into files, files into
 * the functions the usages sit in — so the feature's logic is the fold from a
 * flat list of references into that tree, and the walk back down it that a
 * keyboard drives.
 *
 * All of it is pure: a search is a path and a position, the answer is an array
 * of references, and everything between is a fold. The fetching lives in the
 * adapter and the scrolling lives in the components.
 */
import type { Position, SymbolReference } from "@reviewer/core/language";

/**
 * What a search is for.
 *
 * The position, not the name: a name is ambiguous and a position is not, and it
 * is the position the language server is asked about. `symbol` is only what to
 * call the search while it is still running, and `key` is what makes asking the
 * same question twice a new search rather than a no-op.
 */
export interface UsageQuery {
  /** Project-relative path the symbol was asked about in. */
  readonly path: string;
  /** Zero-based LSP position of the identifier. */
  readonly position: Position;
  /** The identifier as it reads in the source, for the title. */
  readonly symbol: string;
  /** Bumped on every ask, so the same symbol can be searched again. */
  readonly key: number;
}

/**
 * How a usage reads, in the words the tree groups by. The wire's `kind` is the
 * provider's vocabulary; this is the reader's.
 */
export type UsageCategory =
  "declaration" | "unclassified" | "write" | "import" | "export";

/** A branch of the results tree — a category, a directory, a file, a symbol. */
export interface UsageGroup {
  /** Stable across rebuilds of the same results, so expansion survives them. */
  readonly id: string;
  readonly kind: "category" | "directory" | "file" | "container";
  readonly label: string;
  /** Quieter text beside the label: a file's directory, a container's kind. */
  readonly detail: string;
  /** Usages beneath this branch, at any depth. */
  readonly count: number;
  readonly children: ReadonlyArray<UsageNode>;
}

/** One usage. */
export interface UsageLeaf {
  readonly id: string;
  readonly kind: "usage";
  readonly reference: SymbolReference;
}

export type UsageNode = UsageGroup | UsageLeaf;

/** A node as the list draws it, once the collapsed branches are folded away. */
export interface UsageRow {
  readonly node: UsageNode;
  /** How far in to indent it. */
  readonly depth: number;
  /** Branches only: whether this one is showing its children. */
  readonly expanded: boolean;
}

/**
 * A stretch of a result's preview line, and whether it is the name that was
 * searched for. `at` is its offset in the line, which is what gives a part an
 * identity — a line holding the same name twice has two of them.
 */
export interface PreviewPart {
  readonly at: number;
  readonly text: string;
  readonly match: boolean;
}

export interface FindUsagesDependencies {
  data: {
    /** The references the current search answered with, in document order. */
    readonly references: ReadonlyArray<SymbolReference>;
    /** Branch ids the user has folded shut. Everything else is open. */
    readonly collapsed: ReadonlySet<string>;
    /**
     * The declared symbol's kind (`function`, `class`), which names the group
     * its declaration falls into. Empty when the provider could not say.
     */
    readonly declarationKind: string;
  };
}

export interface FindUsagesFunctions {
  /** The results as a tree, in document order. */
  readonly tree: () => ReadonlyArray<UsageNode>;
  /** The tree folded down to what is on screen, top to bottom. */
  readonly rows: () => ReadonlyArray<UsageRow>;
  /** Every usage, in the order the tree presents them — what ↑/↓ walk. */
  readonly usages: () => ReadonlyArray<UsageLeaf>;
  /**
   * The usage the preview should show while the cursor is on the row `id`.
   *
   * The row itself when it is a usage; otherwise the first usage beneath it, so
   * walking the tree through its branches still reads the code as it goes and
   * landing on a file shows what was found in it.
   */
  readonly previewed: (id: string | null) => UsageLeaf | null;
  /**
   * The usage `step` places along from the row `id`, clamped at both ends so
   * holding the key down parks on the last result instead of wrapping past it.
   * Null when there are no results at all.
   */
  readonly step: (id: string | null, step: number) => UsageLeaf | null;
}
