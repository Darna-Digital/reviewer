/**
 * What the keys do in an open file.
 *
 * Three exclusive answers rather than a switch each, because they are one
 * question: normal types into the file, vim types into it modally, and comment
 * does not type into it at all — the view goes read-only and the gutter offers
 * to leave a comment on a line, the way a local diff does.
 */
export const EDIT_MODES = ["comment", "normal", "vim"] as const;

export type EditMode = (typeof EDIT_MODES)[number];
