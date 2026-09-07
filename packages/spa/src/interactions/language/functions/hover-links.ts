/**
 * The links inside hover documentation.
 *
 * A server writes them as markdown — ruby-lsp's hover for a constant is the
 * list of files it is defined in — and by the time they reach here the server
 * has named them the way the app addresses files: a project path, optionally
 * with the `#L12` fragment naming a line. So a link either points at a file
 * this app can open, or it points out of the app entirely; nothing else.
 */
import { lineOfFragment, splitLinkTarget } from "@reviewer/core/language";
import type { Location } from "@reviewer/core/language";

/** Whether a link target names somewhere outside the app. */
const isExternal = (target: string): boolean =>
  /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("//");

/**
 * The location a hover link points at, or null when it is not a file this app
 * can open — an external URL, an anchor, or a `file://` URI the server could
 * not name from the repository (a gem, the standard library).
 */
export const hoverLinkLocation = (
  target: string | undefined
): Location | null => {
  if (target === undefined) return null;
  const trimmed = target.trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) return null;
  if (isExternal(trimmed)) return null;

  const { path, fragment } = splitLinkTarget(trimmed);
  if (path.length === 0) return null;
  // The fragment counts lines from one, as an editor does; positions here
  // count from zero.
  const line = (lineOfFragment(fragment) ?? 1) - 1;
  const at = { line, character: 0 };
  return { path, range: { start: at, end: at } };
};
