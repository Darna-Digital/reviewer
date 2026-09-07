/**
 * The links a language server writes into hover documentation.
 *
 * A hover is markdown, and some servers answer with links in it — ruby-lsp
 * gives the places a constant is defined, which is the shortest route from
 * "what is this" to "show me". They point at files, so they are subject to the
 * same rule as every other path in this feature: repository-relative on the
 * way out of a provider, project-relative by the time a view sees them. Both
 * ends of that walk the same links, so the walking lives here.
 */

/**
 * Markdown link targets, as `[text](target)`. Deliberately narrow — no
 * nesting, no titles — because this rewrites documentation rather than parsing
 * a document, and anything it does not recognise is left exactly as it came.
 */
const MARKDOWN_LINK = /\]\(([^()\s]+)\)/g;

/** Whether `target` names something outside the app — a URL, not a file. */
const hasScheme = (target: string): boolean =>
  /^[a-z][a-z0-9+.-]*:/i.test(target);

/**
 * Rewrite every markdown link target with `change`. A target that names a
 * scheme (`https:`, `file:`) or an anchor on the page is left alone unless
 * `includeSchemes` says otherwise — the caller that turns `file://` URIs into
 * paths is the one exception, and it says so.
 */
export const mapMarkdownLinks = (
  markdown: string,
  change: (target: string) => string,
  { includeSchemes = false }: { readonly includeSchemes?: boolean } = {}
): string =>
  markdown.replace(MARKDOWN_LINK, (whole, target: string) => {
    if (target.startsWith("#")) return whole;
    if (!includeSchemes && hasScheme(target)) return whole;
    const changed = change(target);
    return changed === target ? whole : `](${changed})`;
  });

/** A file link, split into the path and whatever `#L…` fragment it carried. */
export const splitLinkTarget = (
  target: string
): { readonly path: string; readonly fragment: string } => {
  const hash = target.indexOf("#");
  return hash === -1
    ? { path: target, fragment: "" }
    : { path: target.slice(0, hash), fragment: target.slice(hash) };
};

/**
 * The one-based line a `#L12` or `#L12,4-18,7` fragment names — ruby-lsp writes
 * the second form — or null when there is none.
 */
export const lineOfFragment = (fragment: string): number | null => {
  const match = /^#L(\d+)/.exec(fragment);
  if (match === null) return null;
  const line = Number(match[1]);
  return Number.isFinite(line) && line > 0 ? line : null;
};
