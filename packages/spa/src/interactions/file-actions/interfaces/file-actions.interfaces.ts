/**
 * `file-actions` feature — what the code tree may do to the project's own
 * files. Making, moving and deleting them is the editor's job rather than the
 * reviewer's, so all that is left here is showing a path in the operating
 * system's file manager, and the shape the tree names a row with.
 */
export type PathKind = "file" | "directory";

/** What the tree hands a context menu: a row's kind and its canonical path. */
export interface TreeItem {
  readonly kind: PathKind;
  readonly path: string;
}
