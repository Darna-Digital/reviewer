/**
 * `markdown` feature — a `.md` file opened as a document rather than as source.
 *
 * A markdown file is the one filetype in a repository that has two honest
 * readings: the characters on disk, and the document those characters describe.
 * The feature exists to let a reader pick which one they are looking at — the
 * raw source, the rendered document, or both side by side — and to let them
 * edit either without the file quietly changing shape underneath them.
 *
 * Everything here is deliberately free of TipTap and of the DOM. The document
 * is described structurally (`DocNode`), so the conversions either way are
 * ordinary functions over data that a test can write by hand, and the editor
 * component is only the thing that puts that data on screen.
 */
import type { ComponentType } from "react";

/**
 * Which of the three readings of a markdown file is on screen.
 *
 * `source` is what every other filetype gets: the characters, in the code
 * editor. `editor` is the document, block-edited. `split` is both, the source
 * on the left and the document on the right, kept in step as either is typed
 * into.
 */
export type MarkdownView = "source" | "split" | "editor";

export const MARKDOWN_VIEWS: ReadonlyArray<MarkdownView> = [
  "source",
  "split",
  "editor",
];

/**
 * A ProseMirror document as plain JSON.
 *
 * Structurally what TipTap's `JSONContent` is, restated here so the converters
 * and their tests depend on a shape rather than on an editor library. The
 * arrays are mutable because this is handed straight to TipTap, which asks for
 * mutable ones.
 */
export interface DocMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  marks?: DocMark[];
  text?: string;
}

/** Column alignment a GFM table header can ask for. */
export type CellAlign = "left" | "right" | "center" | null;

/**
 * Why a run of markdown is being carried through untouched.
 *
 * `frontmatter` is the YAML header a document may open with; `raw` is anything
 * else the document model has no block for — embedded HTML, a link definition,
 * a footnote. Both are kept verbatim and written back byte for byte, because
 * the alternative — dropping what we cannot draw — turns opening a file into a
 * way to lose part of it.
 */
export type RawBlockKind = "frontmatter" | "raw";

/**
 * A live handle on the buffer of a file another view already owns.
 *
 * A split markdown file is two editors over one document, and only one of them
 * can own it — the code view does, because it is the one that also saves, marks
 * the tab dirty and runs the formatter. The document editor beside it reads and
 * writes through this instead of keeping a second copy, so there is never a
 * question of which of the two the file actually says.
 */
export interface FileBufferBridge {
  /** Told whenever the buffer changes, however it changed. */
  readonly subscribe: (listener: () => void) => () => void;
  /** The buffer as it stands, or null before the editor has attached. */
  readonly read: () => string | null;
  /**
   * Replace the buffer. Applied as the smallest edit that gets there, so the
   * owning editor keeps its caret and its undo history stays usable.
   */
  readonly write: (text: string) => void;
}

/**
 * One entry in the block menus — the slash menu while typing, and the "turn
 * into" list on a block's handle.
 *
 * `convert` is what makes an entry offerable as a conversion of an existing
 * block; entries without one (a divider, say) can only be inserted. Shaped
 * after the same split in the byconvo editor, where it is what lets the two
 * menus share a single catalogue.
 */
export interface BlockCommandContext {
  readonly chain: BlockChain;
}

/**
 * The subset of TipTap's command chain the catalogue uses. Narrowed to an
 * interface so the catalogue is testable with a recording double rather than a
 * live editor.
 */
export interface BlockChain {
  clearNodes: () => BlockChain;
  setParagraph: () => BlockChain;
  setHeading: (attrs: { level: number }) => BlockChain;
  toggleBulletList: () => BlockChain;
  toggleOrderedList: () => BlockChain;
  toggleTaskList: () => BlockChain;
  toggleBlockquote: () => BlockChain;
  toggleCodeBlock: () => BlockChain;
  setHorizontalRule: () => BlockChain;
  insertTable: (attrs: {
    rows: number;
    cols: number;
    withHeaderRow: boolean;
  }) => BlockChain;
  run: () => boolean;
}

/** How a catalogue entry draws itself in a menu. */
export type BlockIcon = ComponentType<{ className?: string }>;

export interface BlockCommand {
  readonly id: string;
  readonly icon: BlockIcon;
  readonly label: string;
  readonly description: string;
  /** Matched against what the user types after the slash, by prefix. */
  readonly keywords: ReadonlyArray<string>;
  /** Heading the slash menu files this entry under. */
  readonly group: string;
  /** Applies the command to a chain already focused on the target block. */
  readonly apply: (chain: BlockChain) => BlockChain;
  /**
   * Whether an existing block can be turned into this one. False for blocks
   * that are inserted rather than converted — a divider, a table.
   */
  readonly convertible: boolean;
}
