/**
 * Painting diagnostics onto the rendered code.
 *
 * `@pierre/diffs` has no API for decorating a character range, but with
 * `useTokenTransformer` every token is its own element carrying `data-char`
 * (its zero-based column) inside a line carrying `data-line` (its one-based
 * number). That is enough to underline exactly the tokens a diagnostic covers,
 * which is what makes this read like an IDE rather than a list of line numbers.
 *
 * The painter runs from the view's `onPostRender`, so it re-applies after every
 * re-render and after the virtualiser swaps in new lines. It is idempotent:
 * marks are always cleared before being reapplied, so a stale squiggle cannot
 * survive a diagnostic being fixed.
 */
import type { Diagnostic } from "@reviewer/core/language";
import type { TokenSpan } from "../interfaces/language.interfaces";
import { codeRootOf } from "@/lib/code-root";
import { decoratesTokens, markerForToken } from "./language.functions";

/** Marks the element as carrying a diagnostic of this severity. */
export const SEVERITY_ATTRIBUTE = "data-diagnostic";
/** Marks unused or deprecated code, which is faded rather than underlined. */
export const TAG_ATTRIBUTE = "data-diagnostic-tag";

const MARKED_SELECTOR = `[${SEVERITY_ATTRIBUTE}], [${TAG_ATTRIBUTE}]`;

const parseIndex = (value: string | null): number | null => {
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Remove every mark this module applied, leaving the DOM as it was found. */
export const clearDiagnosticMarks = (container: HTMLElement): void => {
  for (const element of codeRootOf(container).querySelectorAll(
    MARKED_SELECTOR
  )) {
    element.removeAttribute(SEVERITY_ATTRIBUTE);
    element.removeAttribute(TAG_ATTRIBUTE);
    element.removeAttribute("title");
  }
};

/**
 * Underline every token covered by `diagnostics`. Returns how many tokens were
 * marked, which the tests assert on and callers can ignore.
 */
export const paintDiagnostics = (
  container: HTMLElement,
  diagnostics: ReadonlyArray<Diagnostic>
): number => {
  clearDiagnosticMarks(container);
  // A whole-region hint marks its line, not every token under it.
  const decorating = diagnostics.filter(decoratesTokens);
  if (decorating.length === 0) return 0;

  // Bucket by line so each line only considers its own diagnostics — a file
  // with hundreds of problems would otherwise be quadratic in tokens.
  const byLine = new Map<number, Array<Diagnostic>>();
  for (const diagnostic of decorating) {
    for (
      let line = diagnostic.range.start.line;
      line <= diagnostic.range.end.line;
      line++
    ) {
      const bucket = byLine.get(line + 1);
      if (bucket === undefined) byLine.set(line + 1, [diagnostic]);
      else bucket.push(diagnostic);
    }
  }

  let marked = 0;
  // The lines are inside the view's shadow root, not under the host element the
  // render callback hands back.
  const root = codeRootOf(container);
  for (const lineElement of root.querySelectorAll("[data-line]")) {
    const lineNumber = parseIndex(lineElement.getAttribute("data-line"));
    if (lineNumber === null) continue;
    const lineDiagnostics = byLine.get(lineNumber);
    if (lineDiagnostics === undefined) continue;

    for (const tokenElement of lineElement.querySelectorAll("[data-char]")) {
      const lineCharStart = parseIndex(tokenElement.getAttribute("data-char"));
      if (lineCharStart === null) continue;
      const tokenText = tokenElement.textContent ?? "";
      const token: TokenSpan = {
        lineNumber,
        lineCharStart,
        lineCharEnd: lineCharStart + tokenText.length,
        tokenText,
      };
      const marker = markerForToken(lineDiagnostics, token);
      if (marker === null) continue;

      // Whitespace between tokens would render as a floating underline.
      if (tokenText.trim().length === 0) continue;

      tokenElement.setAttribute(SEVERITY_ATTRIBUTE, marker.severity);
      if (marker.tags.length > 0) {
        tokenElement.setAttribute(TAG_ATTRIBUTE, marker.tags.join(" "));
      }
      // A native tooltip is the accessible fallback when the hover card has not
      // opened yet, and it works for keyboard and screen-reader users too.
      tokenElement.setAttribute(
        "title",
        marker.diagnostics
          .map((entry) =>
            entry.code === null
              ? entry.message
              : `${entry.message} (${entry.source} ${entry.code})`
          )
          .join("\n")
      );
      marked += 1;
    }
  }
  return marked;
};
