/**
 * Painting find matches onto the rendered code.
 *
 * Nothing here mutates the view. `@pierre/diffs` owns every node under its
 * shadow root and rebuilds them as the virtualiser scrolls, and in the editable
 * view it rewrites them on every keystroke — wrapping matched text in elements
 * of our own would be torn out again a frame later, and would fight the
 * diagnostics painter for the same tokens. The CSS Custom Highlight API paints
 * ranges instead: no elements, no attributes, nothing for a re-render to lose.
 *
 * Ranges are built per token rather than per line, because `data-char` gives a
 * token its exact starting column — the same fact the diagnostics painter reads
 * — and a line element also holds furniture (line numbers, gutters) whose text
 * would otherwise shift every offset along.
 *
 * A browser without the API simply gets no highlight: the bar still counts the
 * matches and still scrolls to them.
 */
import { codeRootOf, codeRootsWithin } from "@/lib/code-root";
import type {
  FindAnchor,
  FindMatch,
} from "../interfaces/find-in-file.interfaces";

/** Every match in the file. */
export const FIND_HIGHLIGHT = "reviewer-find";
/** The one the counter is pointing at, painted over the top of it. */
export const FIND_CURRENT_HIGHLIGHT = "reviewer-find-current";

/**
 * Styles for the marks, injected into the view's shadow root — nothing in
 * `styles.css` reaches inside it, while custom properties still inherit across
 * the boundary, so the theme colours below resolve normally.
 *
 * `::highlight()` takes only a handful of properties, and background-color is
 * the one that matters: the syntax colour under it is left alone, which is what
 * makes a highlighted match still read as code. So the two marks have to be
 * told apart by hue rather than by weight — the accent washes every match, and
 * the one the counter is pointing at takes the warm colour every editor uses
 * for it. Neither is `--primary`, which is a near-black in light mode and a
 * near-white in dark: a match wearing it reads as blacked out, not as found.
 */
export const FIND_CSS = `
::highlight(${FIND_HIGHLIGHT}) {
  background-color: color-mix(in oklab, var(--ring-accent, #4a9eff) 26%, transparent);
}
::highlight(${FIND_CURRENT_HIGHLIGHT}) {
  background-color: color-mix(in oklab, var(--warning, #f0a533) 48%, transparent);
}
`;

interface HighlightRanges {
  /** Every match but the current one. */
  readonly rest: ReadonlyArray<Range>;
  readonly current: ReadonlyArray<Range>;
}

const parseIndex = (value: string | null): number | null => {
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const supported = (): boolean =>
  typeof CSS !== "undefined" &&
  typeof Highlight === "function" &&
  CSS.highlights !== undefined;

/**
 * A range over characters `[from, to)` of `element`'s text, walking its text
 * nodes so a token split into several of them still measures correctly.
 * Returns null when the element holds less text than that.
 */
const rangeWithin = (
  element: Element,
  from: number,
  to: number
): Range | null => {
  const walker = element.ownerDocument.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT
  );
  const range = element.ownerDocument.createRange();
  let seen = 0;
  let started = false;
  let node = walker.nextNode();
  while (node !== null) {
    const length = node.textContent?.length ?? 0;
    if (!started && seen + length > from) {
      range.setStart(node, from - seen);
      started = true;
    }
    if (started && seen + length >= to) {
      range.setEnd(node, to - seen);
      return range;
    }
    seen += length;
    node = walker.nextNode();
  }
  return null;
};

/**
 * The ranges covering `matches` in whatever of the file is currently rendered.
 * Exported for the tests: a range is checkable in a way a paint is not.
 */
export const findRanges = (
  container: HTMLElement,
  matches: ReadonlyArray<FindMatch>,
  activeIndex: number
): HighlightRanges => {
  const rest: Array<Range> = [];
  const current: Array<Range> = [];
  if (matches.length === 0) return { rest, current };

  // Bucket by line so each rendered line only considers its own matches: a file
  // full of hits would otherwise be quadratic in tokens.
  const byLine = new Map<number, Array<number>>();
  for (let index = 0; index < matches.length; index++) {
    const bucket = byLine.get(matches[index].line);
    if (bucket === undefined) byLine.set(matches[index].line, [index]);
    else bucket.push(index);
  }

  for (const lineElement of codeRootOf(container).querySelectorAll(
    "[data-line]"
  )) {
    const lineNumber = parseIndex(lineElement.getAttribute("data-line"));
    if (lineNumber === null) continue;
    const indexes = byLine.get(lineNumber);
    if (indexes === undefined) continue;

    for (const tokenElement of lineElement.querySelectorAll("[data-char]")) {
      const tokenStart = parseIndex(tokenElement.getAttribute("data-char"));
      if (tokenStart === null) continue;
      const tokenEnd = tokenStart + (tokenElement.textContent ?? "").length;

      for (const index of indexes) {
        const match = matches[index];
        const from = Math.max(match.start, tokenStart);
        const to = Math.min(match.end, tokenEnd);
        if (from >= to) continue;
        const range = rangeWithin(
          tokenElement,
          from - tokenStart,
          to - tokenStart
        );
        if (range === null) continue;
        if (index === activeIndex) current.push(range);
        else rest.push(range);
      }
    }
  }
  return { rest, current };
};

/**
 * Highlight every match rendered under `container`, accenting the current one.
 * Returns how many ranges were painted, which the caller can ignore.
 */
export const paintFindMatches = (
  container: HTMLElement,
  matches: ReadonlyArray<FindMatch>,
  activeIndex: number
): number => {
  if (!supported()) return 0;
  const { rest, current } = findRanges(container, matches, activeIndex);
  CSS.highlights.set(FIND_HIGHLIGHT, new Highlight(...rest));
  // Both highlights cover the current match; the accent has to win.
  const accent = new Highlight(...current);
  accent.priority = 1;
  CSS.highlights.set(FIND_CURRENT_HIGHLIGHT, accent);
  return rest.length + current.length;
};

/** Take every mark back off, leaving the view as it was found. */
export const clearFindMarks = (): void => {
  if (!supported()) return;
  CSS.highlights.delete(FIND_HIGHLIGHT);
  CSS.highlights.delete(FIND_CURRENT_HIGHLIGHT);
};

/**
 * The first line still on screen in `scroller`, as somewhere to search from
 * when there is no caret to search from. Null when nothing is rendered yet.
 */
export const topVisibleLine = (scroller: HTMLElement): FindAnchor | null => {
  const top = scroller.getBoundingClientRect().top;
  for (const root of codeRootsWithin(scroller)) {
    for (const lineElement of root.querySelectorAll("[data-line]")) {
      const lineNumber = parseIndex(lineElement.getAttribute("data-line"));
      if (lineNumber === null) continue;
      if (lineElement.getBoundingClientRect().bottom > top) {
        return { line: lineNumber, character: 0 };
      }
    }
  }
  return null;
};
