/**
 * Which files get the document treatment, and what each of the three views
 * puts on screen.
 *
 * Split out from the components because "does this view show the source?" is
 * the question the container, the keyboard shortcut and the preference all ask,
 * and three copies of the answer would drift.
 */
import {
  MARKDOWN_VIEWS,
  type MarkdownView,
} from "../interfaces/markdown.interfaces";

const MARKDOWN_EXTENSIONS = ["md", "markdown", "mdown", "mkd"];

const extensionOf = (path: string) =>
  path.split("/").at(-1)?.split(".").slice(1).at(-1)?.toLowerCase() ?? "";

/** Whether this path is a markdown document rather than ordinary source. */
export const isMarkdownPath = (path: string): boolean =>
  MARKDOWN_EXTENSIONS.includes(extensionOf(path));

/** Storage holds whatever the last version wrote; only these three are views. */
export const asMarkdownView = (value: unknown): MarkdownView =>
  MARKDOWN_VIEWS.includes(value as MarkdownView)
    ? (value as MarkdownView)
    : "source";

export const showsSource = (view: MarkdownView): boolean => view !== "editor";

export const showsDocument = (view: MarkdownView): boolean => view !== "source";

/** The next view in the strip, for the shortcut that cycles through them. */
export const nextMarkdownView = (view: MarkdownView): MarkdownView =>
  MARKDOWN_VIEWS[(MARKDOWN_VIEWS.indexOf(view) + 1) % MARKDOWN_VIEWS.length];
